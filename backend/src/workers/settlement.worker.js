// =============================================================================
// BidZone Settlement Worker (PostgreSQL Transaction Advisory Locks)
// Mandated by Section 3.6 / Appendix A.6 of Faculty Review
// Guarantees: Exactly-once auction settlement across multiple worker threads/instances
//
// Phase 1 additions:
//   - Runs automatically on a schedule (see startSettlementScheduler).
//   - "Settled" is tracked by auctions.settled_at, not by status, because a
//     late bid can already flip status to CLOSED before settlement runs.
//   - Expiry is checked against the DATABASE clock (now()), not Node's.
//   - Winner, seller and losing bidders are notified inside the same
//     transaction, and a live "closed" event is broadcast on COMMIT.
// =============================================================================

import pool from "../db/pool.js";
import { publishEvent } from "../services/events.js";
import { createNotification, inr } from "../services/notifications.js";

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

    // Advisory lock acquired! Now check eligibility with row-level lock.
    // The expiry test uses the database clock so it agrees with the bidding path.
    const auctionRes = await client.query(
      `SELECT id, title, status, ends_at, settled_at, current_highest_bid,
              current_highest_bidder_id, seller_id,
              (ends_at > now()) AS not_expired
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

    if (auction.settled_at) {
      await client.query("ROLLBACK");
      return { settled: false, auctionId, workerId, reason: "ALREADY_CLOSED" };
    }

    if (auction.not_expired) {
      await client.query("ROLLBACK");
      return { settled: false, auctionId, workerId, reason: "AUCTION_NOT_YET_EXPIRED" };
    }

    // Transition to CLOSED and stamp settlement exactly once
    await client.query(
      `UPDATE auctions
       SET status = 'CLOSED', settled_at = now(), updated_at = now()
       WHERE id = $1`,
      [auctionId]
    );

    const winnerId = auction.current_highest_bidder_id;
    const finalAmount = Number(auction.current_highest_bid);

    if (winnerId) {
      await createNotification(client, {
        userId: winnerId,
        auctionId,
        type: "AUCTION_WON",
        title: `You won "${auction.title}"!`,
        body: `Your winning bid was ${inr(finalAmount)}.`,
      });
      await createNotification(client, {
        userId: auction.seller_id,
        auctionId,
        type: "AUCTION_SOLD",
        title: `"${auction.title}" sold for ${inr(finalAmount)}`,
        body: "Your auction has ended with a winning bid.",
      });

      // Everyone else who placed an accepted bid lost.
      const losers = await client.query(
        `SELECT DISTINCT bidder_id FROM bids
         WHERE auction_id = $1 AND status = 'ACCEPTED' AND bidder_id <> $2`,
        [auctionId, winnerId]
      );
      for (const { bidder_id } of losers.rows) {
        await createNotification(client, {
          userId: bidder_id,
          auctionId,
          type: "AUCTION_LOST",
          title: `"${auction.title}" has ended`,
          body: `It sold for ${inr(finalAmount)} to another bidder.`,
        });
      }
    } else {
      await createNotification(client, {
        userId: auction.seller_id,
        auctionId,
        type: "AUCTION_UNSOLD",
        title: `"${auction.title}" ended without bids`,
        body: "No one placed a bid before the auction closed.",
      });
    }

    await publishEvent(client, {
      kind: "closed",
      auction_id: auctionId,
      winner_id: winnerId,
      amount: finalAmount,
    });

    // Commit automatically releases the advisory transaction lock
    // and delivers the queued notifications / live events.
    await client.query("COMMIT");

    return {
      settled: true,
      auctionId,
      workerId,
      winnerId,
      finalAmount,
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
 * Sweeps all expired, not-yet-settled auctions and settles them safely
 */
export async function settleAllExpiredAuctions(workerId = "worker-sweep") {
  const expiredRes = await pool.query(
    `SELECT id FROM auctions
     WHERE settled_at IS NULL AND ends_at <= now()
     ORDER BY ends_at
     LIMIT 50`
  );

  const results = [];
  for (const row of expiredRes.rows) {
    const outcome = await settleAuction(row.id, workerId);
    results.push(outcome);
  }
  return results;
}

/**
 * Runs the sweep on an interval. Safe to run in several backend instances
 * at once — the advisory lock guarantees each auction settles once.
 * Disable with SETTLEMENT_SCHEDULER=off (e.g. in tests that settle manually).
 */
export function startSettlementScheduler() {
  if (process.env.SETTLEMENT_SCHEDULER === "off") {
    console.log("Settlement scheduler disabled (SETTLEMENT_SCHEDULER=off)");
    return () => {};
  }
  const intervalMs = Number(process.env.SETTLEMENT_INTERVAL_MS) || 15000;
  const workerId = `scheduler-${process.pid}`;
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap sweeps within one process
    running = true;
    try {
      const outcomes = await settleAllExpiredAuctions(workerId);
      const settled = outcomes.filter((o) => o.settled);
      if (settled.length) {
        console.log(`Settlement: closed ${settled.length} auction(s):`, settled.map((o) => o.auctionId).join(", "));
      }
    } catch (err) {
      console.error("settlement sweep error:", err.message);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  tick();
  console.log(`Settlement scheduler running every ${intervalMs / 1000}s`);
  return () => clearInterval(timer);
}
