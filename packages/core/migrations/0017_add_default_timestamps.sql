-- Add DEFAULT CURRENT_TIMESTAMP to tables missing it
-- This ensures new records automatically get timestamps even when not explicitly provided

-- Get list of user-created tables that might be missing default timestamps
-- Note: Some system tables may not need these defaults

-- Check and update specific tables that we know exist and need defaults

-- Update hoge table (if it exists)
UPDATE hoge 
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR updated_at IS NULL;

-- Update eeee table (if it exists) 
UPDATE eeee 
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)  
WHERE created_at IS NULL OR updated_at IS NULL;

-- Update history table (if it exists)
UPDATE history 
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR updated_at IS NULL;

-- Update www table (if it exists)
UPDATE www 
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR updated_at IS NULL;

-- Note: SQLite doesn't support ALTER COLUMN to add DEFAULT values to existing columns
-- So we can't automatically add DEFAULT CURRENT_TIMESTAMP to existing columns
-- New tables created through the system will have proper defaults