-- Add custom SQL queries functionality
-- This migration adds tables for managing custom SQL queries that can be exposed as APIs

-- Table for storing custom SQL queries
CREATE TABLE IF NOT EXISTS custom_queries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier for the API endpoint
  name TEXT NOT NULL,
  description TEXT,
  sql_query TEXT NOT NULL, -- The SQL query with parameter placeholders (:param_name)
  parameters TEXT NOT NULL DEFAULT '[]', -- JSON array of parameter definitions
  method TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET', 'POST')),
  is_readonly BOOLEAN NOT NULL DEFAULT true, -- Whether the query only reads data
  cache_ttl INTEGER DEFAULT 0, -- Cache time-to-live in seconds (0 = no cache)
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for efficient lookups
CREATE INDEX idx_custom_queries_slug ON custom_queries(slug) WHERE enabled = true;
CREATE INDEX idx_custom_queries_enabled ON custom_queries(enabled);

-- Table for tracking custom query execution logs (optional, for analytics)
CREATE TABLE IF NOT EXISTS custom_query_logs (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  execution_time INTEGER NOT NULL, -- Time taken to execute in milliseconds
  row_count INTEGER NOT NULL,
  parameters TEXT, -- JSON of actual parameters used
  error TEXT, -- Error message if query failed
  executed_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (query_id) REFERENCES custom_queries(id) ON DELETE CASCADE
);

-- Create index for log lookups
CREATE INDEX idx_custom_query_logs_query ON custom_query_logs(query_id, executed_at);

-- Add custom_queries to system tables by updating table_policies
INSERT OR IGNORE INTO table_policies (table_name, access_policy)
VALUES 
  ('custom_queries', 'private'),
  ('custom_query_logs', 'private');