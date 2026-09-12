# BidZone

A full-stack real-time auction platform designed to maintain consistent
bidding state under concurrent requests using database-level concurrency
control.

**Technical highlight:** atomic, concurrency-safe bidding with PostgreSQL
transactions and row-level locking (`SELECT ... FOR UPDATE`), with a
planned optimistic-vs-pessimistic concurrency benchmark.

## Status: Phase 1 — Project Setup

This phase only proves the three pieces of the stack are wired together:

- React (Vite) frontend renders a working homepage.
- Express backend runs and exposes a health-check endpoint.
- The backend reports whether it can currently reach PostgreSQL.

No authentication, bidding, or concurrency logic exists yet — that comes
in later phases.

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

## Tech stack

- **Frontend:** React, React Router, Axios, Tailwind CSS
- **Backend:** Express, `pg`, JWT, bcrypt, dotenv, CORS
- **Database:** PostgreSQL

## Roadmap

1. ~~Project setup~~ ✅
2. Basic backend (schema + health check) ✅
3. Authentication (register, login, JWT)
4. Auction CRUD
5. Basic bidding
6. Concurrency-safe bidding (`SELECT FOR UPDATE`) ⭐
7. Frontend pages (browse, details, create, my auctions/bids)
8. Frontend–backend integration
9. Concurrency and consistency test harness
10. Advanced: optimistic concurrency benchmark, WebSockets, anti-sniping
