-- Add realtime hooks and event queue support
-- This migration adds tables for managing realtime data change notifications

-- Table for defining hooks on data changes
CREATE TABLE IF NOT EXISTS hooks (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  -- Create index for quick lookup by table name
  UNIQUE(table_name, event_type)
);

-- Create index for efficient hook lookups
CREATE INDEX idx_hooks_table_enabled ON hooks(table_name, enabled);

-- Table for queuing events to be processed
CREATE TABLE IF NOT EXISTS event_queue (
  id TEXT PRIMARY KEY,
  hook_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  event_data TEXT NOT NULL, -- JSON format containing the record data
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  processed_at DATETIME,
  FOREIGN KEY (hook_id) REFERENCES hooks(id) ON DELETE CASCADE
);

-- Create indexes for event queue processing
CREATE INDEX idx_event_queue_unprocessed ON event_queue(processed, created_at) WHERE processed = false;
CREATE INDEX idx_event_queue_hook ON event_queue(hook_id, processed);

-- Table for managing realtime subscriptions
CREATE TABLE IF NOT EXISTS realtime_subscriptions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  table_name TEXT,
  hook_id TEXT,
  user_id TEXT,
  filter_owner BOOLEAN NOT NULL DEFAULT false, -- Whether to filter by owner_id
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  expires_at DATETIME,
  FOREIGN KEY (hook_id) REFERENCES hooks(id) ON DELETE CASCADE
);

-- Create indexes for subscription management
CREATE INDEX idx_realtime_subscriptions_client ON realtime_subscriptions(client_id);
CREATE INDEX idx_realtime_subscriptions_table ON realtime_subscriptions(table_name) WHERE table_name IS NOT NULL;
CREATE INDEX idx_realtime_subscriptions_expires ON realtime_subscriptions(expires_at) WHERE expires_at IS NOT NULL;