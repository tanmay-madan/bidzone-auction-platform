-- Migration 006: photos uploaded for auction listings.
-- Stored in PostgreSQL so they survive redeploys on hosts with
-- temporary disks (e.g. Render's free tier). Purely additive.
CREATE TABLE IF NOT EXISTS images (
  id          SERIAL PRIMARY KEY,
  uploader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mime_type   VARCHAR(20) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes  INTEGER NOT NULL CHECK (size_bytes > 0),
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_images_uploader ON images (uploader_id);
