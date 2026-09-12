// Reproducible concurrency test harness (Section 25 of the brief).
// Usage: node scripts/concurrency-test.js
//
// Creates a fresh auction, then fires N concurrent identical bids at
// it and verifies exactly one is accepted and the final highest bid
// matches, proving the row-level lock prevents lost updates.

const BASE = process.env.API_URL || "http://localhost:5000/api";
const CONCURRENT_BIDS = 50;
const STARTING_PRICE = 10000;
const MIN_INCREMENT = 1000;
const BID_AMOUNT = 11000;

async function registerOrLogin(email, name) {
  let res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: "password123" }),
  });
  if (res.status === 409) {
    res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
  }
  const data = await res.json();
  return data.token;
}

async function main() {
  console.log(`Concurrency test: ${CONCURRENT_BIDS} simultaneous bids of ${BID_AMOUNT}`);
  console.log(`Starting bid: ${STARTING_PRICE}, min increment: ${MIN_INCREMENT}\n`);

  const sellerToken = await registerOrLogin("seller-concurrency@test.com", "Concurrency Seller");

  const auctionRes = await fetch(`${BASE}/auctions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      title: "Concurrency Test Item",
      description: "Used to verify lost-update safety",
      starting_price: STARTING_PRICE,
      min_increment: MIN_INCREMENT,
      starts_at: new Date(Date.now() - 60_000).toISOString(),
      ends_at: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
  const { id: auctionId } = await auctionRes.json();
  console.log(`Created auction #${auctionId}`);

  // Register N distinct bidders up front (bidding on your own auction
  // is blocked, and a real test should model N different users).
  const bidderTokens = [];
  for (let i = 0; i < CONCURRENT_BIDS; i++) {
    const token = await registerOrLogin(`bidder-${i}@test.com`, `Bidder ${i}`);
    bidderTokens.push(token);
  }

  const start = Date.now();
  const results = await Promise.all(
    bidderTokens.map((token) =>
      fetch(`${BASE}/auctions/${auctionId}/bids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: BID_AMOUNT }),
      }).then((r) => r.json().then((body) => ({ status: r.status, body })))
    )
  );
  const elapsed = Date.now() - start;

  const accepted = results.filter((r) => r.status === 201);
  const rejected = results.filter((r) => r.status === 409);

  const finalAuctionRes = await fetch(`${BASE}/auctions/${auctionId}`);
  const { auction } = await finalAuctionRes.json();

  console.log(`\nSent ${CONCURRENT_BIDS} concurrent bids in ${elapsed}ms`);
  console.log(`Accepted: ${accepted.length}`);
  console.log(`Rejected: ${rejected.length}`);
  console.log(`Final highest bid in DB: ${auction.current_highest_bid}`);

  const consistent =
    accepted.length === 1 &&
    rejected.length === CONCURRENT_BIDS - 1 &&
    Number(auction.current_highest_bid) === BID_AMOUNT;

  console.log(`Database consistent: ${consistent ? "YES" : "NO"}`);

  if (!consistent) {
    console.error("\nFAILED — lost update or inconsistent state detected.");
    process.exit(1);
  }
  console.log("\nPASSED — exactly one bid committed, no lost updates.");
}

main().catch((err) => {
  console.error("Test harness error:", err);
  process.exit(1);
});
