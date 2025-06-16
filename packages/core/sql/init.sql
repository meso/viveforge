-- Vibebase 初期化SQL
-- Deploy Button でのデプロイ時に自動実行されます

-- スキーマスナップショット管理
CREATE TABLE IF NOT EXISTS schema_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  full_schema TEXT NOT NULL,
  tables_json TEXT NOT NULL,
  schema_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  snapshot_type TEXT DEFAULT 'manual',
  d1_bookmark_id TEXT
);

-- スキーマバージョン管理
CREATE TABLE IF NOT EXISTS schema_snapshot_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_version INTEGER DEFAULT 0
);

-- 初期バージョンを挿入
INSERT OR IGNORE INTO schema_snapshot_counter (id, current_version) VALUES (1, 0);