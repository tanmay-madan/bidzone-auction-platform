import pool from "../db/pool.js";
import config from "../config.js";
import { publishEvent } from "../services/events.js";
import { createNotification, inr } from "../services/notifications.js";

// Phase 1: after an accepted bid, tell the previous leader they were
// outbid, tell the seller about the new bid, and broadcast the new
// price. Called with the transaction client, so all of it is committed
// atomically with the bid itself — and only broadcast after COMMIT.
async function afterAcceptedBid(db, { auction, auctionId, bidderId, amount, endsAt, extended }) {
  const prevBidderId = auction.current_highest_bidder_id;
  if (prevBidderId && prevBidderId !== bidderId) {
    await createNotification(db, {
      userId: prevBidderId,
      auctionId,
      type: "OUTBID",
      title: `You've been outbid on "${auction.title}"`,
      body: `The new highest bid is ${inr(amount)}. Bid again to take the lead.`,
    });
  }
  await createNotification(db, {
    userId: auction.seller_id,
    auctionId,
    type: "NEW_BID",
    title: `New bid on "${auction.title}"`,
    body: `Someone bid ${inr(amount)}.`,
  });
  // Bidder names are already public in each auction's bid history, so
  // the live activity feed may show them too.
  const bidder = await db.query("SELECT name FROM users WHERE id = $1", [bidderId]);
  await publishEvent(db, {
    kind: "bid",
    auction_id: auctionId,
    title: auction.title,
    bidder_name: bidder.rows[0]?.name || "Someone",
    amount,
    bidder_id: bidderId,
    ends_at: endsAt,
    extended: Boolean(extended),
  });
}

// NUMERIC(12,2): at most 9,999,999,999.99 and two decimal places.
const MAX_AMOUNT = 9999999999.99;
function invalidAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return "amount must be a positive number.";
  if (amount > MAX_AMOUNT) return "amount is too large.";
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    return "amount can have at most 2 decimal places.";
  }
  return null;
}

// ?anti_sniping=true|false is a test switch; in production the rule is
// always decided by the auction itself.
function antiSnipingAllowed(req, totalDurationMs) {
  if (config.allowTestModes && req.query.anti_sniping === "false") return false;
  if (config.allowTestModes && req.query.anti_sniping === "true") return true;
  return totalDurationMs > 2 * 60 * 1000;
}

async function safeRollback(client) {
  try {
    await client.query("ROLLBACK");
  } catch (err) {
    console.error("rollback error:", err.message);
  }
}

