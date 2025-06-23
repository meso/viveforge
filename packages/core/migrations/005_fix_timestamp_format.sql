-- Fix timestamp format to use ISO8601 format (YYYY-MM-DDTHH:MM:SSZ)

-- Update existing notification_logs timestamps
UPDATE notification_logs 
SET created_at = datetime(created_at) || 'Z'
WHERE created_at NOT LIKE '%Z' AND created_at IS NOT NULL;

UPDATE notification_logs 
SET sent_at = datetime(sent_at) || 'Z'
WHERE sent_at NOT LIKE '%Z' AND sent_at IS NOT NULL;

-- Update existing push_subscriptions timestamps  
UPDATE push_subscriptions 
SET created_at = datetime(created_at) || 'Z'
WHERE created_at NOT LIKE '%Z' AND created_at IS NOT NULL;

UPDATE push_subscriptions 
SET updated_at = datetime(updated_at) || 'Z'
WHERE updated_at NOT LIKE '%Z' AND updated_at IS NOT NULL;

-- Update existing notification_rules timestamps
UPDATE notification_rules 
SET created_at = datetime(created_at) || 'Z'
WHERE created_at NOT LIKE '%Z' AND created_at IS NOT NULL;

UPDATE notification_rules 
SET updated_at = datetime(updated_at) || 'Z'
WHERE updated_at NOT LIKE '%Z' AND updated_at IS NOT NULL;

-- Update existing notification_templates timestamps
UPDATE notification_templates 
SET created_at = datetime(created_at) || 'Z'
WHERE created_at NOT LIKE '%Z' AND created_at IS NOT NULL;

UPDATE notification_templates 
SET updated_at = datetime(updated_at) || 'Z'
WHERE updated_at NOT LIKE '%Z' AND updated_at IS NOT NULL;