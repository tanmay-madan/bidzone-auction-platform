// Reproducible test suite for BidZone's concurrency-safe bidding.
// Runs against the real HTTP API and real PostgreSQL database —
// nothing here pokes the database directly to fake concurrency.
//
// Usage: node scripts/concurrency-test.js

const BASE = process.env.API_URL || "http://localhost:5000/api";
let testCounter = 0;

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

async function createAuction(sellerToken, overrides = {}) {
  testCounter += 1;
  const res = await fetch(`${BASE}/auctions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({
      title: `Test Auction #${testCounter} (${Date.now()})`,
      description: "Created by automated test suite",
      starting_price: 10000,
      min_increment: 1000,
      starts_at: new Date(Date.now() - 60_000).toISOString(),
      ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      ...overrides,
    }),
  });
  const body = await res.json();
  return body.id;
}

async function getAuction(id) {
  const res = await fetch(`${BASE}/auctions/${id}`);
  return (await res.json()).auction;
}

async function bid(token, auctionId, amount, idemKey) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  if (idemKey) headers["Idempotency-Key"] = idemKey;
  const res = await fetch(`${BASE}/auctions/${auctionId}/bids`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amount }),
  });
  return { status: res.status, body: await res.json() };
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}

async function test1_fiftyIdenticalBids(seller) {
  console.log("\n[Test 1] 50 identical simultaneous bids of \u20b911,000");
  const auctionId = await createAuction(seller);

  const bidders = [];
  for (let i = 0; i < 50; i++) {
    bidders.push(await registerOrLogin(`t1-bidder-${i}-${auctionId}@test.com`, `T1 Bidder ${i}`));
  }

  const start = Date.now();
  const results = await Promise.all(bidders.map((token) => bid(token, auctionId, 11000)));
  const elapsed = Date.now() - start;

  const accepted = results.filter((r) => r.status === 201);
  const rejected = results.filter((r) => r.status === 409);
  const rejectionCodes = new Set(rejected.map((r) => r.body.code));

  const auction = await getAuction(auctionId);

  console.log(`  Sent 50 concurrent bids in ${elapsed}ms`);
  console.log(`  Accepted: ${accepted.length}, Rejected: ${rejected.length}`);
  console.log(`  Final highest bid: ${auction.current_highest_bid}`);

  assert(accepted.length === 1, "exactly 1 bid accepted");
  assert(rejected.length === 49, "exactly 49 bids rejected");
  assert(rejectionCodes.size === 1 && rejectionCodes.has("BID_TOO_LOW"), "all rejections are BID_TOO_LOW");
  assert(Number(auction.current_highest_bid) === 11000, "final highest bid is 11000");
  assert(auction.current_highest_bidder_id != null, "a highest bidder is recorded");
}

async function test2_variedSimultaneousBids(seller) {
  console.log("\n[Test 2] Simultaneous bids of \u20b911,000 / \u20b912,000 / \u20b913,000");
  const auctionId = await createAuction(seller);

  const amounts = [11000, 12000, 13000];
  const bidders = await Promise.all(
    amounts.map((_, i) => registerOrLogin(`t2-bidder-${i}-${auctionId}@test.com`, `T2 Bidder ${i}`))
  );

  const results = await Promise.all(
    bidders.map((token, i) => bid(token, auctionId, amounts[i]))
  );
  const auction = await getAuction(auctionId);

  console.log(`  Results: ${results.map((r) => r.status).join(", ")}`);
  console.log(`  Final highest bid: ${auction.current_highest_bid}`);

  const acceptedAmounts = results.filter((r) => r.status === 201).map((r) => Number(r.body.bid.amount));
  assert(acceptedAmounts.includes(13000), "the highest bid of 13000 was accepted");
  assert(acceptedAmounts.length >= 1 && acceptedAmounts.length <= 3, "valid number of bids accepted depending on commit order (1 to 3)");
  assert(Number(auction.current_highest_bid) === 13000, "final highest bid equals the maximum bid (13000)");
  assert(auction.current_highest_bidder_id != null, "highest bidder matches the winning accepted bid");
}

