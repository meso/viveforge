-- Vibebase 初期化SQL
-- Deploy Button でのデプロイ時に自動実行されます

-- 管理者テーブル
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'github',
  provider_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

-- セッションテーブル
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  admin_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

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

-- セットアップ状況管理テーブル
CREATE TABLE IF NOT EXISTS setup_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  github_oauth_configured BOOLEAN DEFAULT FALSE,
  cloudflare_access_configured BOOLEAN DEFAULT FALSE,
  first_admin_registered BOOLEAN DEFAULT FALSE,
  setup_completed_at DATETIME,
  deploy_method TEXT DEFAULT 'deploy-button',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初期セットアップ状況を挿入
INSERT OR IGNORE INTO setup_status (id, deploy_method) VALUES (1, 'deploy-button');