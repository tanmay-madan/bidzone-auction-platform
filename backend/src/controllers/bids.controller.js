import pool from "../db/pool.js";

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
export async function placeBid(req, res) {
  const auctionId = Number(req.params.id);
  const amount = Number(req.body?.amount);
  const bidderId = req.user.id;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "amount must be a positive number.",
    });
  }

  const client = await pool.connect();
  try {
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
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "NOT_FOUND", message: "Auction not found." });
    }

    if (auction.seller_id === bidderId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "SELLER_CANNOT_BID",
        message: "You cannot bid on your own auction.",
      });
    }

    // Authoritative time check: the database's own clock, evaluated
    // inside this transaction, is the only source of truth for
    // whether the auction is open. The frontend countdown is purely
    // visual and is never trusted here.
    const timeCheck = await client.query(
      `SELECT
         now() < $1::timestamptz AS not_started,
         now() >= $2::timestamptz AS ended`,
      [auction.starts_at, auction.ends_at]
    );
    const { not_started: notStarted, ended } = timeCheck.rows[0];

    let rejectionReason = null;
    if (auction.status === "CLOSED" || ended) {
      rejectionReason = "AUCTION_CLOSED";
    } else if (notStarted) {
      rejectionReason = "AUCTION_NOT_STARTED";
    } else {
      const minAcceptable =
        Number(auction.current_highest_bid) + Number(auction.min_increment);
      if (amount < minAcceptable) {
        rejectionReason = "BID_TOO_LOW";
      }
    }

    if (rejectionReason) {
      await client.query(
        `INSERT INTO bids (auction_id, bidder_id, amount, status, reason)
         VALUES ($1, $2, $3, 'REJECTED', $4)`,
        [auctionId, bidderId, amount, rejectionReason]
      );

      // If the auction has actually timed out, flip status to CLOSED
      // now so future reads don't need to recompute it.
      if (rejectionReason === "AUCTION_CLOSED" && auction.status !== "CLOSED") {
        await client.query(`UPDATE auctions SET status = 'CLOSED' WHERE id = $1`, [
          auctionId,
        ]);
      }

      await client.query("COMMIT");

      const messages = {
        BID_TOO_LOW: `Your bid must be at least ${
          Number(auction.current_highest_bid) + Number(auction.min_increment)
        }.`,
        AUCTION_CLOSED: "This auction has already ended.",
        AUCTION_NOT_STARTED: "This auction has not started yet.",
      };
      return res.status(409).json({
        error: rejectionReason,
        message: messages[rejectionReason],
      });
    }

    // Accepted: insert the bid and update the auction's committed
    // highest bid atomically, in the same transaction as the check
    // above, so no other transaction can interleave between them.
    await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, status)
       VALUES ($1, $2, $3, 'ACCEPTED')`,
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

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Bid accepted.",
      current_highest_bid: amount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("placeBid error:", err.message);
    return res.status(500).json({ error: "SERVER_ERROR", message: "Could not place bid." });
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
