/**
 * User Authentication Task Management E2E Tests
 * ユーザー認証でのタスク管理機能のE2Eテスト
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task, TaskComment, User } from './fixtures/types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// セットアップ情報を読み込み
const setupInfo = JSON.parse(
  readFileSync(resolve(__dirname, '../.setup-info.json'), 'utf-8')
);

const API_URL = setupInfo.apiUrl;
const testTokens = setupInfo.testTokens;

describe('User Auth Task Management E2E Tests', () => {
  // 各ユーザーのクライアント
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient; 
  let charlieClient: VibebaseClient;
  
  let testTeam: Team;
  let testProject: Project;
  let createdTaskIds: string[] = [];

  beforeAll(async () => {
    // ユーザー認証クライアントを初期化
    aliceClient = createClient({ apiUrl: API_URL, userToken: testTokens.alice });
    bobClient = createClient({ apiUrl: API_URL, userToken: testTokens.bob });
    charlieClient = createClient({ apiUrl: API_URL, userToken: testTokens.charlie });

    // 既存のテストチームとプロジェクトを取得
    const teams = await aliceClient.data!.list<Team>('teams', { limit: 1 });
    expect(teams.success).toBe(true);
    expect(teams.data!.length).toBeGreaterThan(0);
    testTeam = teams.data![0];
    
    const projects = await aliceClient.data!.list<Project>('projects', { limit: 1 });
    expect(projects.success).toBe(true);
    expect(projects.data!.length).toBeGreaterThan(0);
    testProject = projects.data![0];
  });

  afterAll(async () => {
    // 作成したテストタスクをクリーンアップ
    for (const taskId of createdTaskIds) {
      try {
        await aliceClient.data!.delete('tasks', taskId);
      } catch (error) {
        // エラーは無視（既に削除済みの可能性）
      }
    }
  });

  describe('Task CRUD Operations with User Auth', () => {
    
    it('should create a task as team member (Alice)', async () => {
      const taskData = {
        project_id: testProject.id,
        title: 'User Auth Task Test - Create',
        description: 'Testing task creation with user authentication',
        status: 'todo' as const,
        priority: 'medium' as const,
        assigned_to: 'V1StGXR8_Z5jdHi6B-myT', // Alice's ID
        estimated_hours: 5,
        created_by: 'V1StGXR8_Z5jdHi6B-myT'
      };

      const result = await aliceClient.data!.create<Task>('tasks', taskData);
      
      expect(result.success).toBe(true);
      expect(result.data!.title).toBe(taskData.title);
      expect(result.data!.created_by).toBe('V1StGXR8_Z5jdHi6B-myT');
      expect(result.data!.assigned_to).toBe('V1StGXR8_Z5jdHi6B-myT');
      
      createdTaskIds.push(result.data!.id);
    });

    it('should read tasks as assigned user (Alice)', async () => {
      const result = await aliceClient.data!.list<Task>('tasks', {
        where: { assigned_to: 'V1StGXR8_Z5jdHi6B-myT' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
      
      // 自分にアサインされたタスクが含まれることを確認
      const myTasks = result.data!.filter(task => task.assigned_to === 'V1StGXR8_Z5jdHi6B-myT');
      expect(myTasks.length).toBeGreaterThan(0);
    });

    it('should update own task (Alice)', async () => {
      if (createdTaskIds.length === 0) return;
      
      const updateData = {
        status: 'in_progress' as const,
        actual_hours: 2
      };
      
      const result = await aliceClient.data!.update<Task>('tasks', createdTaskIds[0], updateData);
      
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('in_progress');
      expect(result.data!.actual_hours).toBe(2);
    });

    it('should delete own task (Alice)', async () => {
      const taskData = {
        project_id: testProject.id,
        title: 'User Auth Task Test - Delete',
        description: 'Task to be deleted',
        status: 'todo' as const,
        priority: 'low' as const,
        created_by: 'V1StGXR8_Z5jdHi6B-myT'
      };

      const createResult = await aliceClient.data!.create<Task>('tasks', taskData);
      expect(createResult.success).toBe(true);
      
      const deleteResult = await aliceClient.data!.delete('tasks', createResult.data!.id);
      expect(deleteResult.success).toBe(true);
      
      // 削除確認
      const getResult = await aliceClient.data!.get<Task>('tasks', createResult.data!.id);
      expect(getResult.success).toBe(false);
    });
  });

  describe('Task Assignment and Collaboration', () => {
    
    it('should assign task to team member (Alice assigns to Bob)', async () => {
      const taskData = {
        project_id: testProject.id,
        title: 'User Auth Task Test - Assignment',
        description: 'Task assigned from Alice to Bob',
        status: 'todo' as const,
        priority: 'high' as const,
        assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr', // Bob's ID
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice's ID
      };

      const result = await aliceClient.data!.create<Task>('tasks', taskData);
      
      expect(result.success).toBe(true);
      expect(result.data!.assigned_to).toBe('3ZjkQ2mN8pX9vC7bA-wEr');
      expect(result.data!.created_by).toBe('V1StGXR8_Z5jdHi6B-myT');
      
      createdTaskIds.push(result.data!.id);
    });

    it('should allow assigned user to update task status (Bob updates)', async () => {
      // Bobが自分にアサインされたタスクを更新
      const bobTasks = await bobClient.data!.list<Task>('tasks', {
        where: { assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr' }
      });
      
      expect(bobTasks.success).toBe(true);
      expect(bobTasks.data!.length).toBeGreaterThan(0);
      
      const taskToUpdate = bobTasks.data![0];
      const updateResult = await bobClient.data!.update<Task>('tasks', taskToUpdate.id, {
        status: 'in_progress' as const,
        actual_hours: 1
      });
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.data!.status).toBe('in_progress');
    });

    it('should allow team members to view all team tasks', async () => {
      // 各チームメンバーが全てのタスクを見ることができる
      const aliceTasks = await aliceClient.data!.list<Task>('tasks');
      const bobTasks = await bobClient.data!.list<Task>('tasks');
      const charlieTasks = await charlieClient.data!.list<Task>('tasks');
      
      expect(aliceTasks.success).toBe(true);
      expect(bobTasks.success).toBe(true);
      expect(charlieTasks.success).toBe(true);
      
      // 同じデータが見えることを確認（public テーブル）
      expect(aliceTasks.data!.length).toBe(bobTasks.data!.length);
      expect(bobTasks.data!.length).toBe(charlieTasks.data!.length);
    });
  });

  describe('Task Comments with User Auth', () => {
    
    it('should add comment to task (Alice comments)', async () => {
      if (createdTaskIds.length === 0) return;
      
      const commentData = {
        task_id: createdTaskIds[0],
        user_id: 'V1StGXR8_Z5jdHi6B-myT', // Alice
        comment: 'This is a user auth comment from Alice',
        is_edited: false
      };
      
      const result = await aliceClient.data!.create<TaskComment>('task_comments', commentData);
      
      expect(result.success).toBe(true);
      expect(result.data!.comment).toBe(commentData.comment);
      expect(result.data!.user_id).toBe('V1StGXR8_Z5jdHi6B-myT');
    });

    it('should allow team members to read task comments', async () => {
      if (createdTaskIds.length === 0) return;
      
      const aliceComments = await aliceClient.data!.list<TaskComment>('task_comments', {
        where: { task_id: createdTaskIds[0] }
      });
      const bobComments = await bobClient.data!.list<TaskComment>('task_comments', {
        where: { task_id: createdTaskIds[0] }
      });
      
      expect(aliceComments.success).toBe(true);
      expect(bobComments.success).toBe(true);
      
      // 同じコメントが見える（public テーブル）
      expect(aliceComments.data!.length).toBe(bobComments.data!.length);
    });

    it('should allow multiple team members to comment on same task', async () => {
      if (createdTaskIds.length === 0) return;
      
      // Bobがコメント追加
      const bobComment = await bobClient.data!.create<TaskComment>('task_comments', {
        task_id: createdTaskIds[0],
        user_id: '3ZjkQ2mN8pX9vC7bA-wEr', // Bob
        comment: 'Bob\'s perspective on this task',
        is_edited: false
      });
      
      // Charlieがコメント追加
      const charlieComment = await charlieClient.data!.create<TaskComment>('task_comments', {
        task_id: createdTaskIds[0],
        user_id: 'LpH9mKj2nQ4vX8cD-zFgR', // Charlie
        comment: 'Charlie\'s input on the task',
        is_edited: false
      });
      
      expect(bobComment.success).toBe(true);
      expect(charlieComment.success).toBe(true);
      
      // 全コメントを確認
      const allComments = await aliceClient.data!.list<TaskComment>('task_comments', {
        where: { task_id: createdTaskIds[0] }
      });
      
      expect(allComments.data!.length).toBeGreaterThanOrEqual(3); // Alice, Bob, Charlie
    });
  });

  describe('User-Specific Task Scenarios', () => {
    
    it('should track task creation by different users', async () => {
      // 各ユーザーがタスクを作成
      const aliceTask = await aliceClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Alice\'s Task',
        description: 'Created by Alice',
        status: 'todo' as const,
        priority: 'medium' as const,
        created_by: 'V1StGXR8_Z5jdHi6B-myT'
      });
      
      const bobTask = await bobClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Bob\'s Task',
        description: 'Created by Bob', 
        status: 'todo' as const,
        priority: 'high' as const,
        created_by: '3ZjkQ2mN8pX9vC7bA-wEr'
      });
      
      expect(aliceTask.success).toBe(true);
      expect(bobTask.success).toBe(true);
      expect(aliceTask.data!.created_by).toBe('V1StGXR8_Z5jdHi6B-myT');
      expect(bobTask.data!.created_by).toBe('3ZjkQ2mN8pX9vC7bA-wEr');
      
      createdTaskIds.push(aliceTask.data!.id, bobTask.data!.id);
    });

    it('should filter tasks by creator', async () => {
      const aliceCreatedTasks = await aliceClient.data!.list<Task>('tasks', {
        where: { created_by: 'V1StGXR8_Z5jdHi6B-myT' }
      });
      
      const bobCreatedTasks = await bobClient.data!.list<Task>('tasks', {
        where: { created_by: '3ZjkQ2mN8pX9vC7bA-wEr' }
      });
      
      expect(aliceCreatedTasks.success).toBe(true);
      expect(bobCreatedTasks.success).toBe(true);
      
      // 各自が作成したタスクのみが返される
      aliceCreatedTasks.data!.forEach(task => {
        expect(task.created_by).toBe('V1StGXR8_Z5jdHi6B-myT');
      });
      
      bobCreatedTasks.data!.forEach(task => {
        expect(task.created_by).toBe('3ZjkQ2mN8pX9vC7bA-wEr');
      });
    });

    it('should filter tasks by assignee', async () => {
      const aliceAssignedTasks = await aliceClient.data!.list<Task>('tasks', {
        where: { assigned_to: 'V1StGXR8_Z5jdHi6B-myT' }
      });
      
      expect(aliceAssignedTasks.success).toBe(true);
      
      // アサインされたタスクのみが返される
      aliceAssignedTasks.data!.forEach(task => {
        expect(task.assigned_to).toBe('V1StGXR8_Z5jdHi6B-myT');
      });
    });

    it('should handle task reassignment workflow', async () => {
      // Aliceがタスクを作成してBobにアサイン
      const task = await aliceClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Reassignment Test Task',
        description: 'Task to test reassignment',
        status: 'todo' as const,
        priority: 'medium' as const,
        assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr', // Bob
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      });
      
      expect(task.success).toBe(true);
      createdTaskIds.push(task.data!.id);
      
      // BobがCharliieに再アサイン
      const reassigned = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        assigned_to: 'LpH9mKj2nQ4vX8cD-zFgR' // Charlie
      });
      
      expect(reassigned.success).toBe(true);
      expect(reassigned.data!.assigned_to).toBe('LpH9mKj2nQ4vX8cD-zFgR');
      
      // Charlieがタスクを確認できる
      const charlieTask = await charlieClient.data!.get<Task>('tasks', task.data!.id);
      expect(charlieTask.success).toBe(true);
      expect(charlieTask.data!.assigned_to).toBe('LpH9mKj2nQ4vX8cD-zFgR');
    });

    it('should track task completion by assigned user', async () => {
      // タスクを作成してCharlieにアサイン
      const task = await aliceClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Completion Test Task',
        description: 'Task to test completion workflow',
        status: 'in_progress' as const,
        priority: 'high' as const,
        assigned_to: 'LpH9mKj2nQ4vX8cD-zFgR', // Charlie
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      });
      
      expect(task.success).toBe(true);
      createdTaskIds.push(task.data!.id);
      
      // Charlieがタスクを完了
      const completed = await charlieClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'done' as const,
        actual_hours: 8,
        completed_at: new Date().toISOString()
      });
      
      expect(completed.success).toBe(true);
      expect(completed.data!.status).toBe('done');
      expect(completed.data!.actual_hours).toBe(8);
      expect(completed.data!.completed_at).toBeDefined();
    });
  });

  describe('Task Priority and Status Workflows', () => {
    
    it('should handle priority updates by team members', async () => {
      const task = await aliceClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Priority Test Task',
        description: 'Testing priority updates',
        status: 'todo' as const,
        priority: 'low' as const,
        created_by: 'V1StGXR8_Z5jdHi6B-myT'
      });
      
      expect(task.success).toBe(true);
      createdTaskIds.push(task.data!.id);
      
      // Bobが優先度を上げる
      const priorityUpdate = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        priority: 'urgent' as const
      });
      
      expect(priorityUpdate.success).toBe(true);
      expect(priorityUpdate.data!.priority).toBe('urgent');
    });

    it('should track status progression', async () => {
      const task = await aliceClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Status Progression Test',
        description: 'Testing status workflow',
        status: 'todo' as const,
        priority: 'medium' as const,
        assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr', // Bob
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      });
      
      expect(task.success).toBe(true);
      createdTaskIds.push(task.data!.id);
      
      // Bob: todo → in_progress
      const inProgress = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'in_progress' as const
      });
      expect(inProgress.data!.status).toBe('in_progress');
      
      // Bob: in_progress → review
      const inReview = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'review' as const
      });
      expect(inReview.data!.status).toBe('review');
      
      // Alice: review → done
      const done = await aliceClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'done' as const,
        completed_at: new Date().toISOString()
      });
      expect(done.data!.status).toBe('done');
      expect(done.data!.completed_at).toBeDefined();
    });
  });

  describe('Team Collaboration Scenarios', () => {
    
    it('should simulate real team collaboration on a task', async () => {
      // 1. Aliceがタスクを作成してBobにアサイン
      const task = await aliceClient.data!.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Team Collaboration Task',
        description: 'Complex task requiring team collaboration',
        status: 'todo' as const,
        priority: 'high' as const,
        assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr', // Bob
        estimated_hours: 10,
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      });
      
      expect(task.success).toBe(true);
      createdTaskIds.push(task.data!.id);
      
      // 2. AliceがタスクにコメントでRequirements clarification
      const aliceComment1 = await aliceClient.data!.create<TaskComment>('task_comments', {
        task_id: task.data!.id,
        user_id: 'V1StGXR8_Z5jdHi6B-myT',
        comment: 'Please implement user authentication with JWT tokens. Let me know if you need more details.',
        is_edited: false
      });
      expect(aliceComment1.success).toBe(true);
      
      // 3. Bobがタスクを開始
      const taskStart = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'in_progress' as const
      });
      expect(taskStart.success).toBe(true);
      
      // 4. Bobがコメントで質問
      const bobComment1 = await bobClient.data!.create<TaskComment>('task_comments', {
        task_id: task.data!.id,
        user_id: '3ZjkQ2mN8pX9vC7bA-wEr',
        comment: 'Started working on this. Should I use RS256 or HS256 for JWT signing?',
        is_edited: false
      });
      expect(bobComment1.success).toBe(true);
      
      // 5. Aliceが回答
      const aliceComment2 = await aliceClient.data!.create<TaskComment>('task_comments', {
        task_id: task.data!.id,
        user_id: 'V1StGXR8_Z5jdHi6B-myT',
        comment: 'Please use HS256 for simplicity in development environment.',
        is_edited: false
      });
      expect(aliceComment2.success).toBe(true);
      
      // 6. Charlieが技術的なアドバイスを提供
      const charlieComment = await charlieClient.data!.create<TaskComment>('task_comments', {
        task_id: task.data!.id,
        user_id: 'LpH9mKj2nQ4vX8cD-zFgR',
        comment: 'Consider adding refresh token functionality for better security.',
        is_edited: false
      });
      expect(charlieComment.success).toBe(true);
      
      // 7. Bobが進捗アップデート
      const progressUpdate = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        actual_hours: 5
      });
      expect(progressUpdate.success).toBe(true);
      
      const bobComment2 = await bobClient.data!.create<TaskComment>('task_comments', {
        task_id: task.data!.id,
        user_id: '3ZjkQ2mN8pX9vC7bA-wEr',
        comment: '50% complete. JWT implementation done, working on refresh tokens now.',
        is_edited: false
      });
      expect(bobComment2.success).toBe(true);
      
      // 8. Bobがタスクをレビュー待ちに
      const readyForReview = await bobClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'review' as const,
        actual_hours: 8
      });
      expect(readyForReview.success).toBe(true);
      
      // 9. Aliceがレビュー後に完了
      const reviewed = await aliceClient.data!.update<Task>('tasks', task.data!.id, {
        status: 'done' as const,
        completed_at: new Date().toISOString()
      });
      expect(reviewed.success).toBe(true);
      
      const aliceComment3 = await aliceClient.data!.create<TaskComment>('task_comments', {
        task_id: task.data!.id,
        user_id: 'V1StGXR8_Z5jdHi6B-myT',
        comment: 'Excellent work! The JWT implementation looks solid. Task completed.',
        is_edited: false
      });
      expect(aliceComment3.success).toBe(true);
      
      // 10. 最終確認: 全てのコメントとタスク状態
      const finalComments = await aliceClient.data!.list<TaskComment>('task_comments', {
        where: { task_id: task.data!.id }
      });
      expect(finalComments.data!.length).toBeGreaterThanOrEqual(5);
      
      const finalTask = await aliceClient.data!.get<Task>('tasks', task.data!.id);
      expect(finalTask.data!.status).toBe('done');
      expect(finalTask.data!.completed_at).toBeDefined();
    });
  });
});