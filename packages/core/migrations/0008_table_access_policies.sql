-- Add access policy support to tables
-- This migration adds table-level access control for user data

-- First, create a new tables metadata table to track access policies
CREATE TABLE IF NOT EXISTS table_policies (
  table_name TEXT PRIMARY KEY,
  access_policy TEXT NOT NULL DEFAULT 'public' CHECK (access_policy IN ('public', 'private')),
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Initialize policies for existing user tables (exclude system tables)
INSERT OR IGNORE INTO table_policies (table_name, access_policy, created_at, updated_at)
SELECT 
  name,
  CASE 
    WHEN name = 'users' THEN 'private'
    ELSE 'public'
  END as access_policy,
  datetime('now') as created_at,
  datetime('now') as updated_at
FROM sqlite_master 
WHERE type = 'table' 
  AND name NOT LIKE 'sqlite_%' 
  AND name NOT IN ('admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter', 'd1_migrations', 'api_keys', 'user_sessions', 'oauth_providers', 'app_settings', 'table_policies')
  AND name != '_cf_KV';