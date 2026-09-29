// Verifies the invariants that must always hold between auctions and
// bids, regardless of how much concurrent traffic has hit the system.
// Read-only — safe to run anytime against a live database.
//
// Usage: node scripts/consistency-check.js

import pool from "../src/db/pool.js";

function report(label, rows) {
  const ok = rows.length === 0;
  console.log(`${ok ? "\u2713" : "\u2717"} ${label}: ${ok ? "OK" : `${rows.length} violation(s)`}`);
  if (!ok) console.table(rows);
  return ok;
}

async function main() {
  console.log("BidZone database consistency check");
  console.log("===================================\n");

  const checks = [];

  // 1. current_highest_bid must equal the highest ACCEPTED bid for
  // that auction (or the starting_price if no bids were ever
  // accepted).
  const highestBidMismatch = await pool.query(`
    SELECT a.id AS auction_id, a.current_highest_bid,
           COALESCE(MAX(b.amount), a.starting_price) AS expected_highest
    FROM auctions a
    LEFT JOIN bids b ON b.auction_id = a.id AND b.status = 'ACCEPTED'
    GROUP BY a.id, a.current_highest_bid, a.starting_price
    HAVING a.current_highest_bid != COALESCE(MAX(b.amount), a.starting_price)
  `);
  checks.push(report("current_highest_bid matches highest accepted bid", highestBidMismatch.rows));

  // 2. current_highest_bidder_id must be the bidder who placed that
  // highest accepted bid.
  const bidderMismatch = await pool.query(`
    SELECT a.id AS auction_id, a.current_highest_bidder_id, top.bidder_id AS expected_bidder
    FROM auctions a
    JOIN LATERAL (
      SELECT bidder_id FROM bids
      WHERE auction_id = a.id AND status = 'ACCEPTED'
      ORDER BY amount DESC, created_at ASC
      LIMIT 1
    ) top ON true
    WHERE a.current_highest_bidder_id IS DISTINCT FROM top.bidder_id
  `);
  checks.push(report("current_highest_bidder_id matches the top accepted bid's bidder", bidderMismatch.rows));

  // 3. No ACCEPTED bid was created before starts_at or at/after ends_at.
  const outOfWindowBids = await pool.query(`
    SELECT b.id AS bid_id, b.auction_id, b.created_at, a.starts_at, a.ends_at
    FROM bids b
    JOIN auctions a ON a.id = b.auction_id
    WHERE b.status = 'ACCEPTED'
      AND (b.created_at < a.starts_at OR b.created_at >= a.ends_at)
  `);
  checks.push(report("no accepted bid falls outside [starts_at, ends_at)", outOfWindowBids.rows));

  // 4. Every accepted bid respects the increment rule relative to the
  // previous accepted bid (or the starting price, for the first one).
  const incrementViolations = await pool.query(`
    WITH ordered AS (
      SELECT b.id, b.auction_id, b.amount, a.starting_price, a.min_increment,
             LAG(b.amount) OVER (PARTITION BY b.auction_id ORDER BY b.created_at) AS prev_amount
      FROM bids b
      JOIN auctions a ON a.id = b.auction_id
      WHERE b.status = 'ACCEPTED'
    )
    SELECT id, auction_id, amount, prev_amount
    FROM ordered
    WHERE amount < COALESCE(prev_amount, starting_price) + min_increment
  `);
  checks.push(report("every accepted bid satisfies amount >= previous + min_increment", incrementViolations.rows));

  // 5. Every bid references an existing user and auction (guaranteed
  // by foreign keys, but verified explicitly here too).
  const orphanBids = await pool.query(`
    SELECT b.id FROM bids b
    LEFT JOIN users u ON u.id = b.bidder_id
    LEFT JOIN auctions a ON a.id = b.auction_id
    WHERE u.id IS NULL OR a.id IS NULL
  `);
  checks.push(report("every bid references an existing user and auction", orphanBids.rows));

  console.log("\n===================================");
  const allOk = checks.every(Boolean);
  console.log(allOk ? "ALL CONSISTENCY CHECKS PASSED" : "SOME CHECKS FAILED — see above");
  await pool.end();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Consistency check crashed:", err);
  process.exit(1);
});
