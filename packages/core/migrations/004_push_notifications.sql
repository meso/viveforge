-- Push notification tables for Web Push and FCM support

-- Push subscriptions (supports both Web Push and FCM)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('webpush', 'fcm')),
  
  -- Web Push specific fields
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT,
  
  -- FCM specific fields
  fcm_token TEXT,
  
  -- Common fields
  device_info TEXT, -- JSON containing OS, browser, app version, etc.
  platform TEXT CHECK (platform IN ('web', 'ios', 'android', 'desktop')),
  active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique subscriptions per user
  UNIQUE(user_id, endpoint),
  UNIQUE(user_id, fcm_token)
);

-- Notification rules
CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('db_change', 'api')),
  
  -- DB trigger settings
  table_name TEXT,
  event_type TEXT CHECK (event_type IN ('insert', 'update', 'delete')),
  conditions TEXT, -- JSON format conditions
  
  -- Recipient settings
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('specific_user', 'column_reference', 'all_users')),
  recipient_value TEXT, -- user_id or column name
  
  -- Notification content
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  icon_url TEXT,
  image_url TEXT, -- For rich notifications
  click_action TEXT,
  
  -- Platform-specific settings
  platform_config TEXT, -- JSON for iOS/Android specific settings
  
  -- Delivery settings
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  ttl INTEGER DEFAULT 86400, -- Time to live in seconds
  
  enabled INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates for reuse
CREATE TABLE IF NOT EXISTS notification_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon_url TEXT,
  image_url TEXT,
  platform_overrides TEXT, -- JSON for platform-specific overrides
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  rule_id TEXT,
  template_id TEXT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('webpush', 'fcm')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (rule_id) REFERENCES notification_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON notification_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_notification_rules_trigger ON notification_rules(trigger_type, table_name, event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);