// -----------------------------------------------------------------------------
// 1. NAIVE STRATEGY (Unshielded Read-Then-Write)
// Used to capture empirical race condition failure logs for docs/evidence/01-naive-failure.txt
// -----------------------------------------------------------------------------
export async function placeBidNaive(req, res) {
  const auctionId = Number(req.params.id);
  const amount = Number(req.body?.amount);
  const bidderId = req.user.id;

  const amountError = invalidAmount(amount);
  if (amountError) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: amountError,
    });
  }

  try {
    // 1. Plain un-locked read (VULNERABILITY: concurrent requests read identical state)
    const auctionResult = await pool.query(
      `SELECT id, seller_id, current_highest_bid, min_increment, starts_at, ends_at, status
       FROM auctions WHERE id = $1`,
      [auctionId]
    );
    const auction = auctionResult.rows[0];

    if (!auction) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Auction not found." });
    }

    if (auction.seller_id === bidderId) {
      return res.status(403).json({ success: false, code: "SELLER_CANNOT_BID", message: "You cannot bid on your own auction." });
    }

    if (auction.status === "CLOSED" || new Date() >= new Date(auction.ends_at)) {
      return res.status(409).json({ success: false, code: "AUCTION_CLOSED", message: "This auction has already ended." });
    }

    const minAcceptable = Number(auction.current_highest_bid) + Number(auction.min_increment);
    if (amount < minAcceptable) {
      return res.status(409).json({
        success: false,
        code: "BID_TOO_LOW",
        message: `Your bid must be at least ${minAcceptable}.`,
      });
    }

    // Delay to simulate realistic race window (processing, query plan, network roundtrips)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Uncoordinated INSERT & UPDATE without transaction isolation
    const bidResult = await pool.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, status)
       VALUES ($1, $2, $3, 'ACCEPTED')
       RETURNING id`,
      [auctionId, bidderId, amount]
    );

    await pool.query(
      `UPDATE auctions
       SET current_highest_bid = $1, current_highest_bidder_id = $2, updated_at = now()
       WHERE id = $3`,
      [amount, bidderId, auctionId]
    );

    return res.status(201).json({
      success: true,
      message: "Bid placed successfully (naive unshielded mode)",
      bid: { id: bidResult.rows[0].id, auction_id: auctionId, amount },
      auction: { current_highest_bid: amount, current_highest_bidder_id: bidderId },
    });
  } catch (err) {
    console.error("placeBidNaive error:", err.message);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Could not place bid." });
  }
}

// -----------------------------------------------------------------------------
// 2. OPTIMISTIC STRATEGY (Version Column + Retry-on-Conflict)
// Signature Feature: Appendix A.5 implementation for empirical benchmark vs pessimistic
// -----------------------------------------------------------------------------
export async function placeBidOptimistic(req, res) {
  const auctionId = Number(req.params.id);
  const amount = Number(req.body?.amount);
  const bidderId = req.user.id;
  const idemKey = req.headers["idempotency-key"] || null;

  const amountError = invalidAmount(amount);
  if (amountError) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: amountError,
    });
  }

  // Idempotency replay check happens before retry loop
  if (idemKey) {
    const existing = await pool.query(
      `SELECT status_code, response FROM idempotency_keys
       WHERE idem_key = $1 AND bidder_id = $2 AND auction_id = $3`,
      [idemKey, bidderId, auctionId]
    );
    if (existing.rows.length > 0) {
      const { status_code, response } = existing.rows[0];
      return res.status(status_code).json(response);
    }
  }

  const MAX_RETRIES = 12;
  let attempts = 0;
  let retryCount = 0;

  while (attempts < MAX_RETRIES) {
    attempts++;

    // 1. Plain read WITHOUT locking the row
    const auctionResult = await pool.query(
      `SELECT id, seller_id, title, current_highest_bid, current_highest_bidder_id, min_increment,
              starts_at, ends_at, status, version,
              now() < starts_at AS not_started,
              now() >= ends_at AS ended,
              EXTRACT(EPOCH FROM (ends_at - now())) * 1000 AS remaining_ms
       FROM auctions WHERE id = $1`,
      [auctionId]
    );
    const auction = auctionResult.rows[0];

    if (!auction) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Auction not found." });
    }

    if (auction.seller_id === bidderId) {
      return res.status(403).json({ success: false, code: "SELLER_CANNOT_BID", message: "You cannot bid on your own auction." });
    }

    // Time checks use the database clock, same as the pessimistic engine.
    if (auction.status === "CLOSED" || auction.ended) {
      return res.status(409).json({ success: false, code: "AUCTION_CLOSED", message: "This auction has already ended." });
    }
    if (auction.not_started) {
      return res.status(409).json({ success: false, code: "AUCTION_NOT_STARTED", message: "This auction has not started yet." });
    }

    const minAcceptable = Number(auction.current_highest_bid) + Number(auction.min_increment);
    if (amount < minAcceptable) {
      // Outbid by state at read time — no need to retry further
      const body = {
        success: false,
        code: "BID_TOO_LOW",
        message: `Your bid must be at least ${minAcceptable}.`,
        retries: retryCount,
      };

      if (idemKey) {
        await pool.query(
          `INSERT INTO idempotency_keys (idem_key, bidder_id, auction_id, status_code, response)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (idem_key, bidder_id, auction_id) DO NOTHING`,
          [idemKey, bidderId, auctionId, 409, JSON.stringify(body)]
        );
      }
      return res.status(409).json(body);
    }

    // Anti-sniping check: For standard auctions (duration > 2m), bids in the final 2 minutes extend closing time by 2m
    const remainingMs = Number(auction.remaining_ms);
    const totalDurationMs = new Date(auction.ends_at).getTime() - new Date(auction.starts_at).getTime();
    const allowAntiSniping = antiSnipingAllowed(req, totalDurationMs);

    let extended = false;
    let endsAtClause = "";
    if (allowAntiSniping && remainingMs > 0 && remainingMs <= 2 * 60 * 1000) {
      endsAtClause = ", ends_at = ends_at + INTERVAL '2 minutes'";
      extended = true;
    }

    // 2. Atomic conditional UPDATE verifying version matches read version
    const updateResult = await pool.query(
      `UPDATE auctions
       SET current_highest_bid = $1,
           current_highest_bidder_id = $2,
           version = version + 1,
           updated_at = now()
           ${endsAtClause}
       WHERE id = $3 AND version = $4
       RETURNING id, current_highest_bid, current_highest_bidder_id, version, ends_at`,
      [amount, bidderId, auctionId, auction.version]
    );

    if (updateResult.rowCount === 0) {
      // Collision detected! Another transaction updated the auction version first.
      retryCount++;
      if (attempts < MAX_RETRIES) {
        // Bounded exponential backoff with random jitter to prevent thundering herd
        const backoff = Math.min(120, 10 * Math.pow(1.4, attempts) + Math.random() * 15);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      } else {
        return res.status(409).json({
          success: false,
          code: "CONCURRENCY_CONFLICT",
          message: "High contention: could not acquire slot within retry limit.",
          retries: retryCount,
        });
      }
    }

    // 3. Update succeeded! Insert accepted bid record
    const bidResult = await pool.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, status)
       VALUES ($1, $2, $3, 'ACCEPTED')
       RETURNING id`,
      [auctionId, bidderId, amount]
    );

    try {
      // Optimistic mode has no surrounding transaction, so these are
      // best-effort and never fail an already-accepted bid.
      await afterAcceptedBid(pool, {
        auction,
        auctionId,
        bidderId,
        amount,
        endsAt: updateResult.rows[0].ends_at,
        extended,
      });
    } catch (err) {
      console.error("optimistic afterAcceptedBid error:", err.message);
    }

    const body = {
      success: true,
      message: extended
        ? "Bid placed successfully (auction extended by 2 minutes via anti-sniping)"
        : "Bid placed successfully (optimistic mode)",
      bid: { id: bidResult.rows[0].id, auction_id: auctionId, amount },
      auction: {
        current_highest_bid: amount,
        current_highest_bidder_id: bidderId,
        version: updateResult.rows[0].version,
        ends_at: updateResult.rows[0].ends_at,
        anti_sniping_extended: extended,
      },
      retries: retryCount,
    };

    if (idemKey) {
      await pool.query(
        `INSERT INTO idempotency_keys (idem_key, bidder_id, auction_id, status_code, response)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (idem_key, bidder_id, auction_id) DO NOTHING`,
        [idemKey, bidderId, auctionId, 201, JSON.stringify(body)]
      );
    }

    return res.status(201).json(body);
  }
}

