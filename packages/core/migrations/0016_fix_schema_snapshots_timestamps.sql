-- Fix schema_snapshots timestamps to use proper ISO8601 format
-- Convert any existing timestamps from 'YYYY-MM-DD HH:mm:ss' to 'YYYY-MM-DDTHH:mm:SSZ'

UPDATE schema_snapshots 
SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at)
WHERE created_at NOT LIKE '%Z' 
  AND created_at NOT LIKE '%T%Z'
  AND length(created_at) = 19;  -- Standard SQLite timestamp format 'YYYY-MM-DD HH:mm:ss'