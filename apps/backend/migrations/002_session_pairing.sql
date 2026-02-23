-- migrations/002_session_pairing.sql
-- Add is_pairing column to sessions table for pairing token support

ALTER TABLE sessions ADD COLUMN is_pairing INTEGER DEFAULT 0;

INSERT INTO schema_version (version) VALUES (2);