// -----------------------------------------------------------------------------
// 3. PESSIMISTIC STRATEGY (SELECT ... FOR UPDATE) - Default Production Engine
// -----------------------------------------------------------------------------
export async function placeBid(req, res) {
  // The naive and optimistic engines exist for the benchmark/evidence
  // scripts. In production they are disabled, so a client can never
  // bypass the row lock by adding ?strategy=naive.
  const strategy = config.allowTestModes
    ? req.query.strategy || req.headers["x-bidding-strategy"] || "pessimistic"
    : "pessimistic";
  if (strategy === "naive") {
    return placeBidNaive(req, res);
  }
  if (strategy === "optimistic") {
    return placeBidOptimistic(req, res);
  }

  const auctionId = Number(req.params.id);
  const amount = Number(req.body?.amount);
  const bidderId = req.user.id;
  const idemKey = req.headers["idempotency-key"] || null;

  const amountError = invalidAmount(amount);
  if (amountError) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: amountError,
    });
  }

  const client = await pool.connect();
  try {
    // Idempotency replay check happens before BEGIN — it's a plain read
    if (idemKey) {
      const existing = await client.query(
        `SELECT status_code, response FROM idempotency_keys
         WHERE idem_key = $1 AND bidder_id = $2 AND auction_id = $3`,
        [idemKey, bidderId, auctionId]
      );
      if (existing.rows.length > 0) {
        const { status_code, response } = existing.rows[0];
        return res.status(status_code).json(response);
      }
    }

    await client.query("BEGIN");

    // Row-level lock: any other transaction bidding on this same auction blocks here
    const auctionResult = await client.query(
      `SELECT id, seller_id, title, current_highest_bid, current_highest_bidder_id,
              min_increment, starts_at, ends_at, status, version
       FROM auctions
       WHERE id = $1
       FOR UPDATE`,
      [auctionId]
    );
    const auction = auctionResult.rows[0];

    if (!auction) {
      await safeRollback(client);
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Auction not found.",
      });
    }

    // Re-check the idempotency key now that we hold the row lock. Two
    // retries with the same key that arrived together both passed the
    // fast check above; the second one waited on the lock and must now
    // see the first one's stored result instead of bidding again.
    if (idemKey) {
      const replay = await client.query(
        `SELECT status_code, response FROM idempotency_keys
         WHERE idem_key = $1 AND bidder_id = $2 AND auction_id = $3`,
        [idemKey, bidderId, auctionId]
      );
      if (replay.rows.length > 0) {
        await safeRollback(client);
        const { status_code, response } = replay.rows[0];
        return res.status(status_code).json(response);
      }
    }

    if (auction.seller_id === bidderId) {
      await safeRollback(client);
      return res.status(403).json({
        success: false,
        code: "SELLER_CANNOT_BID",
        message: "You cannot bid on your own auction.",
      });
    }

    // Authoritative time check: server clock at transaction time
    const timeCheck = await client.query(
      `SELECT
         now() < $1::timestamptz AS not_started,
         now() >= $2::timestamptz AS ended,
         EXTRACT(EPOCH FROM ($2::timestamptz - now())) * 1000 AS remaining_ms`,
      [auction.starts_at, auction.ends_at]
    );
    const { not_started: notStarted, ended, remaining_ms: remainingMsRaw } = timeCheck.rows[0];

    let rejectionCode = null;
    if (auction.status === "CLOSED" || ended) {
      rejectionCode = "AUCTION_CLOSED";
    } else if (notStarted) {
      rejectionCode = "AUCTION_NOT_STARTED";
    } else {
      const minAcceptable =
        Number(auction.current_highest_bid) + Number(auction.min_increment);
      if (amount < minAcceptable) {
        rejectionCode = "BID_TOO_LOW";
      }
    }

    if (rejectionCode) {
      await client.query(
        `INSERT INTO bids (auction_id, bidder_id, amount, status, reason)
         VALUES ($1, $2, $3, 'REJECTED', $4)`,
        [auctionId, bidderId, amount, rejectionCode]
      );

      if (rejectionCode === "AUCTION_CLOSED" && auction.status !== "CLOSED") {
        await client.query(`UPDATE auctions SET status = 'CLOSED' WHERE id = $1`, [
          auctionId,
        ]);
      }

      const messages = {
        BID_TOO_LOW: `Your bid must be at least ${
          Number(auction.current_highest_bid) + Number(auction.min_increment)
        }.`,
        AUCTION_CLOSED: "This auction has already ended.",
        AUCTION_NOT_STARTED: "This auction has not started yet.",
      };
      const body = { success: false, code: rejectionCode, message: messages[rejectionCode] };

      if (idemKey) {
        await client.query(
          `INSERT INTO idempotency_keys (idem_key, bidder_id, auction_id, status_code, response)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (idem_key, bidder_id, auction_id) DO NOTHING`,
          [idemKey, bidderId, auctionId, 409, JSON.stringify(body)]
        );
      }

      await client.query("COMMIT");
      return res.status(409).json(body);
    }

    // Anti-sniping check under row lock (database clock): for standard
    // auctions (duration > 2m), bids in the final 2 minutes extend closing time by 2m
    const remainingMs = Number(remainingMsRaw);
    const totalDurationMs = new Date(auction.ends_at).getTime() - new Date(auction.starts_at).getTime();
    const allowAntiSniping = antiSnipingAllowed(req, totalDurationMs);

    let extended = false;
    let finalEndsAt = auction.ends_at;

    if (allowAntiSniping && remainingMs > 0 && remainingMs <= 2 * 60 * 1000) {
      const extendRes = await client.query(
        `UPDATE auctions
         SET ends_at = ends_at + INTERVAL '2 minutes'
         WHERE id = $1
         RETURNING ends_at`,
        [auctionId]
      );
      finalEndsAt = extendRes.rows[0].ends_at;
      extended = true;
    }

    // Accepted: insert the bid and update the auction's state atomically
    const bidResult = await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, status)
       VALUES ($1, $2, $3, 'ACCEPTED')
       RETURNING id`,
      [auctionId, bidderId, amount]
    );
    await client.query(
      `UPDATE auctions
       SET current_highest_bid = $1,
           current_highest_bidder_id = $2,
           version = version + 1,
           updated_at = now()
       WHERE id = $3`,
      [amount, bidderId, auctionId]
    );

    await afterAcceptedBid(client, {
      auction,
      auctionId,
      bidderId,
      amount,
      endsAt: finalEndsAt,
      extended,
    });

    const body = {
      success: true,
      message: extended
        ? "Bid placed successfully (auction extended by 2 minutes via anti-sniping)"
        : "Bid placed successfully",
      bid: { id: bidResult.rows[0].id, auction_id: auctionId, amount },
      auction: {
        current_highest_bid: amount,
        current_highest_bidder_id: bidderId,
        ends_at: finalEndsAt,
        anti_sniping_extended: extended,
      },
    };

    if (idemKey) {
      await client.query(
        `INSERT INTO idempotency_keys (idem_key, bidder_id, auction_id, status_code, response)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (idem_key, bidder_id, auction_id) DO NOTHING`,
        [idemKey, bidderId, auctionId, 201, JSON.stringify(body)]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json(body);
  } catch (err) {
    await safeRollback(client);
    console.error("placeBid error:", err.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Could not place bid.",
    });
  } finally {
    client.release();
  }
}

// Latest accepted bids across all auctions, for the homepage activity
// feed (bidder names are already public in each auction's history).
export async function recentActivity(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.auction_id, a.title, u.name AS bidder_name, b.bidder_id, b.amount, b.created_at
       FROM bids b
       JOIN auctions a ON a.id = b.auction_id
       JOIN users u ON u.id = b.bidder_id
       WHERE b.status = 'ACCEPTED'
       ORDER BY b.created_at DESC
       LIMIT 8`
    );
    res.json({ activity: result.rows });
  } catch (err) {
    console.error("recentActivity error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load activity." });
  }
}

