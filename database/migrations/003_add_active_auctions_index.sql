-- Migration 003: Partial composite index on active auctions for fast catalog browsing.
-- Eliminates Sequential Scan + Top-N Heapsort on large datasets.

CREATE INDEX IF NOT EXISTS idx_auctions_active_ending_soon
ON auctions (ends_at ASC)
WHERE status = 'ACTIVE';
