-- BidZone database schema
-- This file lays out the full schema now so the structure is settled
-- early, even though the app itself is built up phase by phase.
-- Money is NUMERIC, never FLOAT, to avoid rounding errors on bids.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auctions (
  id                        SERIAL PRIMARY KEY,
  seller_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                     VARCHAR(200) NOT NULL,
  description               TEXT NOT NULL DEFAULT '',
  image_url                 TEXT,
  starting_price            NUMERIC(12, 2) NOT NULL CHECK (starting_price >= 0),
  current_highest_bid       NUMERIC(12, 2) NOT NULL,
  current_highest_bidder_id INTEGER REFERENCES users(id),
  min_increment             NUMERIC(12, 2) NOT NULL CHECK (min_increment > 0),
  starts_at                 TIMESTAMPTZ NOT NULL,
  ends_at                   TIMESTAMPTZ NOT NULL,
  status                    VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS bids (
  id         SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id  INTEGER NOT NULL REFERENCES users(id),
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status     VARCHAR(20) NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
  reason     VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes for the queries the app will run most often.
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_seller ON auctions(seller_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_id);

-- Idempotency support: lets a client safely retry a bid submission
-- (e.g. after a dropped connection) with the same key and get back
-- the original result instead of creating a second bid. See
-- database/migrations/001_add_idempotency_keys.sql for the standalone
-- migration if you already have a bidzone database without this table.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id           SERIAL PRIMARY KEY,
  idem_key     VARCHAR(100) NOT NULL,
  bidder_id    INTEGER NOT NULL REFERENCES users(id),
  auction_id   INTEGER NOT NULL REFERENCES auctions(id),
  status_code  INTEGER NOT NULL,
  response     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idem_key, bidder_id, auction_id)
);
