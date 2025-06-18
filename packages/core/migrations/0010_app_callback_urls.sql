-- Add allowed callback URLs setting to app_settings
-- This stores the list of allowed URLs where users can be redirected after authentication

-- Insert the new setting with default value (empty array)
INSERT OR IGNORE INTO app_settings (key, value, description, created_at, updated_at)
VALUES (
  'allowed_callback_urls',
  '[]',
  'List of allowed callback URLs for redirecting users after authentication. Supports web URLs (https://), mobile deep links (myapp://), and localhost for development.',
  datetime('now'),
  datetime('now')
);