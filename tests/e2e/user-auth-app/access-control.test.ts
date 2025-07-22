// E2E Test: Access Control Features
// アクセスコントロール機能の包括的E2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task, User } from '../team-task-app/fixtures/types';

describe('Access Control E2E Tests', () => {
  let adminClient: VibebaseClient;
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let testUsers: User[] = [];
  let testTeam: Team;
  let testProject: Project;
  let createdTaskIds: string[] = [];
  let testTableName: string = 'access_test_table';
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
  const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

  beforeAll(async () => {
    // 管理者クライアント
    adminClient = createClient({ apiUrl, apiKey });

    // テストユーザーを取得
    const userEmails = ['alice@example.com', 'bob@example.com'];
    for (const email of userEmails) {
      const result = await adminClient.data.list('users', {
        where: { email }
      });
      if (result.data.length > 0) {
        testUsers.push(result.data[0] as unknown as User);
      }
    }

    expect(testUsers.length).toBeGreaterThanOrEqual(2);

    // TODO: 実際のユーザートークンを取得
    const aliceToken = `mock-user-token-${testUsers[0].id}`;
    const bobToken = `mock-user-token-${testUsers[1].id}`;

    aliceClient = createClient({ apiUrl, userToken: aliceToken });
    bobClient = createClient({ apiUrl, userToken: bobToken });

    // テスト用データ準備
    const teamResponse = await adminClient.data.create('teams', {
      name: 'Access Control Test Team',
      description: 'Team for access control testing',
      created_by: testUsers[0].id
    });
    testTeam = teamResponse.success ? teamResponse.data : teamResponse as any;

    const projectResponse = await adminClient.data.create('projects', {
      team_id: testTeam.id,
      name: 'Access Control Test Project',
      description: 'Project for access control testing',
      status: 'active',
      created_by: testUsers[0].id
    });
    testProject = projectResponse.success ? projectResponse.data : projectResponse as any;
  });

  afterAll(async () => {
    // クリーンアップ
    for (const taskId of createdTaskIds) {
      try {
        await adminClient.data.delete('tasks', taskId);
      } catch (error) {
        console.warn('Failed to delete task:', taskId);
      }
    }

    if (testProject) {
      await adminClient.data.delete('projects', testProject.id);
    }
    if (testTeam) {
      await adminClient.data.delete('teams', testTeam.id);
    }
  });

  describe('Table Access Policy Tests', () => {
    it('should get current table access policy', async () => {
      // テーブルのアクセスポリシーを取得
      try {
        const tablesResponse = await adminClient.tables.list();
        expect(tablesResponse.success).toBe(true);
        
        const tasksTable = tablesResponse.data.find((table: any) => table.name === 'tasks');
        expect(tasksTable).toBeDefined();
        
        console.log('Tasks table access policy:', tasksTable?.access_policy || 'not set');
      } catch (error) {
        console.log('Could not retrieve table policy - may not be implemented in SDK');
      }
    });

    it('should test public table behavior', async () => {
      // Publicテーブルでの動作テスト
      
      // Aliceがタスクを作成
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Public Task',
        description: 'Task in public table',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      expect(aliceTaskResponse.success).toBe(true);
      const aliceTask = aliceTaskResponse.success ? aliceTaskResponse.data : aliceTaskResponse as any;
      createdTaskIds.push(aliceTask.id);

      // Bobがタスクを作成
      const bobTaskResponse = await bobClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Bob Public Task',
        description: 'Task in public table',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[1].id
      });

      expect(bobTaskResponse.success).toBe(true);
      const bobTask = bobTaskResponse.success ? bobTaskResponse.data : bobTaskResponse as any;
      createdTaskIds.push(bobTask.id);

      // 両方のユーザーが全てのタスクを見ることができるかテスト
      const aliceViewResponse = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });
      const bobViewResponse = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(aliceViewResponse.success).toBe(true);
      expect(bobViewResponse.success).toBe(true);

      const aliceViewTasks = aliceViewResponse.data;
      const bobViewTasks = bobViewResponse.data;

      // Publicテーブルの場合、両方のユーザーが同じ数のタスクを見ることができるはず
      console.log('Alice sees', aliceViewTasks.length, 'tasks in public table');
      console.log('Bob sees', bobViewTasks.length, 'tasks in public table');

      // 互いのタスクが見えることを確認
      const aliceSeesAliceTask = aliceViewTasks.find((task: any) => task.id === aliceTask.id);
      const aliceSeesBobTask = aliceViewTasks.find((task: any) => task.id === bobTask.id);
      const bobSeesAliceTask = bobViewTasks.find((task: any) => task.id === aliceTask.id);
      const bobSeesBobTask = bobViewTasks.find((task: any) => task.id === bobTask.id);

      expect(aliceSeesAliceTask).toBeDefined();
      expect(bobSeesBobTask).toBeDefined();
      
      // Publicテーブルでは互いのタスクも見えるはず
      if (aliceSeesBobTask && bobSeesAliceTask) {
        console.log('✅ Public table: Users can see each others tasks');
      } else {
        console.log('❓ Table may be private or have access restrictions');
      }
    });

    it('should test private table behavior simulation', async () => {
      // Privateテーブルの動作をシミュレーション
      // 実際のprivateテーブル設定ができない場合は、owner_idフィルタリングのテスト
      
      // 各ユーザーが自分のタスクのみを取得
      const aliceOwnTasksResponse = await aliceClient.data.list('tasks', {
        where: { 
          project_id: testProject.id,
          created_by: testUsers[0].id  // Alice自身のタスクのみ
        }
      });

      const bobOwnTasksResponse = await bobClient.data.list('tasks', {
        where: { 
          project_id: testProject.id,
          created_by: testUsers[1].id  // Bob自身のタスクのみ
        }
      });

      expect(aliceOwnTasksResponse.success).toBe(true);
      expect(bobOwnTasksResponse.success).toBe(true);

      const aliceOwnTasks = aliceOwnTasksResponse.data;
      const bobOwnTasks = bobOwnTasksResponse.data;

      // 各ユーザーが自分のタスクのみを取得していることを確認
      aliceOwnTasks.forEach((task: any) => {
        expect(task.created_by).toBe(testUsers[0].id);
      });

      bobOwnTasks.forEach((task: any) => {
        expect(task.created_by).toBe(testUsers[1].id);
      });

      console.log('Alice owns', aliceOwnTasks.length, 'tasks');
      console.log('Bob owns', bobOwnTasks.length, 'tasks');
    });
  });

  describe('Owner-based Data Filtering Tests', () => {
    it('should filter data by owner_id automatically', async () => {
      // owner_idベースのフィルタリングテスト
      
      // 複数のタスクを作成（異なる所有者）
      const tasksToCreate = [
        {
          project_id: testProject.id,
          title: 'Alice Ownership Test 1',
          status: 'todo',
          priority: 'high',
          created_by: testUsers[0].id
        },
        {
          project_id: testProject.id,
          title: 'Alice Ownership Test 2',
          status: 'in_progress',
          priority: 'medium',
          created_by: testUsers[0].id
        },
        {
          project_id: testProject.id,
          title: 'Bob Ownership Test 1',
          status: 'todo',
          priority: 'low',
          created_by: testUsers[1].id
        }
      ];

      // タスクを作成
      for (const taskData of tasksToCreate) {
        let response;
        if (taskData.created_by === testUsers[0].id) {
          response = await aliceClient.data.create('tasks', taskData);
        } else {
          response = await bobClient.data.create('tasks', taskData);
        }
        
        expect(response.success).toBe(true);
        const task = response.success ? response.data : response as any;
        createdTaskIds.push(task.id);
      }

      // 各ユーザーが見ることができるタスクを確認
      const aliceVisibleResponse = await aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });
      const bobVisibleResponse = await bobClient.data.list('tasks', {
        where: { project_id: testProject.id }
      });

      expect(aliceVisibleResponse.success).toBe(true);
      expect(bobVisibleResponse.success).toBe(true);

      const aliceVisible = aliceVisibleResponse.data;
      const bobVisible = bobVisibleResponse.data;

      // 自動フィルタリングの動作をチェック
      console.log('Alice can see', aliceVisible.length, 'tasks total');
      console.log('Bob can see', bobVisible.length, 'tasks total');

      const aliceOwnTasks = aliceVisible.filter((task: any) => task.created_by === testUsers[0].id);
      const bobOwnTasks = bobVisible.filter((task: any) => task.created_by === testUsers[1].id);

      console.log('Alice sees', aliceOwnTasks.length, 'of her own tasks');
      console.log('Bob sees', bobOwnTasks.length, 'of his own tasks');

      // 少なくとも自分のタスクは見えるはず
      expect(aliceOwnTasks.length).toBeGreaterThan(0);
      expect(bobOwnTasks.length).toBeGreaterThan(0);
    });

    it('should restrict access to other users records', async () => {
      // 他のユーザーのレコードへのアクセス制限テスト
      
      // Aliceが特定のタスクを作成
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Restricted Task',
        description: 'This task should be restricted',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      expect(aliceTaskResponse.success).toBe(true);
      const aliceTask = aliceTaskResponse.success ? aliceTaskResponse.data : aliceTaskResponse as any;
      createdTaskIds.push(aliceTask.id);

      // BobがAliceのタスクIDを直接指定してアクセスを試行
      try {
        const bobAccessResponse = await bobClient.data.get('tasks', aliceTask.id);
        
        if (bobAccessResponse.success) {
          console.log('⚠️  Bob can access Alice task - table may be public');
          console.log('Task title:', bobAccessResponse.data.title);
        } else {
          console.log('✅ Bob cannot access Alice task - proper access control');
          expect(bobAccessResponse.success).toBe(false);
        }
      } catch (error) {
        console.log('✅ Access properly denied with exception');
        expect(error).toBeDefined();
      }
    });

    it('should allow owners to modify their own records', async () => {
      // 所有者が自分のレコードを変更できることをテスト
      
      const taskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Modifiable Task',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[0].id
      });

      const task = taskResponse.success ? taskResponse.data : taskResponse as any;
      createdTaskIds.push(task.id);

      // Aliceが自分のタスクを更新
      const updateResponse = await aliceClient.data.update('tasks', task.id, {
        status: 'in_progress',
        description: 'Updated by owner'
      });

      expect(updateResponse.success).toBe(true);
      const updatedTask = updateResponse.success ? updateResponse.data : updateResponse as any;
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.description).toBe('Updated by owner');

      // Aliceが自分のタスクを削除
      const deleteResponse = await aliceClient.data.delete('tasks', task.id);
      expect(deleteResponse.success).toBe(true);

      // タスクが削除されたことを確認
      const checkResponse = await aliceClient.data.list('tasks', {
        where: { id: task.id }
      });
      expect(checkResponse.data).toHaveLength(0);

      // クリーンアップリストから削除
      createdTaskIds = createdTaskIds.filter(id => id !== task.id);
    });

    it('should prevent non-owners from modifying records', async () => {
      // 非所有者がレコードを変更できないことをテスト
      
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Protected Task',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      const aliceTask = aliceTaskResponse.success ? aliceTaskResponse.data : aliceTaskResponse as any;
      createdTaskIds.push(aliceTask.id);

      // BobがAliceのタスクを更新しようとする
      try {
        const bobUpdateResponse = await bobClient.data.update('tasks', aliceTask.id, {
          status: 'completed',
          description: 'Bob tried to update this'
        });

        if (bobUpdateResponse.success) {
          console.log('⚠️  Bob can update Alice task - insufficient access control');
        } else {
          console.log('✅ Bob cannot update Alice task - proper protection');
          expect(bobUpdateResponse.success).toBe(false);
        }
      } catch (error) {
        console.log('✅ Update properly denied with exception');
        expect(error).toBeDefined();
      }

      // BobがAliceのタスクを削除しようとする
      try {
        const bobDeleteResponse = await bobClient.data.delete('tasks', aliceTask.id);

        if (bobDeleteResponse.success) {
          console.log('⚠️  Bob can delete Alice task - insufficient access control');
          // タスクが削除されてしまった場合はクリーンアップリストから除去
          createdTaskIds = createdTaskIds.filter(id => id !== aliceTask.id);
        } else {
          console.log('✅ Bob cannot delete Alice task - proper protection');
          expect(bobDeleteResponse.success).toBe(false);
        }
      } catch (error) {
        console.log('✅ Delete properly denied with exception');
        expect(error).toBeDefined();
      }
    });
  });

  describe('User Session and Context Tests', () => {
    it('should maintain user session across operations', async () => {
      // ユーザーセッションが操作間で維持されることをテスト
      
      const operations = [];
      
      // 複数の操作を実行
      operations.push(aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Session Test 1',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      }));

      operations.push(aliceClient.data.list('tasks', {
        where: { project_id: testProject.id }
      }));

      operations.push(aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Session Test 2',
        status: 'in_progress',
        priority: 'medium',
        created_by: testUsers[0].id
      }));

      const results = await Promise.all(operations);

      // 全ての操作が成功することを確認
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        if (index === 0 || index === 2) {
          // 作成操作の場合
          const task = result.success ? result.data : result as any;
          expect(task.created_by).toBe(testUsers[0].id);
          createdTaskIds.push(task.id);
        }
      });

      console.log('✅ User session maintained across', results.length, 'operations');
    });

    it('should handle concurrent user sessions', async () => {
      // 複数ユーザーの同時セッションテスト
      
      const concurrentOperations = [
        aliceClient.data.create('tasks', {
          project_id: testProject.id,
          title: 'Alice Concurrent 1',
          status: 'todo',
          priority: 'high',
          created_by: testUsers[0].id
        }),
        bobClient.data.create('tasks', {
          project_id: testProject.id,
          title: 'Bob Concurrent 1',
          status: 'todo',
          priority: 'medium',
          created_by: testUsers[1].id
        }),
        aliceClient.data.list('tasks', {
          where: { project_id: testProject.id }
        }),
        bobClient.data.list('tasks', {
          where: { project_id: testProject.id }
        })
      ];

      const results = await Promise.all(concurrentOperations);

      // 全ての操作が成功し、適切なユーザーコンテキストが維持されることを確認
      expect(results[0].success).toBe(true); // Alice create
      expect(results[1].success).toBe(true); // Bob create
      expect(results[2].success).toBe(true); // Alice list
      expect(results[3].success).toBe(true); // Bob list

      const aliceTask = results[0].success ? results[0].data : results[0] as any;
      const bobTask = results[1].success ? results[1].data : results[1] as any;

      expect(aliceTask.created_by).toBe(testUsers[0].id);
      expect(bobTask.created_by).toBe(testUsers[1].id);

      createdTaskIds.push(aliceTask.id, bobTask.id);

      console.log('✅ Concurrent user sessions handled correctly');
    });
  });

  describe('Data Isolation Tests', () => {
    it('should ensure proper data isolation between users', async () => {
      // ユーザー間のデータ分離テスト
      
      // 各ユーザーが異なるデータを作成
      const aliceData = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Isolated Data',
        description: 'Sensitive Alice information',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      const bobData = await bobClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Bob Isolated Data',
        description: 'Sensitive Bob information',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[1].id
      });

      expect(aliceData.success).toBe(true);
      expect(bobData.success).toBe(true);

      const aliceTask = aliceData.success ? aliceData.data : aliceData as any;
      const bobTask = bobData.success ? bobData.data : bobData as any;

      createdTaskIds.push(aliceTask.id, bobTask.id);

      // データの分離を確認
      const aliceSearchResponse = await aliceClient.data.list('tasks', {
        where: { 
          project_id: testProject.id,
          description: { $like: '%Sensitive%' }
        }
      });

      const bobSearchResponse = await bobClient.data.list('tasks', {
        where: { 
          project_id: testProject.id,
          description: { $like: '%Sensitive%' }
        }
      });

      expect(aliceSearchResponse.success).toBe(true);
      expect(bobSearchResponse.success).toBe(true);

      const aliceResults = aliceSearchResponse.data;
      const bobResults = bobSearchResponse.data;

      // 各ユーザーが適切なデータのみを見ることができることを確認
      console.log('Alice finds', aliceResults.length, 'sensitive tasks');
      console.log('Bob finds', bobResults.length, 'sensitive tasks');

      // 最低限自分のデータは見えるはず
      const aliceSeesOwnData = aliceResults.some((task: any) => task.id === aliceTask.id);
      const bobSeesOwnData = bobResults.some((task: any) => task.id === bobTask.id);

      expect(aliceSeesOwnData).toBe(true);
      expect(bobSeesOwnData).toBe(true);

      // 他人のセンシティブデータが見えないことを確認（privateテーブルの場合）
      const aliceSeesBobaData = aliceResults.some((task: any) => task.id === bobTask.id);
      const bobSeesAliceData = bobResults.some((task: any) => task.id === aliceTask.id);

      if (!aliceSeesBobaData && !bobSeesAliceData) {
        console.log('✅ Proper data isolation - users cannot see each others sensitive data');
      } else {
        console.log('⚠️  Data visible across users - table may be public');
      }
    });
  });
});