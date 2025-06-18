-- Add user authentication support
-- Extends existing users table and adds session management

-- Extend users table with OAuth authentication fields
ALTER TABLE users ADD COLUMN provider TEXT;
ALTER TABLE users ADD COLUMN provider_id TEXT;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN metadata TEXT; -- JSON: provider-specific data
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Create composite unique constraint for provider + provider_id
CREATE UNIQUE INDEX idx_users_provider_id ON users(provider, provider_id);

-- User sessions table for token management
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- OAuth provider configuration table (managed by admins)
CREATE TABLE oauth_providers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT UNIQUE NOT NULL, -- 'google', 'github', 'facebook', etc.
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- Will be encrypted in application layer
  is_enabled BOOLEAN DEFAULT false,
  scopes TEXT, -- JSON array: ['openid', 'email', 'profile']
  redirect_uri TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Update existing sample users with OAuth provider info
-- (These are the sample users from migration 0003)
UPDATE users SET 
  provider = 'github',
  provider_id = '12345678',
  role = 'user',
  is_active = true
WHERE email = 'user@example.com';

UPDATE users SET 
  provider = 'google', 
  provider_id = '87654321',
  role = 'user', 
  is_active = true
WHERE email = 'john@example.com';