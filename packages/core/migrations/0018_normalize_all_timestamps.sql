-- Normalize all timestamp columns to proper ISO8601 format with Z suffix
-- This handles timestamps that were saved without timezone information

-- Update users table
UPDATE users 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at),
    last_login_at = CASE 
      WHEN last_login_at IS NOT NULL AND last_login_at NOT LIKE '%Z' AND last_login_at NOT LIKE '%T%Z' AND length(last_login_at) = 19 
      THEN strftime('%Y-%m-%dT%H:%M:%SZ', last_login_at)
      ELSE last_login_at
    END
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19)
   OR (last_login_at IS NOT NULL AND last_login_at NOT LIKE '%Z' AND last_login_at NOT LIKE '%T%Z' AND length(last_login_at) = 19);

-- Update items table
UPDATE items 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);

-- Update messages table  
UPDATE messages 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);

-- Update admins table
UPDATE admins 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);

-- Update api_keys table
UPDATE api_keys 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    expires_at = CASE 
      WHEN expires_at IS NOT NULL AND expires_at NOT LIKE '%Z' AND expires_at NOT LIKE '%T%Z' AND length(expires_at) = 19 
      THEN strftime('%Y-%m-%dT%H:%M:%SZ', expires_at)
      ELSE expires_at
    END,
    last_used_at = CASE 
      WHEN last_used_at IS NOT NULL AND last_used_at NOT LIKE '%Z' AND last_used_at NOT LIKE '%T%Z' AND length(last_used_at) = 19 
      THEN strftime('%Y-%m-%dT%H:%M:%SZ', last_used_at)
      ELSE last_used_at
    END
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (expires_at IS NOT NULL AND expires_at NOT LIKE '%Z' AND expires_at NOT LIKE '%T%Z' AND length(expires_at) = 19)
   OR (last_used_at IS NOT NULL AND last_used_at NOT LIKE '%Z' AND last_used_at NOT LIKE '%T%Z' AND length(last_used_at) = 19);

-- Update other system tables with timestamp columns
UPDATE user_sessions 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    expires_at = strftime('%Y-%m-%dT%H:%M:%SZ', expires_at),
    last_used_at = CASE 
      WHEN last_used_at IS NOT NULL AND last_used_at NOT LIKE '%Z' AND last_used_at NOT LIKE '%T%Z' AND length(last_used_at) = 19 
      THEN strftime('%Y-%m-%dT%H:%M:%SZ', last_used_at)
      ELSE last_used_at
    END
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (expires_at NOT LIKE '%Z' AND expires_at NOT LIKE '%T%Z' AND length(expires_at) = 19)
   OR (last_used_at IS NOT NULL AND last_used_at NOT LIKE '%Z' AND last_used_at NOT LIKE '%T%Z' AND length(last_used_at) = 19);

-- Update user-created tables (handle them individually to avoid errors)
-- Update hoge table (if it exists and has the columns)
UPDATE hoge 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);

-- Update eeee table (if it exists and has the columns)
UPDATE eeee 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);

-- Update history table (if it exists and has the columns)
UPDATE history 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);

-- Update www table (if it exists and has the columns)
UPDATE www 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)
WHERE (created_at NOT LIKE '%Z' AND created_at NOT LIKE '%T%Z' AND length(created_at) = 19)
   OR (updated_at NOT LIKE '%Z' AND updated_at NOT LIKE '%T%Z' AND length(updated_at) = 19);