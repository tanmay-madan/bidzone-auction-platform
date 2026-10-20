import pool from "../db/pool.js";

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

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "amount must be a positive number.",
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

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "amount must be a positive number.",
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
      `SELECT id, seller_id, current_highest_bid, min_increment, starts_at, ends_at, status, version
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

    const now = new Date();
    if (auction.status === "CLOSED" || now >= new Date(auction.ends_at)) {
      return res.status(409).json({ success: false, code: "AUCTION_CLOSED", message: "This auction has already ended." });
    }
    if (now < new Date(auction.starts_at)) {
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

    // 2. Atomic conditional UPDATE verifying version matches read version
    const updateResult = await pool.query(
      `UPDATE auctions
       SET current_highest_bid = $1,
           current_highest_bidder_id = $2,
           version = version + 1,
           updated_at = now()
       WHERE id = $3 AND version = $4
       RETURNING id, current_highest_bid, current_highest_bidder_id, version`,
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

    const body = {
      success: true,
      message: "Bid placed successfully (optimistic mode)",
      bid: { id: bidResult.rows[0].id, auction_id: auctionId, amount },
      auction: {
        current_highest_bid: amount,
        current_highest_bidder_id: bidderId,
        version: updateResult.rows[0].version,
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
  const strategy = req.query.strategy || req.headers["x-bidding-strategy"] || "pessimistic";
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

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "amount must be a positive number.",
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
      `SELECT id, seller_id, current_highest_bid, min_increment,
              starts_at, ends_at, status, version
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
         now() >= $2::timestamptz AS ended`,
      [auction.starts_at, auction.ends_at]
    );
    const { not_started: notStarted, ended } = timeCheck.rows[0];

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

    const body = {
      success: true,
      message: "Bid placed successfully",
      bid: { id: bidResult.rows[0].id, auction_id: auctionId, amount },
      auction: { current_highest_bid: amount, current_highest_bidder_id: bidderId },
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
