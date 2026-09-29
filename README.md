# BidZone

A full-stack real-time auction platform designed to maintain consistent
bidding state under concurrent requests using database-level concurrency
control.

**Technical highlight:** atomic, concurrency-safe bidding with PostgreSQL
transactions and row-level locking (`SELECT ... FOR UPDATE`), with a
planned optimistic-vs-pessimistic concurrency benchmark.

## Status: Fully working MVP

Everything below is implemented and tested end-to-end:

- Register / login (JWT + bcrypt)
- Create, list, view, edit, delete auctions
- Browse with search + sort, My Auctions, My Bids
- **Concurrency-safe bidding** via PostgreSQL `SELECT ... FOR UPDATE`
  inside a transaction — verified with a 5-scenario test suite: 50
  simultaneous identical bids (1 accepted / 49 rejected), varied
  simultaneous bids, sequential bidding, closing-time enforcement, and
  duplicate-submission idempotency
- Optional `Idempotency-Key` header on bid submissions — a retried
  request with the same key replays the original result instead of
  creating a second bid
- Server-clock-authoritative closing time (frontend countdown is
  cosmetic only)
- A read-only `consistency-check.js` script that independently
  verifies auction/bid invariants straight from the database

Not implemented (intentionally, per the brief's phased priority —
optional/advanced, build only if you want to extend it further):
WebSocket live updates, anti-sniping, optimistic-concurrency
benchmarking, proxy bidding.

## Project structure

```text
auction-platform/
├── frontend/     React + Vite + Tailwind CSS
├── backend/      Node.js + Express + PostgreSQL (pg)
└── database/     schema.sql, seed.sql
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or reachable via the `DB_*` env vars)

## Setup

### 1. Database

```bash
createdb bidzone
psql -d bidzone -f database/schema.sql
```

Already have a `bidzone` database from an earlier version? Just apply
the one additive migration instead of recreating anything:

```bash
psql -d bidzone -f database/migrations/001_add_idempotency_keys.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # edit if your Postgres credentials differ
npm install
npm run dev
```

The API starts on `http://localhost:5000`. Check it with:

```bash
curl http://localhost:5000/api/health
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # only needed if your backend isn't on :5000
npm install
npm run dev
```

The app starts on `http://localhost:5173`. The homepage shows a
"Backend connected" indicator once both servers are running.

### 4. Run the tests

With the backend running (and its `.env` pointed at your DB):

```bash
cd backend
node scripts/concurrency-test.js   # 5 scenarios: see below
node scripts/consistency-check.js  # read-only DB invariant check
```

`concurrency-test.js` runs, against the real API and real database:

1. **50 identical simultaneous bids** — expects exactly 1 accepted, 49 `BID_TOO_LOW`
2. **Varied simultaneous bids** (₹11k/12k/13k) — expects the final highest bid to be ₹13,000
3. **Sequential bidding** — accept → reject-too-low → accept, checking each step
4. **Closing time** — a bid just before `ends_at` is accepted, one after is rejected with `AUCTION_CLOSED`
5. **Duplicate submission** — the same `Idempotency-Key` retried twice returns the identical result and creates only one bid record

`consistency-check.js` independently verifies, straight from the
database, that: the stored highest bid matches the highest accepted
bid; the highest bidder matches that bid; no accepted bid falls
outside its auction's time window; every accepted bid respects the
minimum-increment rule versus the one before it; and every bid
references a real user and auction.

Expected output for both: every line prefixed `✓`, ending in `ALL
TESTS PASSED` / `ALL CONSISTENCY CHECKS PASSED`.

## Tech stack

- **Frontend:** React, React Router, Axios, Tailwind CSS
- **Backend:** Express, `pg`, JWT, bcrypt, dotenv, CORS
- **Database:** PostgreSQL

## Roadmap

1. ~~Project setup~~ ✅
2. ~~Basic backend (schema + health check)~~ ✅
3. ~~Authentication (register, login, JWT)~~ ✅
4. ~~Auction CRUD~~ ✅
5. ~~Basic bidding~~ ✅
6. ~~Concurrency-safe bidding (`SELECT FOR UPDATE`)~~ ✅ ⭐
7. ~~Frontend pages (browse, details, create, my auctions/bids)~~ ✅
8. ~~Frontend–backend integration~~ ✅
9. ~~Concurrency test harness~~ ✅ (`backend/scripts/concurrency-test.js`)
10. Advanced (optional, not built): optimistic concurrency benchmark,
    WebSockets, anti-sniping, proxy bidding
