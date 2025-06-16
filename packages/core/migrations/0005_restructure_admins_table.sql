-- Restructure admins table for GitHub-only authentication
-- Drop existing admins table and recreate with simplified schema

DROP TABLE admins;

CREATE TABLE admins (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  github_id INTEGER UNIQUE NOT NULL,
  is_root BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);