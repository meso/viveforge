#!/usr/bin/env tsx
// Local Environment Setup for E2E Tests
// E2Eテスト用のローカル環境セットアップスクリプト

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
const testDir = resolve(__dirname, '..');

console.log('🚀 Setting up E2E test environment...\n');

// Step 1: 環境変数ファイルの作成
console.log('📝 Creating test environment file...');
const envTestPath = resolve(testDir, '.env.test');
if (!existsSync(envTestPath)) {
  const envContent = `# E2E Test Environment Variables
VIBEBASE_API_URL=http://localhost:8787
VIBEBASE_API_KEY=vb_live_test123456789012345678901234567890
CLEANUP_BEFORE_TEST=true
`;
  writeFileSync(envTestPath, envContent);
  console.log('   ✅ Created .env.test file');
} else {
  console.log('   ℹ️  .env.test already exists');
}

// Step 2: Wranglerの設定確認
console.log('\n🔧 Checking Wrangler configuration...');
try {
  execSync('wrangler --version', { stdio: 'pipe' });
  console.log('   ✅ Wrangler is installed');
} catch (error) {
  console.error('   ❌ Wrangler is not installed. Please install it with: npm install -g wrangler');
  process.exit(1);
}

// Step 3: D1データベースの作成（ローカル）
console.log('\n💾 Setting up local D1 database...');
const wranglerTomlPath = resolve(rootDir, 'packages/core/wrangler.toml');
const wranglerConfig = readFileSync(wranglerTomlPath, 'utf-8');

// データベース名を抽出
const dbNameMatch = wranglerConfig.match(/database_name\s*=\s*"([^"]+)"/);
const dbName = dbNameMatch ? dbNameMatch[1] : 'vibebase';
console.log(`   Database name: ${dbName}`);

// Step 4: SQLでインデックスとテーブルを削除
console.log('\n🧹 Dropping existing indexes and tables...');
const dropStatements = [
  // インデックスを先に削除
  'DROP INDEX IF EXISTS idx_admins_github_username;',
  'DROP INDEX IF EXISTS idx_api_keys_hash;',
  'DROP INDEX IF EXISTS idx_api_keys_active;',
  'DROP INDEX IF EXISTS idx_sessions_email;',
  'DROP INDEX IF EXISTS idx_oauth_providers_provider;',
  'DROP INDEX IF EXISTS idx_table_policies_table_name;',
  'DROP INDEX IF EXISTS idx_schema_snapshots_version;',
  'DROP INDEX IF EXISTS idx_custom_queries_name;',
  'DROP INDEX IF EXISTS idx_custom_query_logs_query_id;',
  'DROP INDEX IF EXISTS idx_hooks_table_name;',
  'DROP INDEX IF EXISTS idx_event_queue_created_at;',
  'DROP INDEX IF EXISTS idx_realtime_subscriptions_connection_id;',
  'DROP INDEX IF EXISTS idx_push_subscriptions_user_id;',
  'DROP INDEX IF EXISTS idx_notification_rules_table_name;',
  'DROP INDEX IF EXISTS idx_notification_logs_created_at;',
  'DROP INDEX IF EXISTS idx_users_email;',
  'DROP INDEX IF EXISTS idx_user_sessions_user_id;',
  'DROP INDEX IF EXISTS idx_items_created_at;',
  // テストテーブルのインデックス
  'DROP INDEX IF EXISTS idx_team_members_team_id;',
  'DROP INDEX IF EXISTS idx_team_members_user_id;',
  'DROP INDEX IF EXISTS idx_projects_team_id;',
  'DROP INDEX IF EXISTS idx_tasks_project_id;',
  'DROP INDEX IF EXISTS idx_tasks_assigned_to;',
  'DROP INDEX IF EXISTS idx_tasks_status;',
  'DROP INDEX IF EXISTS idx_task_comments_task_id;',
  'DROP INDEX IF EXISTS idx_task_attachments_task_id;',
  'DROP INDEX IF EXISTS idx_activity_logs_team_id;',
  'DROP INDEX IF EXISTS idx_activity_logs_user_id;',
  'DROP INDEX IF EXISTS idx_activity_logs_created_at;',
  
  // テーブルを削除
  'DROP TABLE IF EXISTS activity_logs;',
  'DROP TABLE IF EXISTS task_attachments;', 
  'DROP TABLE IF EXISTS task_comments;',
  'DROP TABLE IF EXISTS tasks;',
  'DROP TABLE IF EXISTS projects;',
  'DROP TABLE IF EXISTS team_members;',
  'DROP TABLE IF EXISTS teams;',
  'DROP TABLE IF EXISTS items;',
  'DROP TABLE IF EXISTS user_sessions;',
  'DROP TABLE IF EXISTS users;',
  'DROP TABLE IF EXISTS vapid_config;',
  'DROP TABLE IF EXISTS notification_logs;',
  'DROP TABLE IF EXISTS notification_templates;',
  'DROP TABLE IF EXISTS notification_rules;',
  'DROP TABLE IF EXISTS push_subscriptions;',
  'DROP TABLE IF EXISTS realtime_subscriptions;',
  'DROP TABLE IF EXISTS event_queue;',
  'DROP TABLE IF EXISTS hooks;',
  'DROP TABLE IF EXISTS custom_query_logs;',
  'DROP TABLE IF EXISTS custom_queries;',
  'DROP TABLE IF EXISTS schema_snapshot_counter;',
  'DROP TABLE IF EXISTS schema_snapshots;',
  'DROP TABLE IF EXISTS table_policies;',
  'DROP TABLE IF EXISTS app_settings;',
  'DROP TABLE IF EXISTS oauth_providers;',
  'DROP TABLE IF EXISTS sessions;',
  'DROP TABLE IF EXISTS api_keys;',
  'DROP TABLE IF EXISTS admins;'
];

