-- Vibebase Consolidated Database Schema
-- This file contains all database migrations combined into a single schema definition

-- ============================
-- System Tables
-- ============================

-- Admins table (System administrators)
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  github_username TEXT UNIQUE NOT NULL,
  github_id TEXT UNIQUE,
  is_root BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API Keys for programmatic access
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT,
  scopes TEXT NOT NULL DEFAULT 'read,write',
  created_by TEXT,
  expires_at DATETIME,
  last_used_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for admin authentication
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email) REFERENCES admins(email) ON DELETE CASCADE
);

-- OAuth provider configuration
CREATE TABLE oauth_providers (
  id TEXT PRIMARY KEY,
  provider TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  scopes TEXT,
  redirect_uri TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Application settings
CREATE TABLE app_settings (
  id TEXT PRIMARY KEY,
  app_name TEXT,
  app_url TEXT,
  support_email TEXT,
  oauth_user_agent TEXT,
  callback_urls TEXT,
  worker_domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table access policies
CREATE TABLE table_policies (
  id TEXT PRIMARY KEY,
  table_name TEXT UNIQUE NOT NULL,
  access_policy TEXT NOT NULL DEFAULT 'public' CHECK (access_policy IN ('public', 'private')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Schema snapshots for migration tracking
CREATE TABLE schema_snapshots (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  name TEXT,
  description TEXT,
  full_schema TEXT,
  tables_json TEXT,
  schema_hash TEXT,
  created_by TEXT,
  snapshot_type TEXT DEFAULT 'manual',
  d1_bookmark_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schema_snapshot_counter (
  id TEXT PRIMARY KEY,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom queries
CREATE TABLE custom_queries (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sql_query TEXT NOT NULL,
  parameters TEXT,
  method TEXT DEFAULT 'GET' CHECK (method IN ('GET', 'POST')),
  is_readonly BOOLEAN DEFAULT true,
  cache_ttl INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom query execution logs
CREATE TABLE custom_query_logs (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  execution_time INTEGER NOT NULL,
  row_count INTEGER DEFAULT 0,
  parameters TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (query_id) REFERENCES custom_queries(id) ON DELETE CASCADE
);

-- ============================
-- Realtime & Notification Tables
-- ============================

-- Hooks for realtime data changes
CREATE TABLE hooks (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(table_name, event_type)
);

-- Event queue for processing
CREATE TABLE event_queue (
  id TEXT PRIMARY KEY,
  hook_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  event_data TEXT NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hook_id) REFERENCES hooks(id) ON DELETE CASCADE
);

-- Realtime subscriptions
CREATE TABLE realtime_subscriptions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  table_name TEXT,
  hook_id TEXT,
  user_id TEXT,
  filter_owner BOOLEAN NOT NULL DEFAULT false,
  expires_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hook_id) REFERENCES hooks(id) ON DELETE CASCADE
);

-- Push subscriptions
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('webpush', 'fcm')),
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT,
  fcm_token TEXT,
  device_info TEXT,
  platform TEXT CHECK (platform IN ('web', 'ios', 'android', 'desktop')),
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, endpoint),
  UNIQUE(user_id, fcm_token)
);

-- Notification rules
CREATE TABLE notification_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('db_change', 'api')),
  table_name TEXT,
  event_type TEXT CHECK (event_type IN ('insert', 'update', 'delete')),
  conditions TEXT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('specific_user', 'column_reference', 'all_users')),
  recipient_value TEXT,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  icon_url TEXT,
  image_url TEXT,
  click_action TEXT,
  platform_config TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  ttl INTEGER DEFAULT 86400,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates
CREATE TABLE notification_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon_url TEXT,
  image_url TEXT,
  platform_overrides TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification logs
CREATE TABLE notification_logs (
  id TEXT PRIMARY KEY,
  rule_id TEXT,
  template_id TEXT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('webpush', 'fcm')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES notification_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE SET NULL
);

