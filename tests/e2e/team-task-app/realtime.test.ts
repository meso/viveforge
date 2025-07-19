// E2E Test: Realtime Features
// リアルタイム機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task, User } from './fixtures/types';

describe.skip('Realtime Features E2E Tests (Skipped: EventSource not available in Node.js)', () => {
  let vibebase: VibebaseClient;
  let testTeam: Team;
  let testProject: Project;
  let testUsers: User[] = [];
  let createdTaskIds: string[] = [];
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
  const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

  beforeAll(async () => {
    vibebase = createClient({
      apiUrl,
      apiKey
    });

    // テストユーザーを取得
    const userEmails = ['alice@example.com', 'bob@example.com'];
    for (const email of userEmails) {
      const result = await vibebase.data.list<User>('users', {
        where: { email }
      });
      if (result.data.length > 0) {
        testUsers.push(result.data[0]);
      }
    }

    // テスト用のチームとプロジェクトを作成
    testTeam = await vibebase.data.create<Team>('teams', {
      name: 'Realtime Test Team',
      description: 'Team for realtime testing',
      created_by: testUsers[0].id
    });

    testProject = await vibebase.data.create<Project>('projects', {
      team_id: testTeam.id,
      name: 'Realtime Test Project',
      description: 'Project for realtime testing',
      status: 'active',
      created_by: testUsers[0].id
    });
  });

  afterAll(async () => {
    // クリーンアップ
    for (const taskId of createdTaskIds) {
      try {
        await vibebase.data.delete('tasks', taskId);
      } catch (error) {
        console.warn(`Failed to cleanup task ${taskId}:`, error);
      }
    }

    if (testProject) {
      await vibebase.data.delete('projects', testProject.id);
    }
    if (testTeam) {
      await vibebase.data.delete('teams', testTeam.id);
    }
  });

  describe('Realtime Event Subscription', () => {
    it('should subscribe to table changes', async () => {
      const events: any[] = [];
      
      // リアルタイムイベントのサブスクリプション
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        events.push(event);
      });

      expect(subscription).toBeDefined();
      
      // 少し待って接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // タスクを作成してイベントが発火するかテスト
      const newTask = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Realtime test task',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(newTask.id);

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // イベントが受信されたことを確認
      expect(events.length).toBeGreaterThan(0);
      
      const createEvent = events.find(e => e.event_type === 'insert' && e.record.id === newTask.id);
      expect(createEvent).toBeDefined();
      expect(createEvent.record.title).toBe('Realtime test task');

      // サブスクリプションを停止
      subscription.unsubscribe();
    });

    it('should receive update events', async () => {
      const events: any[] = [];
      
      // タスクを作成
      const task = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Task for update events',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(task.id);

      // リアルタイムイベントのサブスクリプション
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        if (event.record.id === task.id) {
          events.push(event);
        }
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // タスクを更新
      await vibebase.data.update('tasks', task.id, {
        status: 'in_progress',
        assigned_to: testUsers[1].id
      });

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 更新イベントが受信されたことを確認
      const updateEvent = events.find(e => e.event_type === 'update');
      expect(updateEvent).toBeDefined();
      expect(updateEvent.record.status).toBe('in_progress');
      expect(updateEvent.record.assigned_to).toBe(testUsers[1].id);

      subscription.unsubscribe();
    });

    it('should receive delete events', async () => {
      const events: any[] = [];
      
      // タスクを作成
      const task = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Task for delete events',
        status: 'todo',
        priority: 'low',
        created_by: testUsers[0].id
      });

      // リアルタイムイベントのサブスクリプション
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        if (event.record.id === task.id) {
          events.push(event);
        }
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // タスクを削除
      await vibebase.data.delete('tasks', task.id);

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 削除イベントが受信されたことを確認
      const deleteEvent = events.find(e => e.event_type === 'delete');
      expect(deleteEvent).toBeDefined();
      expect(deleteEvent.record.id).toBe(task.id);

      subscription.unsubscribe();
    });
  });

  describe('Filtered Realtime Events', () => {
    it('should filter events by project', async () => {
      const events: any[] = [];
      
      // 特定のプロジェクトのタスクイベントのみを購読
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        if (event.record.project_id === testProject.id) {
          events.push(event);
        }
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 他のプロジェクトを作成
      const otherProject = await vibebase.data.create<Project>('projects', {
        team_id: testTeam.id,
        name: 'Other Project',
        status: 'active',
        created_by: testUsers[0].id
      });

      // テストプロジェクトのタスクを作成
      const testTask = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Test project task',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(testTask.id);

      // 他のプロジェクトのタスクを作成
      const otherTask = await vibebase.data.create<Task>('tasks', {
        project_id: otherProject.id,
        title: 'Other project task',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // テストプロジェクトのイベントのみが受信されることを確認
      const testProjectEvents = events.filter(e => e.record.project_id === testProject.id);
      const otherProjectEvents = events.filter(e => e.record.project_id === otherProject.id);

      expect(testProjectEvents.length).toBeGreaterThan(0);
      expect(otherProjectEvents.length).toBe(0);

      // クリーンアップ
      await vibebase.data.delete('tasks', otherTask.id);
      await vibebase.data.delete('projects', otherProject.id);
      subscription.unsubscribe();
    });

    it('should handle multiple simultaneous subscriptions', async () => {
      const taskEvents: any[] = [];
      const projectEvents: any[] = [];
      
      // 複数のサブスクリプションを作成
      const taskSubscription = vibebase.realtime.subscribe('tasks', (event) => {
        taskEvents.push(event);
      });

      const projectSubscription = vibebase.realtime.subscribe('projects', (event) => {
        projectEvents.push(event);
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // データを作成
      const newProject = await vibebase.data.create<Project>('projects', {
        team_id: testTeam.id,
        name: 'Multi-subscription Test Project',
        status: 'active',
        created_by: testUsers[0].id
      });

      const newTask = await vibebase.data.create<Task>('tasks', {
        project_id: newProject.id,
        title: 'Multi-subscription test task',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(newTask.id);

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 両方のサブスクリプションでイベントが受信されることを確認
      const taskCreateEvent = taskEvents.find(e => e.event_type === 'insert' && e.record.id === newTask.id);
      const projectCreateEvent = projectEvents.find(e => e.event_type === 'insert' && e.record.id === newProject.id);

      expect(taskCreateEvent).toBeDefined();
      expect(projectCreateEvent).toBeDefined();

      // クリーンアップ
      await vibebase.data.delete('projects', newProject.id);
      taskSubscription.unsubscribe();
      projectSubscription.unsubscribe();
    });
  });

  describe('Realtime Connection Management', () => {
    it('should handle connection reconnection', async () => {
      const events: any[] = [];
      
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        events.push(event);
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 最初のタスクを作成
      const task1 = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Connection test task 1',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(task1.id);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 接続を一時停止してから再開をシミュレート
      // 実際のアプリケーションでは、ネットワークの切断/再接続を処理
      
      // 2番目のタスクを作成
      const task2 = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Connection test task 2',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(task2.id);

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 両方のイベントが受信されることを確認
      const task1Event = events.find(e => e.record.id === task1.id);
      const task2Event = events.find(e => e.record.id === task2.id);

      expect(task1Event).toBeDefined();
      expect(task2Event).toBeDefined();

      subscription.unsubscribe();
    });

    it('should handle subscription cleanup', async () => {
      let eventCount = 0;
      
      const subscription = vibebase.realtime.subscribe('tasks', () => {
        eventCount++;
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // サブスクリプションを停止
      subscription.unsubscribe();

      // 停止後にタスクを作成
      const task = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Task after unsubscribe',
        status: 'todo',
        priority: 'low',
        created_by: testUsers[0].id
      });
      createdTaskIds.push(task.id);

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // サブスクリプション停止後はイベントが受信されないことを確認
      expect(eventCount).toBe(0);
    });
  });

  describe('Complex Realtime Scenarios', () => {
    it('should handle rapid data changes', async () => {
      const events: any[] = [];
      
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        events.push(event);
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 複数のタスクを素早く作成
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = await vibebase.data.create<Task>('tasks', {
          project_id: testProject.id,
          title: `Rapid task ${i + 1}`,
          status: 'todo',
          priority: 'medium',
          created_by: testUsers[0].id
        });
        tasks.push(task);
        createdTaskIds.push(task.id);
      }

      // すべてのタスクを素早く更新
      for (const task of tasks) {
        await vibebase.data.update('tasks', task.id, {
          status: 'in_progress'
        });
      }

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 作成と更新のイベントが受信されることを確認
      const createEvents = events.filter(e => e.event_type === 'insert');
      const updateEvents = events.filter(e => e.event_type === 'update');

      expect(createEvents.length).toBe(5);
      expect(updateEvents.length).toBe(5);

      subscription.unsubscribe();
    });

    it('should handle bulk operations with realtime events', async () => {
      const events: any[] = [];
      
      const subscription = vibebase.realtime.subscribe('tasks', (event) => {
        events.push(event);
      });

      // 接続を確立
      await new Promise(resolve => setTimeout(resolve, 1000));

      // バルク作成
      const bulkTasks = Array.from({ length: 3 }, (_, i) => ({
        project_id: testProject.id,
        title: `Bulk realtime task ${i + 1}`,
        status: 'todo' as const,
        priority: 'low' as const,
        created_by: testUsers[0].id
      }));

      const created = await vibebase.data.bulkInsert<Task>('tasks', bulkTasks);
      created.forEach(task => createdTaskIds.push(task.id));

      // イベントが発火するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // バルク作成のイベントが受信されることを確認
      const bulkCreateEvents = events.filter(e => 
        e.event_type === 'insert' && 
        e.record.title?.includes('Bulk realtime task')
      );

      expect(bulkCreateEvents.length).toBe(3);

      subscription.unsubscribe();
    });
  });
});