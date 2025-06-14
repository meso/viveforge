-- Schema snapshots table for tracking database schema history
CREATE TABLE schema_snapshots (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  name TEXT,  -- Optional user-friendly name
  description TEXT,  -- Optional description of changes
  
  -- Schema data
  full_schema TEXT NOT NULL,  -- Complete CREATE statements
  tables_json TEXT NOT NULL,  -- Detailed table information as JSON
  schema_hash TEXT NOT NULL,  -- Hash for quick comparison
  
  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,  -- Admin ID who created the snapshot
  snapshot_type TEXT DEFAULT 'manual',  -- 'manual', 'auto', 'pre_change'
  
  -- D1 Time Travel integration (optional)
  d1_bookmark_id TEXT,  -- D1 bookmark for this snapshot
  
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- Index for efficient queries
CREATE INDEX idx_schema_snapshots_version ON schema_snapshots(version DESC);
CREATE INDEX idx_schema_snapshots_created_at ON schema_snapshots(created_at DESC);

-- Auto-increment version counter
CREATE TABLE schema_snapshot_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Ensure only one row
  current_version INTEGER DEFAULT 0
);