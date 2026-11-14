-- Migration 004: Phase 1 — notifications + exactly-once settlement marker.
-- Purely additive: no existing rows or columns are changed.

-- settled_at is set once, by the settlement worker, when the winner is
-- recorded and notified. Status alone isn't enough: a late bid can flip
-- status to CLOSED before the worker ever runs, which would skip the
-- winner notification.
ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Partial index so the scheduler's "find unsettled expired auctions"
-- sweep stays cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_auctions_unsettled
ON auctions (ends_at)
WHERE settled_at IS NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auction_id  INTEGER REFERENCES auctions(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL
                CHECK (type IN ('OUTBID', 'NEW_BID', 'AUCTION_WON', 'AUCTION_SOLD', 'AUCTION_UNSOLD', 'AUCTION_LOST')),
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
ON notifications (user_id, created_at DESC);
