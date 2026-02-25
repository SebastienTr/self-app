-- migrations/003_add_refresh_metadata.sql
-- Add refresh tracking columns to modules table for cron-based background refresh (Story 4-1)

ALTER TABLE modules ADD COLUMN last_refreshed_at TEXT;

ALTER TABLE modules ADD COLUMN last_refresh_error TEXT;

INSERT INTO schema_version (version) VALUES (3);
