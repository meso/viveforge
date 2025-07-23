#!/usr/bin/env tsx
// Teardown Script for E2E Tests
// E2Eテスト後のクリーンアップスクリプト

import { createClient } from '@vibebase/sdk';

const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

console.log('🧹 Cleaning up E2E test data...\n');

// Vibebaseクライアントの初期化
const vibebase = createClient({
  apiUrl,
  apiKey
});

async function teardown() {
  try {
    // テストデータのクリーンアップ
    const tables = [
      'activity_logs',
      'task_attachments', 
      'task_comments',
      'tasks',
      'projects',
      'members',
      'teams'
    ];

    for (const table of tables) {
      try {
        const result = await vibebase.data.bulkDelete(table, []);
        console.log(`   ✅ Cleaned ${table}`);
      } catch (error) {
        console.log(`   ⚠️  Could not clean ${table}:`, error);
      }
    }

    // テストユーザーのクリーンアップ（emailで特定）
    console.log('\n👥 Cleaning up test users...');
    const testEmails = [
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
      'diana@example.com',
      'eve@example.com'
    ];

    for (const email of testEmails) {
      try {
        const users = await vibebase.data.list('users', {
          where: { email }
        });
        if (users.data.length > 0) {
          await vibebase.data.delete('users', users.data[0].id);
          console.log(`   ✅ Deleted user: ${email}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not delete user ${email}:`, error);
      }
    }

    // ストレージのテストデータを削除
    console.log('\n📦 Cleaning up storage...');
    try {
      await vibebase.storage.delete('test-data/e2e-test-ids.json');
      console.log('   ✅ Deleted test IDs file');
    } catch (error) {
      console.log('   ⚠️  Could not delete test IDs file:', error);
    }

    console.log('\n✨ Teardown complete!');

  } catch (error) {
    console.error('\n❌ Error during teardown:', error);
    throw error;
  }
}

// メイン実行
teardown().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});