const dropTablesFile = resolve(__dirname, '.temp-drop-tables.sql');
writeFileSync(dropTablesFile, dropStatements.join('\n'));

try {
  execSync(`cd ${rootDir}/packages/core && wrangler d1 execute ${dbName} --local -c wrangler.local.toml --file=${dropTablesFile}`, {
    stdio: 'pipe'
  });
  console.log('   ✅ Existing indexes and tables dropped successfully');
} catch (error) {
  console.log('   ℹ️  No existing tables to drop (this is normal for fresh setup)');
} finally {
  if (existsSync(dropTablesFile)) {
    execSync(`rm ${dropTablesFile}`);
  }
}

// Step 5: コアスキーマの適用
console.log('\n📊 Applying core database schema...');
const coreMigrationPath = resolve(rootDir, 'packages/core/migrations/consolidated_schema.sql');

if (!existsSync(coreMigrationPath)) {
  console.error('   ❌ Core migration file not found:', coreMigrationPath);
  throw new Error('Core migration file not found');
}

try {
  // ローカルD1でコアスキーマを実行
  execSync(
    `cd ${rootDir}/packages/core && wrangler d1 execute ${dbName} --local -c wrangler.local.toml --file=${coreMigrationPath}`,
    { stdio: 'inherit' }
  );
  console.log('   ✅ Core schema applied successfully');
} catch (error) {
  console.error('   ❌ Failed to apply core schema');
  throw error;
}

// Step 6: テスト用追加スキーマの適用
console.log('\n📊 Applying test-specific schema...');
const testSchemaPath = resolve(__dirname, 'fixtures/schema.sql');
const testSchemaSQL = readFileSync(testSchemaPath, 'utf-8');

// テストスキーマを一時ファイルに保存（Wranglerで実行するため）
const tempSchemaPath = resolve(__dirname, '.temp-e2e-schema.sql');
writeFileSync(tempSchemaPath, testSchemaSQL);

try {
  // ローカルD1でテストスキーマを実行
  execSync(
    `cd ${rootDir}/packages/core && wrangler d1 execute ${dbName} --local -c wrangler.local.toml --file=${tempSchemaPath}`,
    { stdio: 'inherit' }
  );
  console.log('   ✅ Test schema applied successfully');
} catch (error) {
  console.error('   ❌ Failed to apply test schema');
  throw error;
} finally {
  // 一時ファイルを削除
  if (existsSync(tempSchemaPath)) {
    execSync(`rm ${tempSchemaPath}`);
  }
}

// Step 7: テスト用APIキーをデータベースに追加
console.log('\n🔑 Adding test API key to database...');
const testApiKeySQL = `
INSERT OR REPLACE INTO api_keys (
  id, name, key_hash, key_prefix, scopes, created_by, created_at, expires_at, last_used_at, is_active
) VALUES (
  'test-api-key-1',
  'E2E Test API Key',
  'a596136871752b2d32b9c4fc198e0d033f49d7818a792e52647b99cb77853568',
  'vb_live_test123456...',
  '["data:read","data:write","data:delete","tables:read","admin:read","admin:write"]',
  NULL,
  datetime('now'),
  NULL,
  NULL,
  1
);
`;

const tempApiKeyFile = resolve(__dirname, '.temp-api-key.sql');
writeFileSync(tempApiKeyFile, testApiKeySQL);

try {
  execSync(
    `cd ${rootDir}/packages/core && wrangler d1 execute ${dbName} --local -c wrangler.local.toml --file=${tempApiKeyFile}`,
    { stdio: 'inherit' }
  );
  console.log('   ✅ Test API key added successfully');
} catch (error) {
  console.error('   ❌ Failed to add test API key');
  throw error;
} finally {
  if (existsSync(tempApiKeyFile)) {
    execSync(`rm ${tempApiKeyFile}`);
  }
}

// Step 8: セットアップ完了メッセージ
console.log('\n✨ E2E test environment setup complete!\n');
console.log('📋 Next steps:');
console.log('   1. Start the local Vibebase server:');
console.log('      cd packages/core && pnpm dev');
console.log('');
console.log('   2. In another terminal, run the seed script:');
console.log('      cd tests/e2e && pnpm seed');
console.log('');
console.log('   3. Run the E2E tests:');
console.log('      cd tests/e2e && pnpm test');
console.log('');

// セットアップ情報をファイルに保存
const setupInfo = {
  setupDate: new Date().toISOString(),
  dbName,
  apiUrl: 'http://localhost:8787',
  schemaApplied: true
};

writeFileSync(
  resolve(testDir, '.setup-info.json'),
  JSON.stringify(setupInfo, null, 2)
);

console.log('💡 Tip: Check .setup-info.json for setup details');