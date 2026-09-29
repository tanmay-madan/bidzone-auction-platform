import pool from "../db/pool.js";

async function safeRollback(client) {
  try {
    await client.query("ROLLBACK");
  } catch (err) {
    console.error("rollback error:", err.message);
  }
}

// POST /api/auctions/:id/bids
//
// This is the most important endpoint in the project. It must
// guarantee that concurrent bids cannot corrupt auction state.
//
// Strategy: pessimistic locking with SELECT ... FOR UPDATE inside a
// single transaction. Whichever concurrent request's transaction
// acquires the row lock first runs the full read-validate-write
// sequence and commits; every other concurrent request for the same
// auction blocks on the lock until it is released, then re-reads the
// now-updated row — so it correctly sees the new highest bid rather
// than the stale one it would have seen without the lock.
//
// Idempotency: an optional "Idempotency-Key" header lets a client
// safely retry the same submission (e.g. after a dropped connection)
// without risking a second bid being recorded. The key is scoped to
// (bidder, auction) and the first result is replayed verbatim on
// retry, before any locking or validation happens.
export async function placeBid(req, res) {
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
    // Idempotency replay check happens before BEGIN — it's a plain
    // read, not part of the bidding transaction itself.
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

    // Row-level lock: any other transaction bidding on this same
    // auction now blocks here until this transaction commits or
    // rolls back.
    const auctionResult = await client.query(
      `SELECT id, seller_id, current_highest_bid, min_increment,
              starts_at, ends_at, status
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

    // Authoritative time check: the database's own clock, evaluated
    // inside this transaction, is the only source of truth for
    // whether the auction is open. The frontend countdown is purely
    // visual and is never trusted here. Policy: starts_at <= now() <
    // ends_at is the open window; now() >= ends_at closes it even if
    // the request left the browser before that instant.
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

      // If the auction has actually timed out, flip status to CLOSED
      // now so future reads don't need to recompute it.
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

    // Accepted: insert the bid and update the auction's committed
    // highest bid atomically, in the same transaction as the check
    // above, so no other transaction can interleave between them.
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
