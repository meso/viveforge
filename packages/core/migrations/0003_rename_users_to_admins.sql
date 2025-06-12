-- Rename system users table to admins
ALTER TABLE users RENAME TO admins;

-- Create new users table for application users
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Update items table to reference the new users table
-- First, drop the existing foreign key constraint by recreating the table
CREATE TABLE items_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Copy data from old items table
INSERT INTO items_new (id, name, description, user_id, created_at, updated_at)
SELECT id, name, description, user_id, created_at, updated_at FROM items;

-- Drop old table and rename new one
DROP TABLE items;
ALTER TABLE items_new RENAME TO items;

-- Insert some sample data
INSERT INTO users (email, name) VALUES 
  ('user1@example.com', 'Sample User 1'),
  ('user2@example.com', 'Sample User 2');

-- Get the first user's ID for sample items
INSERT INTO items (name, description, user_id) 
SELECT 
  'Sample Item ' || (rowid + 1),
  'This is a sample item for demonstration',
  (SELECT id FROM users WHERE email = 'user1@example.com')
FROM (SELECT 0 as rowid UNION SELECT 1 UNION SELECT 2);