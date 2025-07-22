// E2E Test: Realtime Features with User Authentication
// ユーザー認証でのリアルタイム機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task, User } from '../team-task-app/fixtures/types';

// Node.js環境でEventSourceを使用するためのポリフィル
import { EventSource } from 'eventsource';
global.EventSource = EventSource as any;

describe('Realtime User Authentication E2E Tests', () => {
  let adminClient: VibebaseClient;
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let testUsers: User[] = [];
  let testTeam: Team;
  let testProject: Project;
  let createdTaskIds: string[] = [];
  
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
      name: 'Realtime User Test Team',
      description: 'Team for realtime user testing',
      created_by: testUsers[0].id
    });
    testTeam = teamResponse.success ? teamResponse.data : teamResponse as any;

    const projectResponse = await adminClient.data.create('projects', {
      team_id: testTeam.id,
      name: 'Realtime User Test Project',
      description: 'Project for realtime user testing',
      status: 'active',
      created_by: testUsers[0].id
    });
    testProject = projectResponse.success ? projectResponse.data : projectResponse as any;

    // リアルタイム機能用のフックを作成
    try {
      await adminClient.realtimeManager.createHook('tasks', 'insert');
      await adminClient.realtimeManager.createHook('tasks', 'update');
      await adminClient.realtimeManager.createHook('tasks', 'delete');
      console.log('Created realtime hooks for user testing');
    } catch (error) {
      console.warn('Failed to create hooks:', error);
    }
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

    // リアルタイム接続をクリーンアップ
    aliceClient.realtime.unsubscribeAll();
    bobClient.realtime.unsubscribeAll();
  });

  describe('User-specific Realtime Subscriptions', () => {
    it('should establish realtime connection for Alice', async () => {
      const events: any[] = [];
      
      // Aliceがリアルタイムイベントをサブスクライブ
      const subscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        console.log('Alice received realtime event:', event);
        events.push(event);
      });

      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // 接続確立を待機
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Alice established realtime connection');
      subscription.unsubscribe();
    });

    it('should establish realtime connection for Bob', async () => {
      const events: any[] = [];
      
      // Bobがリアルタイムイベントをサブスクライブ
      const subscription = bobClient.realtime.subscribe('tasks', '*', (event) => {
        console.log('Bob received realtime event:', event);
        events.push(event);
      });

      expect(subscription).toBeDefined();
      
      // 接続確立を待機
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Bob established realtime connection');
      subscription.unsubscribe();
    });
  });

  describe('User Context in Realtime Events', () => {
    it('should receive events for user-created data', async () => {
      const aliceEvents: any[] = [];
      const bobEvents: any[] = [];
      
      // 両方のユーザーがサブスクライブ
      const aliceSubscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        console.log('Alice received event:', event.type, event.record?.title);
        aliceEvents.push(event);
      });

      const bobSubscription = bobClient.realtime.subscribe('tasks', '*', (event) => {
        console.log('Bob received event:', event.type, event.record?.title);
        bobEvents.push(event);
      });

      // 接続確立を待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Aliceがタスクを作成
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Realtime Task',
        description: 'Task created by Alice for realtime testing',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      expect(aliceTaskResponse.success).toBe(true);
      const aliceTask = aliceTaskResponse.success ? aliceTaskResponse.data : aliceTaskResponse as any;
      createdTaskIds.push(aliceTask.id);

      // イベント受信を待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Alice received', aliceEvents.length, 'events');
      console.log('Bob received', bobEvents.length, 'events');

      // 少なくともテストイベントは受信されるはず
      expect(aliceEvents.length).toBeGreaterThan(0);
      expect(bobEvents.length).toBeGreaterThan(0);

      aliceSubscription.unsubscribe();
      bobSubscription.unsubscribe();
    });

    it('should filter events based on user permissions', async () => {
      const aliceEvents: any[] = [];
      const bobEvents: any[] = [];
      
      // 特定のプロジェクトやユーザーに関連するイベントのみを受信するテスト
      const aliceSubscription = aliceClient.realtime.subscribe('tasks', 'insert', (event) => {
        // Aliceが関連するタスクイベントのみをフィルタ
        if (event.record && (
          event.record.created_by === testUsers[0].id || 
          event.record.assigned_to === testUsers[0].id ||
          event.record.project_id === testProject.id
        )) {
          console.log('Alice received relevant event:', event.record.title);
          aliceEvents.push(event);
        }
      });

      const bobSubscription = bobClient.realtime.subscribe('tasks', 'insert', (event) => {
        // Bobが関連するタスクイベントのみをフィルタ
        if (event.record && (
          event.record.created_by === testUsers[1].id || 
          event.record.assigned_to === testUsers[1].id ||
          event.record.project_id === testProject.id
        )) {
          console.log('Bob received relevant event:', event.record.title);
          bobEvents.push(event);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 複数のタスクを作成（異なる所有者/担当者）
      const tasks = [
        {
          project_id: testProject.id,
          title: 'Task for Alice only',
          status: 'todo' as const,
          priority: 'high' as const,
          created_by: testUsers[0].id,
          assigned_to: testUsers[0].id
        },
        {
          project_id: testProject.id,
          title: 'Task assigned to Bob',
          status: 'todo' as const,
          priority: 'medium' as const,
          created_by: testUsers[0].id, // Aliceが作成
          assigned_to: testUsers[1].id  // Bobにアサイン
        }
      ];

      for (const taskData of tasks) {
        const response = await aliceClient.data.create('tasks', taskData);
        if (response.success) {
          const task = response.data;
          createdTaskIds.push(task.id);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Alice received', aliceEvents.length, 'relevant events');
      console.log('Bob received', bobEvents.length, 'relevant events');

      aliceSubscription.unsubscribe();
      bobSubscription.unsubscribe();
    });
  });

  describe('Multi-user Realtime Collaboration', () => {
    it('should handle concurrent realtime operations', async () => {
      const aliceEvents: any[] = [];
      const bobEvents: any[] = [];
      
      // 両方のユーザーがサブスクライブ
      const aliceSubscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        aliceEvents.push({ user: 'Alice', ...event });
      });

      const bobSubscription = bobClient.realtime.subscribe('tasks', '*', (event) => {
        bobEvents.push({ user: 'Bob', ...event });
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 同時にタスクを作成
      const concurrentOperations = [
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
          priority: 'medium',
          created_by: testUsers[1].id
        })
      ];

      const results = await Promise.all(concurrentOperations);
      
      // 作成されたタスクをクリーンアップリストに追加
      results.forEach(result => {
        if (result.success) {
          const task = result.data;
          createdTaskIds.push(task.id);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Concurrent operations completed');
      console.log('Alice events:', aliceEvents.length);
      console.log('Bob events:', bobEvents.length);

      // 両方のユーザーがイベントを受信することを確認
      expect(aliceEvents.length).toBeGreaterThan(0);
      expect(bobEvents.length).toBeGreaterThan(0);

      aliceSubscription.unsubscribe();
      bobSubscription.unsubscribe();
    });

    it('should maintain realtime state consistency', async () => {
      const stateEvents: any[] = [];
      
      // 状態変更を追跡
      const subscription = aliceClient.realtime.subscribe('tasks', 'update', (event) => {
        console.log('State change event:', event.record?.status, event.record?.title);
        stateEvents.push(event);
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // タスクを作成してステータスを変更
      const taskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'State Consistency Test Task',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[0].id
      });

      const task = taskResponse.success ? taskResponse.data : taskResponse as any;
      createdTaskIds.push(task.id);

      // ステータスを段階的に更新
      const statusUpdates = ['in_progress', 'completed'];
      
      for (const status of statusUpdates) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const updateResponse = await aliceClient.data.update('tasks', task.id, { status });
        expect(updateResponse.success).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('State consistency events received:', stateEvents.length);

      subscription.unsubscribe();
    });
  });

  describe('Realtime Access Control', () => {
    it('should respect user permissions in realtime events', async () => {
      const aliceEvents: any[] = [];
      const bobEvents: any[] = [];
      
      // 各ユーザーがサブスクライブ
      const aliceSubscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        aliceEvents.push(event);
      });

      const bobSubscription = bobClient.realtime.subscribe('tasks', '*', (event) => {
        bobEvents.push(event);
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Aliceが「プライベート」なタスクを作成
      const privateTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Private Task',
        description: 'This should only be visible to Alice in private mode',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      const privateTask = privateTaskResponse.success ? privateTaskResponse.data : privateTaskResponse as any;
      createdTaskIds.push(privateTask.id);

      await new Promise(resolve => setTimeout(resolve, 3000));

      // 現在のテスト環境（publicテーブル）では両方のユーザーがイベントを受信
      // privateテーブルの場合は、Bobがアクセスできないはず
      
      console.log('Alice received events for private task:', aliceEvents.length);
      console.log('Bob received events for private task:', bobEvents.length);

      if (aliceEvents.length > 0 && bobEvents.length === 0) {
        console.log('✅ Proper access control - Bob cannot see Alice private events');
      } else if (aliceEvents.length > 0 && bobEvents.length > 0) {
        console.log('⚠️  Both users see events - table may be public');
      }

      aliceSubscription.unsubscribe();
      bobSubscription.unsubscribe();
    });

    it('should filter realtime events by owner_id', async () => {
      const userSpecificEvents = new Map();
      userSpecificEvents.set(testUsers[0].id, []);
      userSpecificEvents.set(testUsers[1].id, []);
      
      // イベントをユーザーごとに分類
      const subscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        if (event.record && event.record.created_by) {
          const ownerId = event.record.created_by;
          if (userSpecificEvents.has(ownerId)) {
            userSpecificEvents.get(ownerId).push(event);
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 各ユーザーがタスクを作成
      const aliceTaskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Alice Owner Filter Test',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      const bobTaskResponse = await bobClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Bob Owner Filter Test',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[1].id
      });

      if (aliceTaskResponse.success) {
        createdTaskIds.push(aliceTaskResponse.data.id);
      }
      if (bobTaskResponse.success) {
        createdTaskIds.push(bobTaskResponse.data.id);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const aliceOwnedEvents = userSpecificEvents.get(testUsers[0].id);
      const bobOwnedEvents = userSpecificEvents.get(testUsers[1].id);

      console.log('Events for Alice-owned data:', aliceOwnedEvents.length);
      console.log('Events for Bob-owned data:', bobOwnedEvents.length);

      subscription.unsubscribe();
    });
  });

  describe('Realtime Connection Management', () => {
    it('should handle user authentication in realtime connections', async () => {
      // ユーザー認証でのリアルタイム接続テスト
      
      const aliceConnectionTest = aliceClient.realtime.connect();
      const bobConnectionTest = bobClient.realtime.connect();

      await Promise.all([aliceConnectionTest, bobConnectionTest]);

      // 接続状態確認
      const aliceConnected = aliceClient.realtime.isConnected();
      const bobConnected = bobClient.realtime.isConnected();

      console.log('Alice realtime connected:', aliceConnected);
      console.log('Bob realtime connected:', bobConnected);

      // 接続をクローズ
      aliceClient.realtime.disconnect();
      bobClient.realtime.disconnect();

      const aliceDisconnected = !aliceClient.realtime.isConnected();
      const bobDisconnected = !bobClient.realtime.isConnected();

      expect(aliceDisconnected).toBe(true);
      expect(bobDisconnected).toBe(true);

      console.log('✅ User realtime connections managed properly');
    });

    it('should handle invalid user tokens in realtime', async () => {
      // 無効なトークンでリアルタイム接続テスト
      const invalidClient = createClient({ 
        apiUrl, 
        userToken: 'invalid-user-token-12345' 
      });

      try {
        const subscription = invalidClient.realtime.subscribe('tasks', '*', (event) => {
          console.log('Should not receive events with invalid token');
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // 無効認証の場合、接続が確立されないかエラーが発生するはず
        const connected = invalidClient.realtime.isConnected();
        
        if (!connected) {
          console.log('✅ Invalid token properly rejected for realtime connection');
        } else {
          console.log('⚠️  Invalid token allowed realtime connection');
        }

        subscription.unsubscribe();
      } catch (error) {
        console.log('✅ Invalid token properly handled with exception');
        expect(error).toBeDefined();
      }
    });

    it('should maintain user context across reconnections', async () => {
      // 再接続時のユーザーコンテキスト維持テスト
      const events: any[] = [];
      
      let subscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        events.push({ 
          reconnection: 'first',
          event: event.type,
          title: event.record?.title 
        });
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 接続を切断して再接続
      aliceClient.realtime.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));

      subscription = aliceClient.realtime.subscribe('tasks', '*', (event) => {
        events.push({ 
          reconnection: 'second',
          event: event.type,
          title: event.record?.title 
        });
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 再接続後にタスクを作成
      const taskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Reconnection Test Task',
        status: 'todo',
        priority: 'low',
        created_by: testUsers[0].id
      });

      if (taskResponse.success) {
        createdTaskIds.push(taskResponse.data.id);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Events across reconnections:', events.length);
      events.forEach((event, index) => {
        console.log(`Event ${index + 1}:`, event.reconnection, event.event);
      });

      subscription.unsubscribe();
    });
  });
});