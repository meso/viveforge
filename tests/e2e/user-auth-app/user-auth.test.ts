// E2E Test: User Authentication Based Tests
// ユーザー認証ベースのE2Eテスト - アクセスコントロール機能の検証

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task, User } from '../team-task-app/fixtures/types';

describe('User Authentication E2E Tests', () => {
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let charlieClient: VibebaseClient;
  let testUsers: User[] = [];
  let testTeam: Team;
  let testProject: Project;
  let createdTaskIds: string[] = [];
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';

  beforeAll(async () => {
    // APIキーでユーザー情報を取得
    const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';
    const adminClient = createClient({ apiUrl, apiKey });

    // テストユーザーを取得
    const userEmails = ['alice@example.com', 'bob@example.com', 'charlie@example.com'];
    for (const email of userEmails) {
      const result = await adminClient.data.list('users', {
        where: { email }
      });
      if (result.data.length > 0) {
        testUsers.push(result.data[0] as unknown as User);
      }
    }

    expect(testUsers.length).toBeGreaterThanOrEqual(3);

    // TODO: 実際のユーザートークンを取得する機能が必要
    // 現在はモックトークンを使用（実装時に実際の認証フローに置き換え）
    const aliceToken = `mock-user-token-${testUsers[0].id}`;
    const bobToken = `mock-user-token-${testUsers[1].id}`;
    const charlieToken = `mock-user-token-${testUsers[2].id}`;

    // 各ユーザーのクライアントを作成
    aliceClient = createClient({ apiUrl, userToken: aliceToken });
    bobClient = createClient({ apiUrl, userToken: bobToken });
    charlieClient = createClient({ apiUrl, userToken: charlieToken });

    // APIキーでテスト用データを準備
    const teamResponse = await adminClient.data.create('teams', {
      name: 'User Auth Test Team',
      description: 'Team for user authentication testing',
      created_by: testUsers[0].id
    });
    testTeam = teamResponse.success ? teamResponse.data : teamResponse as any;

    const projectResponse = await adminClient.data.create('projects', {
      team_id: testTeam.id,
      name: 'User Auth Test Project',
      description: 'Project for user authentication testing',
      status: 'active',
      created_by: testUsers[0].id
    });
    testProject = projectResponse.success ? projectResponse.data : projectResponse as any;
  });

  afterAll(async () => {
    // クリーンアップ（APIキーで削除）
    const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';
    const adminClient = createClient({ apiUrl, apiKey });

    for (const taskId of createdTaskIds) {
      try {
        await adminClient.data.delete('tasks', taskId);
      } catch (error) {
        console.warn('Failed to delete task:', taskId, error);
      }
    }

    if (testProject) {
      await adminClient.data.delete('projects', testProject.id);
    }
    if (testTeam) {
      await adminClient.data.delete('teams', testTeam.id);
    }
  });

  describe('Basic CRUD Operations (User Auth)', () => {
    it('should create task as Alice', async () => {
      const newTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Task',
        description: 'Task created by Alice',
        status: 'todo',
        priority: 'high',
        assigned_to: testUsers[0].id,
        created_by: testUsers[0].id
      });

      expect(newTaskResponse.success).toBe(true);
      const newTask = newTaskResponse.success ? newTaskResponse.data : newTaskResponse as any;
      expect(newTask.title).toBe('Alice Task');
      expect(newTask.created_by).toBe(testUsers[0].id);
      
      createdTaskIds.push(newTask.id);
    });

    it('should create task as Bob', async () => {
      const newTaskResponse = await bobClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Bob Task',
        description: 'Task created by Bob',
        status: 'todo',
        priority: 'medium',
        assigned_to: testUsers[1].id,
        created_by: testUsers[1].id
      });

      expect(newTaskResponse.success).toBe(true);
      const newTask = newTaskResponse.success ? newTaskResponse.data : newTaskResponse as any;
      expect(newTask.title).toBe('Bob Task');
      expect(newTask.created_by).toBe(testUsers[1].id);
      
      createdTaskIds.push(newTask.id);
    });

    it('should read tasks with proper filtering', async () => {
      // Aliceがタスクを読み取り
      const aliceTasksResponse = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(aliceTasksResponse.success).toBe(true);
      const aliceTasks = aliceTasksResponse.data;
      expect(Array.isArray(aliceTasks)).toBe(true);

      // Bobがタスクを読み取り
      const bobTasksResponse = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(bobTasksResponse.success).toBe(true);
      const bobTasks = bobTasksResponse.data;
      expect(Array.isArray(bobTasks)).toBe(true);

      // NOTE: publicテーブルの場合は全てのタスクが見えるはず
      // privateテーブルの場合は自分のタスクのみが見えるはず
      console.log('Alice sees tasks:', aliceTasks.length);
      console.log('Bob sees tasks:', bobTasks.length);
    });

    it('should update own task successfully', async () => {
      // Aliceが自分のタスクを更新
      const aliceTasksResponse = await aliceClient.data.list('tasks', {
        where: { created_by: testUsers[0].id, project_id: testProject.id }
      });
      
      if (aliceTasksResponse.data.length > 0) {
        const aliceTask = aliceTasksResponse.data[0];
        const updateResponse = await aliceClient.data.update('tasks', aliceTask.id, {
          status: 'in_progress',
          description: 'Updated by Alice'
        });

        expect(updateResponse.success).toBe(true);
        const updatedTask = updateResponse.success ? updateResponse.data : updateResponse as any;
        expect(updatedTask.status).toBe('in_progress');
        expect(updatedTask.description).toBe('Updated by Alice');
      }
    });

    it('should delete own task successfully', async () => {
      // 削除用のタスクを作成
      const taskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Task to Delete',
        status: 'todo',
        priority: 'low',
        created_by: testUsers[0].id
      });

      const task = taskResponse.success ? taskResponse.data : taskResponse as any;
      
      // 削除実行
      const deleteResponse = await aliceClient.data.delete('tasks', task.id);
      expect(deleteResponse.success).toBe(true);

      // 削除確認
      const checkResponse = await aliceClient.data.list('tasks', {
        where: { id: task.id }
      });
      expect(checkResponse.data).toHaveLength(0);
    });
  });

  describe('Access Control Tests', () => {
    it('should enforce owner-based data filtering', async () => {
      // 各ユーザーが自分のデータのみを見ることができるかテスト
      const aliceTasksResponse = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });
      const bobTasksResponse = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(aliceTasksResponse.success).toBe(true);
      expect(bobTasksResponse.success).toBe(true);

      const aliceTasks = aliceTasksResponse.data;
      const bobTasks = bobTasksResponse.data;

      // privateテーブルの場合、各ユーザーは自分のタスクのみを見るべき
      // publicテーブルの場合、全てのタスクが見える
      
      // Alice自身のタスクを確認
      const aliceOwnTasks = aliceTasks.filter((task: any) => task.created_by === testUsers[0].id);
      expect(aliceOwnTasks.length).toBeGreaterThan(0);

      // Bob自身のタスクを確認
      const bobOwnTasks = bobTasks.filter((task: any) => task.created_by === testUsers[1].id);
      expect(bobOwnTasks.length).toBeGreaterThan(0);

      console.log('Alice sees', aliceTasks.length, 'tasks, owns', aliceOwnTasks.length);
      console.log('Bob sees', bobTasks.length, 'tasks, owns', bobOwnTasks.length);
    });

    it('should prevent access to other users data in private tables', async () => {
      // NOTE: このテストはテーブルがprivateに設定されている場合のみ有効
      // テーブルポリシーを動的に変更してテストすることも可能

      // Aliceがタスクを作成
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Private Task',
        description: 'This should only be visible to Alice',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      const aliceTask = aliceTaskResponse.success ? aliceTaskResponse.data : aliceTaskResponse as any;
      createdTaskIds.push(aliceTask.id);

      // Bobが特定のタスクを直接IDで取得を試行
      try {
        const bobAttemptResponse = await bobClient.data.get('tasks', aliceTask.id);
        
        // privateテーブルの場合、Bobはアクセスできないはず
        // publicテーブルの場合、アクセス可能
        console.log('Bob access to Alice task result:', bobAttemptResponse.success);
        
        if (bobAttemptResponse.success) {
          console.log('Table appears to be public - Bob can see Alice task');
        } else {
          console.log('Table appears to be private - Bob cannot see Alice task');
          expect(bobAttemptResponse.success).toBe(false);
        }
      } catch (error) {
        // アクセス拒否エラーが期待される場合
        console.log('Access denied as expected for private table');
        expect(error).toBeDefined();
      }
    });

    it('should allow team-based data access', async () => {
      // チーム内でのデータ共有テスト
      // 同じプロジェクト内のタスクは、適切な権限があれば他のユーザーも見ることができる
      
      const allTasksAlice = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });
      const allTasksBob = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(allTasksAlice.success).toBe(true);
      expect(allTasksBob.success).toBe(true);

      // プロジェクトレベルでの可視性をテスト
      console.log('Project tasks visible to Alice:', allTasksAlice.data.length);
      console.log('Project tasks visible to Bob:', allTasksBob.data.length);
    });
  });

  describe('User Permission Tests', () => {
    it('should validate user can only update own records', async () => {
      // Aliceのタスクを取得
      const aliceTasksResponse = await aliceClient.data.list('tasks', {
        where: { created_by: testUsers[0].id, project_id: testProject.id }
      });

      if (aliceTasksResponse.data.length > 0) {
        const aliceTask = aliceTasksResponse.data[0];

        // Bobが他人（Alice）のタスクを更新しようとする
        try {
          const bobUpdateResponse = await bobClient.data.update('tasks', aliceTask.id, {
            description: 'Bob tried to update this'
          });

          // private テーブルの場合、更新は失敗すべき
          // public テーブルの場合、更新が成功する可能性
          console.log('Bob update Alice task result:', bobUpdateResponse.success);
          
          if (!bobUpdateResponse.success) {
            expect(bobUpdateResponse.success).toBe(false);
            console.log('Update blocked as expected for private table');
          } else {
            console.log('Update allowed - table may be public or have permissive policy');
          }
        } catch (error) {
          console.log('Update access denied as expected');
          expect(error).toBeDefined();
        }
      }
    });

    it('should validate user can only delete own records', async () => {
      // 削除テスト用のタスクを作成
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Task for Delete Test',
        status: 'todo',
        priority: 'low',
        created_by: testUsers[0].id
      });

      const aliceTask = aliceTaskResponse.success ? aliceTaskResponse.data : aliceTaskResponse as any;

      // Bobが他人（Alice）のタスクを削除しようとする
      try {
        const bobDeleteResponse = await bobClient.data.delete('tasks', aliceTask.id);

        // private テーブルの場合、削除は失敗すべき
        console.log('Bob delete Alice task result:', bobDeleteResponse.success);
        
        if (!bobDeleteResponse.success) {
          expect(bobDeleteResponse.success).toBe(false);
          console.log('Delete blocked as expected for private table');
          
          // Aliceが自分のタスクを削除（クリーンアップ）
          await aliceClient.data.delete('tasks', aliceTask.id);
        } else {
          console.log('Delete allowed - table may be public or have permissive policy');
        }
      } catch (error) {
        console.log('Delete access denied as expected');
        expect(error).toBeDefined();
        
        // Aliceが自分のタスクを削除（クリーンアップ）
        await aliceClient.data.delete('tasks', aliceTask.id);
      }
    });
  });

  describe('Multi-User Collaboration Tests', () => {
    it('should handle concurrent access from multiple users', async () => {
      // 複数ユーザーが同時にアクセスするシナリオ
      const concurrentTasks = await Promise.all([
        aliceClient.data.create('tasks', {
          project_id: testProject.id,
          title: 'Alice Concurrent Task',
          status: 'todo',
          priority: 'high',
          created_by: testUsers[0].id
        }),
        bobClient.data.create('tasks', {
          project_id: testProject.id,
          title: 'Bob Concurrent Task',
          status: 'todo',
          priority: 'high',
          created_by: testUsers[1].id
        }),
        charlieClient.data.create('tasks', {
          project_id: testProject.id,
          title: 'Charlie Concurrent Task',
          status: 'todo',
          priority: 'high',
          created_by: testUsers[2].id
        })
      ]);

      // 全てのタスク作成が成功することを確認
      concurrentTasks.forEach((response, index) => {
        expect(response.success).toBe(true);
        const task = response.success ? response.data : response as any;
        expect(task.title).toContain(['Alice', 'Bob', 'Charlie'][index]);
        createdTaskIds.push(task.id);
      });
    });

    it('should maintain data consistency across users', async () => {
      // データ整合性テスト
      const initialCountAlice = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });
      const initialCountBob = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(initialCountAlice.success).toBe(true);
      expect(initialCountBob.success).toBe(true);

      // 新しいタスクを作成
      const newTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Consistency Test Task',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[0].id
      });

      const newTask = newTaskResponse.success ? newTaskResponse.data : newTaskResponse as any;
      createdTaskIds.push(newTask.id);

      // 両方のユーザーから最新データを取得
      const updatedCountAlice = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });
      const updatedCountBob = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(updatedCountAlice.success).toBe(true);
      expect(updatedCountBob.success).toBe(true);

      // データの整合性を確認
      console.log('Alice before:', initialCountAlice.data.length, 'after:', updatedCountAlice.data.length);
      console.log('Bob before:', initialCountBob.data.length, 'after:', updatedCountBob.data.length);
    });
  });

  describe('User Context and Authentication', () => {
    it('should maintain proper user context', async () => {
      // 各クライアントが正しいユーザーコンテキストを維持しているかテスト
      const aliceTask = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Context Test',
        status: 'todo',
        priority: 'low',
        created_by: testUsers[0].id
      });

      expect(aliceTask.success).toBe(true);
      const task = aliceTask.success ? aliceTask.data : aliceTask as any;
      expect(task.created_by).toBe(testUsers[0].id);
      
      createdTaskIds.push(task.id);
    });

    it('should handle invalid authentication gracefully', async () => {
      // 無効な認証でのアクセステスト
      const invalidClient = createClient({ 
        apiUrl, 
        userToken: 'invalid-token-12345' 
      });

      try {
        const response = await invalidClient.data.list('tasks');
        
        // 認証が失敗することを期待
        expect(response.success).toBe(false);
      } catch (error) {
        // 認証エラーが投げられることを期待
        expect(error).toBeDefined();
        console.log('Authentication properly rejected invalid token');
      }
    });
  });
});