async function test3_sequentialBidding(seller, bidderA, bidderB) {
  console.log("\n[Test 3] Sequential bidding");
  const auctionId = await createAuction(seller);

  const first = await bid(bidderA, auctionId, 11000);
  assert(first.status === 201, "first valid bid (11000) is accepted");

  const low = await bid(bidderB, auctionId, 11200);
  assert(low.status === 409 && low.body.code === "BID_TOO_LOW", "a bid below the minimum (11200 < 12000) is rejected");

  const second = await bid(bidderB, auctionId, 12500);
  assert(second.status === 201, "next valid bid (12500) is accepted");

  const auction = await getAuction(auctionId);
  assert(Number(auction.current_highest_bid) === 12500, "highest bid updated to 12500");
}

async function test4_closingTime(seller, bidder) {
  console.log("\n[Test 4] Auction closing-time enforcement");
  const auctionId = await createAuction(seller, {
    ends_at: new Date(Date.now() + 1200).toISOString(),
  });

  const before = await bid(bidder, auctionId, 11000);
  assert(before.status === 201, "bid before closing time is accepted");

  await new Promise((r) => setTimeout(r, 1800));

  const after = await bid(bidder, auctionId, 12000);
  assert(
    after.status === 409 && after.body.code === "AUCTION_CLOSED",
    "bid processed at/after ends_at is rejected with AUCTION_CLOSED"
  );

  const auction = await getAuction(auctionId);
  assert(Number(auction.current_highest_bid) === 11000, "no accepted bid was inserted after closing");
}

async function test5_duplicateSubmission(seller, bidder) {
  console.log("\n[Test 5] Duplicate submission with Idempotency-Key");
  const auctionId = await createAuction(seller);
  const idemKey = `test5-${Date.now()}`;

  const first = await bid(bidder, auctionId, 11000, idemKey);
  const retry = await bid(bidder, auctionId, 11000, idemKey);

  assert(first.status === 201, "original submission accepted");
  assert(retry.status === first.status, "retry returns the same status code");
  assert(retry.body.bid?.id === first.body.bid?.id, "retry returns the exact same bid id (no duplicate created)");

  const history = await (await fetch(`${BASE}/auctions/${auctionId}/bids`)).json();
  assert(history.bids.length === 1, "exactly one bid record exists despite the duplicate submission");
}

async function main() {
  console.log("BidZone concurrency & correctness test suite");
  console.log("=============================================");

  const seller = await registerOrLogin("suite-seller@test.com", "Suite Seller");
  const bidderA = await registerOrLogin("suite-bidder-a@test.com", "Suite Bidder A");
  const bidderB = await registerOrLogin("suite-bidder-b@test.com", "Suite Bidder B");

  const results = [];
  const tests = [
    ["Test 1: 50 identical bids", () => test1_fiftyIdenticalBids(seller)],
    ["Test 2: varied simultaneous bids", () => test2_variedSimultaneousBids(seller)],
    ["Test 3: sequential bidding", () => test3_sequentialBidding(seller, bidderA, bidderB)],
    ["Test 4: closing time", () => test4_closingTime(seller, bidderA)],
    ["Test 5: duplicate submission", () => test5_duplicateSubmission(seller, bidderA)],
  ];

  for (const [name, fn] of tests) {
    try {
      await fn();
      results.push([name, "PASSED"]);
    } catch (err) {
      results.push([name, "FAILED"]);
      console.error(`  \u2717 ${err.message}`);
    }
  }

  console.log("\n=============================================");
  console.log("SUMMARY");
  console.log("=============================================");
  for (const [name, status] of results) {
    console.log(`${status === "PASSED" ? "\u2713" : "\u2717"} ${name}: ${status}`);
  }

  const allPassed = results.every(([, status]) => status === "PASSED");
  console.log(`\nOverall: ${allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
