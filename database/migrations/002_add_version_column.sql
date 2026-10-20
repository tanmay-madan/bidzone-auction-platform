-- Migration 002: Add version column to auctions table for optimistic concurrency control.
-- Purely additive — existing auctions start at version = 0.
-- Required for the exclusive signature benchmark (pessimistic vs. optimistic concurrency).

ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
