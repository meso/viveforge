-- Add owner_id column to users table for self-referencing access control
-- This allows users to only access their own user record

-- Check if users table exists and add owner_id column
-- In a user table, owner_id should reference the user's own ID
ALTER TABLE users ADD COLUMN owner_id TEXT;

-- Set owner_id to the user's own ID for existing users
UPDATE users SET owner_id = id WHERE owner_id IS NULL;