-- VAPID configuration storage
CREATE TABLE vapid_config (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- User Data Tables
-- ============================

-- Application users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT,
  provider_id TEXT,
  role TEXT DEFAULT 'user',
  metadata TEXT,
  last_login_at DATETIME,
  is_active BOOLEAN DEFAULT true,
  owner_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for authentication
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sample items table for demonstration
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================
-- Indexes for Performance
-- ============================

-- Admin and auth indexes
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE UNIQUE INDEX idx_users_provider_id ON users(provider, provider_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- API key indexes
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Realtime indexes
CREATE INDEX idx_hooks_table_enabled ON hooks(table_name, enabled);
CREATE INDEX idx_event_queue_unprocessed ON event_queue(processed, created_at) WHERE processed = false;
CREATE INDEX idx_event_queue_hook ON event_queue(hook_id, processed);
CREATE INDEX idx_realtime_subscriptions_client ON realtime_subscriptions(client_id);
CREATE INDEX idx_realtime_subscriptions_table ON realtime_subscriptions(table_name) WHERE table_name IS NOT NULL;
CREATE INDEX idx_realtime_subscriptions_expires ON realtime_subscriptions(expires_at) WHERE expires_at IS NOT NULL;

-- Push notification indexes
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(active);
CREATE INDEX idx_notification_rules_enabled ON notification_rules(enabled);
CREATE INDEX idx_notification_rules_trigger ON notification_rules(trigger_type, table_name, event_type);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- Schema management indexes
CREATE INDEX idx_schema_snapshots_version ON schema_snapshots(version);

-- Custom queries indexes
CREATE INDEX idx_custom_queries_enabled ON custom_queries(is_enabled);
CREATE INDEX idx_custom_query_logs_query_id ON custom_query_logs(query_id);
CREATE INDEX idx_custom_query_logs_created_at ON custom_query_logs(created_at);

-- ============================
-- Initial Data
-- ============================

-- Sample users (5 records) - Using nanoid format for IDs
INSERT INTO users (id, email, name, avatar_url, provider, provider_id, role, is_active, owner_id) VALUES
  ('V1StGXR8_Z5jdHi6B-myT', 'alice@example.com', 'Alice Johnson', 'https://avatars.githubusercontent.com/u/1?v=4', 'github', 'gh-1001', 'user', true, 'V1StGXR8_Z5jdHi6B-myT'),
  ('3ZjkQ2mN8pX9vC7bA-wEr', 'bob@example.com', 'Bob Smith', 'https://avatars.githubusercontent.com/u/2?v=4', 'github', 'gh-1002', 'user', true, '3ZjkQ2mN8pX9vC7bA-wEr'),
  ('LpH9mKj2nQ4vX8cD-zFgR', 'charlie@example.com', 'Charlie Brown', 'https://avatars.githubusercontent.com/u/3?v=4', 'google', 'g-2001', 'user', true, 'LpH9mKj2nQ4vX8cD-zFgR'),
  ('9RdY3kW7pM5sT2nJ-qBvX', 'diana@example.com', 'Diana Prince', 'https://avatars.githubusercontent.com/u/4?v=4', 'github', 'gh-1003', 'user', true, '9RdY3kW7pM5sT2nJ-qBvX'),
  ('K4fN6zP1mR8hL3sW-tCvB', 'edward@example.com', 'Edward Norton', 'https://avatars.githubusercontent.com/u/5?v=4', 'google', 'g-2002', 'user', true, 'K4fN6zP1mR8hL3sW-tCvB');

-- Sample items (5 records) - Using nanoid format for IDs and user references
INSERT INTO items (id, name, description, user_id) VALUES
  ('A2kF8mR9vN4pX7sD-qBwZ', 'Todo List App', 'A simple todo list application with React', 'V1StGXR8_Z5jdHi6B-myT'),
  ('G6hM3nP2kQ8vC5bL-zFrY', 'Weather Widget', 'Real-time weather display widget', 'V1StGXR8_Z5jdHi6B-myT'),
  ('T7jK9mN1pR4vX2sD-wCfB', 'Blog Platform', 'Personal blogging platform with markdown support', '3ZjkQ2mN8pX9vC7bA-wEr'),
  ('S4gL8kP6mQ9vN3cF-tBzX', 'Photo Gallery', 'Responsive photo gallery with lightbox', 'LpH9mKj2nQ4vX8cD-zFgR'),
  ('H1dW5nM3kR7pL2sQ-vCfG', 'Chat Application', 'Real-time chat app using WebSocket', '9RdY3kW7pM5sT2nJ-qBvX');

-- Initialize table policies for user tables
INSERT INTO table_policies (id, table_name, access_policy) VALUES
  ('P8mQ2nK5vR9pL4sD-wCfT', 'users', 'private'),
  ('B7jM1kN4pQ8vC3sL-zFrG', 'items', 'public');

-- Initialize app settings
INSERT INTO app_settings (id, app_name, oauth_user_agent) 
VALUES ('F5gK9mN2pR6vX1sD-qBwY', 'MyApp', 'MyApp/1.0 (Powered by Vibebase)');