// =============================================================================
// BidZone Settlement Worker (PostgreSQL Transaction Advisory Locks)
// Mandated by Section 3.6 / Appendix A.6 of Faculty Review
// Guarantees: Exactly-once auction settlement across multiple worker threads/instances
// =============================================================================

import pool from "../db/pool.js";

/**
 * Settles a single expired auction with exactly-once guarantee using PostgreSQL
 * Transaction-Level Advisory Locks: pg_try_advisory_xact_lock(hashtext(...))
 *
 * If two workers or cron triggers run at the exact same instant, only ONE acquires
 * the advisory lock; the second receives false and exits quietly without double-settling.
 */
export async function settleAuction(auctionId, workerId = "worker-default") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Appendix A.6: Non-blocking advisory transaction lock on hashed namespace + auctionId
    const lockResult = await client.query(
      `SELECT pg_try_advisory_xact_lock(hashtext('settle_auction:' || $1)) AS acquired`,
      [auctionId]
    );
    const acquired = lockResult.rows[0].acquired;

    if (!acquired) {
      // Lock is held by another worker instance right now!
      await client.query("ROLLBACK");
      return {
        settled: false,
        auctionId,
        workerId,
        reason: "ADVISORY_LOCK_HELD_BY_ANOTHER_WORKER",
      };
    }

    // Advisory lock acquired! Now check eligibility with row-level lock
    const auctionRes = await client.query(
      `SELECT id, title, status, ends_at, current_highest_bid, current_highest_bidder_id, seller_id
       FROM auctions
       WHERE id = $1
       FOR UPDATE`,
      [auctionId]
    );
    const auction = auctionRes.rows[0];

    if (!auction) {
      await client.query("ROLLBACK");
      return { settled: false, auctionId, workerId, reason: "AUCTION_NOT_FOUND" };
    }

    if (auction.status === "CLOSED") {
      await client.query("ROLLBACK");
      return { settled: false, auctionId, workerId, reason: "ALREADY_CLOSED" };
    }

    if (new Date(auction.ends_at) > new Date()) {
      await client.query("ROLLBACK");
      return { settled: false, auctionId, workerId, reason: "AUCTION_NOT_YET_EXPIRED" };
    }

    // Transition status to CLOSED (settled)
    await client.query(
      `UPDATE auctions
       SET status = 'CLOSED', updated_at = now()
       WHERE id = $1`,
      [auctionId]
    );

    // Commit automatically releases the advisory transaction lock
    await client.query("COMMIT");

    return {
      settled: true,
      auctionId,
      workerId,
      winnerId: auction.current_highest_bidder_id,
      finalAmount: Number(auction.current_highest_bid),
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Sweeps all expired ACTIVE auctions and settles them safely
 */
export async function settleAllExpiredAuctions(workerId = "worker-sweep") {
  const expiredRes = await pool.query(
    `SELECT id FROM auctions
     WHERE status = 'ACTIVE' AND ends_at <= now()
     LIMIT 50`
  );

  const results = [];
  for (const row of expiredRes.rows) {
    const outcome = await settleAuction(row.id, workerId);
    results.push(outcome);
  }
  return results;
}
