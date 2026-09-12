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
  inside a transaction — verified with a scripted test that fires 50
  simultaneous identical bids and confirms exactly 1 is accepted, 49
  are rejected, and no bid is lost
- Server-clock-authoritative closing time (frontend countdown is
  cosmetic only)

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

### 4. Run the concurrency test

With the backend running (and its `.env` pointed at your DB):

```bash
cd backend
node scripts/concurrency-test.js
```

Expected output:

```text
Sent 50 concurrent bids in <N>ms
Accepted: 1
Rejected: 49
Final highest bid in DB: 11000.00
Database consistent: YES

PASSED — exactly one bid committed, no lost updates.
```

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
