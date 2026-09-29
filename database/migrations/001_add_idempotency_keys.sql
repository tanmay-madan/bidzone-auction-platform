-- Migration 001: idempotency support for bid submissions.
-- Safe to run against an existing bidzone database — purely additive,
-- no existing tables or data are touched.

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
