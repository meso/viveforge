#!/usr/bin/env tsx
// Seed Test Data for E2E Tests
// E2Eテスト用のテストデータ投入スクリプト

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import {
  testUsers,
  generateTeams,
  generateTeamMembers,
  generateProjects,
  generateTasks,
  generateTaskComments,
  generateAPIKeys,
  generateActivityLogs
} from './fixtures/seed-data';

console.log('🌱 Seeding test data for E2E tests...\n');

const rootDir = resolve(process.cwd(), '../..');
const coreDir = resolve(rootDir, 'packages/core');

console.log('🔧 Paths:');
console.log(`   Root: ${rootDir}`);
console.log(`   Core: ${coreDir}`);

// データ投入の実行
async function seedData() {
  try {
    // SQLファイルを生成
    const sqlStatements = [];
    
    // 1. 管理者の作成
    console.log('\n👑 Creating admin user...');
    const adminId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sqlStatements.push(`INSERT INTO admins (id, github_username, github_id, is_root, created_at) VALUES ('${adminId}', 'e2e-test-admin', '123456789', 1, datetime('now'));`);
    console.log(`   ✅ Generated admin user: ${adminId}`);

    // 2. APIキーの作成（管理者による）
    console.log('\n🔑 Creating API keys...');
    const apiKeys = generateAPIKeys([adminId]);
    for (const apiKeyData of apiKeys) {
      const expiresAt = apiKeyData.expires_at === null ? 'NULL' : `'${apiKeyData.expires_at}'`;
      const lastUsedAt = apiKeyData.last_used_at === null ? 'NULL' : `'${apiKeyData.last_used_at}'`;
      sqlStatements.push(`INSERT INTO api_keys (id, name, key_hash, key_prefix, scopes, created_by, created_at, expires_at, last_used_at, is_active) VALUES ('${apiKeyData.id}', '${apiKeyData.name}', '${apiKeyData.key_hash}', '${apiKeyData.key_prefix}', '${apiKeyData.scopes}', '${adminId}', '${apiKeyData.created_at}', ${expiresAt}, ${lastUsedAt}, ${apiKeyData.is_active});`);
    }
    console.log(`   ✅ Generated ${apiKeys.length} API keys`);

    // 3. ユーザーの作成
    console.log('\n👥 Creating users...');
    const userIds: string[] = [];
    for (const userData of testUsers) {
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      userIds.push(userId);
      sqlStatements.push(`INSERT INTO users (id, email, name, avatar_url, created_at) VALUES ('${userId}', '${userData.email}', '${(userData.name || '').replace(/'/g, "''")}', '${userData.avatar_url}', datetime('now'));`);
    }
    console.log(`   ✅ Generated ${userIds.length} users`);

    // 5. チームの作成
    console.log('\n👥 Creating teams...');
    const teamData = generateTeams(userIds);
    const teamIds: string[] = [];
    for (const team of teamData) {
      const teamId = `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      teamIds.push(teamId);
      sqlStatements.push(`INSERT INTO teams (id, name, description, created_by, created_at) VALUES ('${teamId}', '${team.name.replace(/'/g, "''")}', '${(team.description || '').replace(/'/g, "''")}', '${team.created_by}', datetime('now'));`);
    }
    console.log(`   ✅ Generated ${teamIds.length} teams`);

    // 5. チームメンバーの作成
    console.log('\n🤝 Creating team memberships...');
    const memberData = generateTeamMembers(teamIds, userIds);
    for (const member of memberData) {
      const memberId = `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sqlStatements.push(`INSERT INTO team_members (id, team_id, user_id, role, invited_by, joined_at) VALUES ('${memberId}', '${member.team_id}', '${member.user_id}', '${member.role}', '${member.invited_by}', datetime('now'));`);
    }
    console.log(`   ✅ Generated ${memberData.length} team memberships`);

    // 6. プロジェクトの作成
    console.log('\n📁 Creating projects...');
    const projectData = generateProjects(teamIds, userIds);
    const projectIds: string[] = [];
    for (const project of projectData) {
      const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      projectIds.push(projectId);
      sqlStatements.push(`INSERT INTO projects (id, team_id, name, description, status, due_date, created_by, created_at) VALUES ('${projectId}', '${project.team_id}', '${project.name.replace(/'/g, "''")}', '${(project.description || '').replace(/'/g, "''")}', '${project.status}', '${project.due_date}', '${project.created_by}', datetime('now'));`);
    }
    console.log(`   ✅ Generated ${projectIds.length} projects`);

    // 7. タスクの作成
    console.log('\n📋 Creating tasks...');
    const taskData = generateTasks(projectIds, userIds);
    const taskIds: string[] = [];
    for (const task of taskData) {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      taskIds.push(taskId);
      sqlStatements.push(`INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, due_date, estimated_hours, actual_hours, created_by, completed_at, created_at) VALUES ('${taskId}', '${task.project_id}', '${task.title.replace(/'/g, "''")}', '${(task.description || '').replace(/'/g, "''")}', '${task.status}', '${task.priority}', '${task.assigned_to || ''}', '${task.due_date || ''}', ${task.estimated_hours || 'NULL'}, ${task.actual_hours || 'NULL'}, '${task.created_by}', '${task.completed_at || ''}', datetime('now'));`);
    }
    console.log(`   ✅ Generated ${taskIds.length} tasks`);

    // 8. コメントの作成
    console.log('\n💬 Creating comments...');
    const commentData = generateTaskComments(taskIds, userIds);
    for (const comment of commentData) {
      const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sqlStatements.push(`INSERT INTO task_comments (id, task_id, user_id, comment, is_edited, created_at) VALUES ('${commentId}', '${comment.task_id}', '${comment.user_id}', '${comment.comment.replace(/'/g, "''")}', ${comment.is_edited ? 1 : 0}, datetime('now'));`);
    }
    console.log(`   ✅ Generated ${commentData.length} comments`);

    // 9. アクティビティログの作成
    console.log('\n📊 Creating activity logs...');
    const activityData = generateActivityLogs(teamIds, projectIds, taskIds, userIds);
    for (const activity of activityData) {
      const activityId = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sqlStatements.push(`INSERT INTO activity_logs (id, team_id, project_id, task_id, user_id, action, entity_type, entity_id, created_at) VALUES ('${activityId}', '${activity.team_id}', '${activity.project_id || ''}', '${activity.task_id || ''}', '${activity.user_id}', '${activity.action}', '${activity.entity_type}', '${activity.entity_id}', datetime('now'));`);
    }
    console.log(`   ✅ Generated ${activityData.length} activity logs`);

    // SQLファイルを作成して実行
    const sqlFile = resolve(__dirname, '.temp-seed-data.sql');
    writeFileSync(sqlFile, sqlStatements.join('\n'));
    
    console.log('\n💾 Executing SQL statements...');
    execSync(`cd ${coreDir} && wrangler d1 execute vibebase-db --local -c wrangler.local.toml --file=${sqlFile}`, {
      stdio: 'inherit'
    });

    // 一時ファイルを削除
    execSync(`rm ${sqlFile}`);

    console.log('\n✨ Test data seeding complete!');

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    throw error;
  }
}


// メイン実行
seedData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});