export async function bidHistory(req, res) {
  const auctionId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT b.id, b.amount, b.created_at, u.name AS bidder_name
       FROM bids b
       JOIN users u ON u.id = b.bidder_id
       WHERE b.auction_id = $1 AND b.status = 'ACCEPTED'
       ORDER BY b.amount DESC, b.created_at DESC`,
      [auctionId]
    );
    res.json({ bids: result.rows });
  } catch (err) {
    console.error("bidHistory error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load bid history." });
  }
}

export async function myBids(req, res) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (a.id)
         a.id AS auction_id, a.title, a.current_highest_bid,
         a.current_highest_bidder_id, a.ends_at,
         CASE
           WHEN a.status = 'CLOSED' OR now() >= a.ends_at THEN 'CLOSED'
           WHEN now() < a.starts_at THEN 'UPCOMING'
           ELSE 'ACTIVE'
         END AS status,
         b.amount AS my_latest_bid,
         (a.current_highest_bidder_id = $1) AS is_winning
       FROM bids b
       JOIN auctions a ON a.id = b.auction_id
       WHERE b.bidder_id = $1 AND b.status = 'ACCEPTED'
       ORDER BY a.id, b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bids: result.rows });
  } catch (err) {
    console.error("myBids error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR", message: "Could not load your bids." });
  }
}
