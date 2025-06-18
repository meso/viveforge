-- Create app_settings table for application configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME NOT NULL
);

-- Insert default settings
INSERT INTO app_settings (key, value, updated_at) VALUES
  ('app_name', 'My Vibebase App', datetime('now') || 'Z'),
  ('app_url', '', datetime('now') || 'Z'),
  ('support_email', '', datetime('now') || 'Z'),
  ('app_description', '', datetime('now') || 'Z');

-- Create index for faster lookups
CREATE INDEX idx_app_settings_key ON app_settings(key);