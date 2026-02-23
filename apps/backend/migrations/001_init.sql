-- migrations/001_init.sql
-- Initial schema for self-app backend

CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    spec TEXT NOT NULL,         -- JSON module definition
    status TEXT NOT NULL DEFAULT 'active',
    vitality_score REAL DEFAULT 0,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_core (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    category TEXT,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_episodic (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding BLOB,            -- sqlite-vec vector (384 dimensions, added later)
    module_id TEXT,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS llm_usage (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_estimate REAL,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL
);

INSERT INTO schema_version (version) VALUES (1);
