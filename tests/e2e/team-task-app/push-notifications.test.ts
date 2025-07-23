// E2E Test: Push Notifications Features
// Push通知機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { NotificationPayload, PushRule, PushSubscriptionData, DeviceInfo } from '@vibebase/sdk';
import type { Team, Project, Task, User } from './fixtures/types';

describe('Push Notifications Features E2E Tests (Requires VAPID setup)', () => {
  let vibebase: VibebaseClient;
  let testTeam: Team;
  let testProject: Project;
  let testUsers: User[] = [];
  let createdRules: string[] = [];
  let mockSubscription: PushSubscriptionData;
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
  const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

  // モックのプッシュサブスクリプション
  const mockPushSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-12345',
    keys: {
      p256dh: 'test-p256dh-key-for-e2e-testing',
      auth: 'test-auth-key-for-e2e-testing'
    }
  };

  const mockDeviceInfo: DeviceInfo = {
    userAgent: 'Mozilla/5.0 (Test Browser for E2E)',
    platform: 'Test Platform',
    vendor: 'Test Vendor',
    language: 'ja-JP'
  };

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
      name: 'Push Notifications Test Team',
      description: 'Team for push notifications testing',
      created_by: testUsers[0].id
    });

    testProject = await vibebase.data.create<Project>('projects', {
      team_id: testTeam.id,
      name: 'Push Test Project',
      description: 'Project for push notifications testing',
      status: 'active',
      created_by: testUsers[0].id
    });
  });

  afterAll(async () => {
    // クリーンアップ
    for (const ruleId of createdRules) {
      try {
        await vibebase.push.deleteRule(ruleId);
      } catch (error) {
        console.warn(`Failed to cleanup push rule ${ruleId}:`, error);
      }
    }

    // プッシュサブスクリプションのクリーンアップ
    if (mockSubscription) {
      try {
        await vibebase.push.unsubscribe(mockSubscription.endpoint);
      } catch (error) {
        console.warn('Failed to cleanup push subscription:', error);
      }
    }

    // プロジェクトのタスクを削除
    const tasksResult = await vibebase.data.list<Task>('tasks', {
      where: { project_id: testProject.id }
    });
    for (const task of tasksResult.data) {
      await vibebase.data.delete('tasks', task.id);
    }

    if (testProject) {
      await vibebase.data.delete('projects', testProject.id);
    }
    if (testTeam) {
      await vibebase.data.delete('teams', testTeam.id);
    }
  });

  describe('VAPID Configuration', () => {
    it('should get VAPID public key', async () => {
      const result = await vibebase.push.getVapidPublicKey();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.publicKey).toBeDefined();
      expect(typeof result.data.publicKey).toBe('string');
      expect(result.data.publicKey.length).toBeGreaterThan(0);
    });
  });

  describe.skip('Push Subscription Management (Requires user auth)', () => {
    it('should subscribe to push notifications', async () => {
      const result = await vibebase.push.subscribe(mockPushSubscription, mockDeviceInfo);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.endpoint).toBe(mockPushSubscription.endpoint);
      expect(result.data.device_info.userAgent).toBe(mockDeviceInfo.userAgent);
      expect(result.data.is_active).toBe(true);
      
      mockSubscription = result.data;
    });

    it('should list push subscriptions', async () => {
      const result = await vibebase.push.listSubscriptions();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      const subscription = result.data.find(s => s.endpoint === mockPushSubscription.endpoint);
      expect(subscription).toBeDefined();
      expect(subscription?.is_active).toBe(true);
    });

    it('should list subscriptions for specific user', async () => {
      const result = await vibebase.push.listSubscriptions(testUsers[0].id);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle duplicate subscription', async () => {
      // 同じエンドポイントで再度購読を試行
      const result = await vibebase.push.subscribe(mockPushSubscription, mockDeviceInfo);

      // 重複は許可されるか、既存のものが更新される
      expect(result.success).toBe(true);
    });
  });

  describe('Manual Push Notifications', () => {
    it('should send notification to all users', async () => {
      const notification: NotificationPayload = {
        title: 'E2E Test Notification',
        body: 'This is a test notification from E2E tests',
        icon: '/favicon.svg',
        data: {
          testId: 'e2e-test-1',
          timestamp: new Date().toISOString()
        }
      };

      const result = await vibebase.push.send(notification, {
        allUsers: true
      });

      // With API key authentication, should succeed
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.result).toBeDefined();
      expect(typeof result.data.result.sent).toBe('number');
      expect(typeof result.data.result.failed).toBe('number');
    });

    it('should send notification to specific users', async () => {
      const notification: NotificationPayload = {
        title: 'Targeted Notification',
        body: 'This notification is sent to specific users',
        icon: '/favicon.svg',
        tag: 'targeted-notification',
        requireInteraction: true
      };

      const result = await vibebase.push.send(notification, {
        userIds: [testUsers[0].id]
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBeDefined();
      expect(typeof result.data.result.sent).toBe('number');
      expect(typeof result.data.result.failed).toBe('number');
    });

    it('should send rich notification with actions', async () => {
      const notification: NotificationPayload = {
        title: 'Action Notification',
        body: 'This notification has action buttons',
        icon: '/favicon.svg',
        image: '/test-image.png',
        actions: [
          {
            action: 'view',
            title: 'View Details',
            icon: '/view-icon.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ],
        data: {
          actionable: true,
          url: '/notifications/123'
        }
      };

      const result = await vibebase.push.send(notification, {
        userIds: [testUsers[0].id]
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBeDefined();
    });

    it('should handle empty recipients', async () => {
      const notification: NotificationPayload = {
        title: 'No Recipients Test',
        body: 'This should handle empty recipients gracefully'
      };

      const result = await vibebase.push.send(notification, {
        userIds: []
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBeDefined();
      expect(result.data.result.sent).toBe(0);
      expect(result.data.result.failed).toBe(0);
    });
  });

  describe.skip('Notification Rules Management (Requires admin auth)', () => {
    it('should create a database change notification rule', async () => {
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'New Task Notification',
        triggerType: 'db_change',
        tableName: 'tasks',
        eventType: 'insert',
        recipientType: 'all_users',
        titleTemplate: 'New Task Created',
        bodyTemplate: 'Task "{{title}}" was created in project {{project_name}}',
        iconUrl: '/favicon.svg',
        clickAction: '/tasks/{{id}}',
        isEnabled: true
      };

      const result = await vibebase.push.createRule(rule);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(rule.name);
      expect(result.data.triggerType).toBe(rule.triggerType);
      expect(result.data.isEnabled).toBe(true);
      
      createdRules.push(result.data.id);
    });

    it('should create a manual notification rule', async () => {
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Weekly Summary',
        triggerType: 'manual',
        recipientType: 'all_users',
        titleTemplate: 'Weekly Project Summary',
        bodyTemplate: 'Here is your weekly summary for all active projects',
        iconUrl: '/summary-icon.svg',
        isEnabled: true
      };

      const result = await vibebase.push.createRule(rule);

      expect(result.success).toBe(true);
      expect(result.data.triggerType).toBe('manual');
      
      createdRules.push(result.data.id);
    });

    it('should list notification rules', async () => {
      const result = await vibebase.push.listRules();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      const createdRule = result.data.find(r => r.name === 'New Task Notification');
      expect(createdRule).toBeDefined();
    });

    it('should get a specific notification rule', async () => {
      const ruleId = createdRules[0];
      
      const result = await vibebase.push.getRule(ruleId);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(ruleId);
      expect(result.data.name).toBe('New Task Notification');
    });

    it('should update a notification rule', async () => {
      const ruleId = createdRules[0];
      const updates = {
        name: 'Updated Task Notification',
        bodyTemplate: 'Updated: Task "{{title}}" was created',
        isEnabled: false
      };

      const result = await vibebase.push.updateRule(ruleId, updates);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(updates.name);
      expect(result.data.bodyTemplate).toBe(updates.bodyTemplate);
      expect(result.data.isEnabled).toBe(false);
    });

    it('should toggle notification rule status', async () => {
      const ruleId = createdRules[0];

      // 有効化
      const enableResult = await vibebase.push.toggleRule(ruleId, true);
      expect(enableResult.success).toBe(true);
      expect(enableResult.data.isEnabled).toBe(true);

      // 無効化
      const disableResult = await vibebase.push.toggleRule(ruleId, false);
      expect(disableResult.success).toBe(true);
      expect(disableResult.data.isEnabled).toBe(false);
    });
  });

  describe.skip('Triggered Notifications (Requires admin auth)', () => {
    it('should trigger notification when task is created', async () => {
      // 有効なルールを確認
      const ruleId = createdRules[0];
      await vibebase.push.toggleRule(ruleId, true);

      // タスクを作成してトリガーをテスト
      const task = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Notification Trigger Test Task',
        description: 'This task should trigger a push notification',
        status: 'todo',
        priority: 'high',
        created_by: testUsers[0].id
      });

      // 少し待ってから通知ログを確認
      await new Promise(resolve => setTimeout(resolve, 2000));

      const logsResult = await vibebase.push.getLogs({
        limit: 10
      });

      expect(logsResult.success).toBe(true);
      expect(logsResult.data.logs.length).toBeGreaterThan(0);

      // クリーンアップ
      await vibebase.data.delete('tasks', task.id);
    });

    it('should handle rule with specific recipients', async () => {
      // 特定ユーザー向けのルールを作成
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Specific User Task Update',
        triggerType: 'db_change',
        tableName: 'tasks',
        eventType: 'update',
        recipientType: 'specific_users',
        recipients: [testUsers[0].id],
        titleTemplate: 'Task Updated',
        bodyTemplate: 'Task "{{title}}" status changed to {{status}}',
        isEnabled: true
      };

      const createResult = await vibebase.push.createRule(rule);
      expect(createResult.success).toBe(true);
      createdRules.push(createResult.data.id);

      // タスクを作成して更新
      const task = await vibebase.data.create<Task>('tasks', {
        project_id: testProject.id,
        title: 'Update Trigger Test',
        status: 'todo',
        priority: 'medium',
        created_by: testUsers[0].id
      });

      // タスクを更新
      await vibebase.data.update('tasks', task.id, {
        status: 'in_progress'
      });

      // 少し待ってから通知ログを確認
      await new Promise(resolve => setTimeout(resolve, 2000));

      const logsResult = await vibebase.push.getLogs({
        limit: 5,
        ruleId: createResult.data.id
      });

      expect(logsResult.success).toBe(true);

      // クリーンアップ
      await vibebase.data.delete('tasks', task.id);
    });
  });

  describe.skip('Notification Testing (Requires subscription)', () => {
    it('should test notification delivery to specific endpoint', async () => {
      const notification: NotificationPayload = {
        title: 'Test Notification',
        body: 'This is a test notification for endpoint testing',
        icon: '/test-icon.svg'
      };

      const result = await vibebase.push.testNotification(
        notification,
        mockSubscription.endpoint
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.success).toBe('boolean');
    });

    it('should handle test notification to invalid endpoint', async () => {
      const notification: NotificationPayload = {
        title: 'Test Invalid Endpoint',
        body: 'This should fail gracefully'
      };

      try {
        await vibebase.push.testNotification(
          notification,
          'https://invalid-endpoint.example.com/test'
        );
      } catch (error: any) {
        expect(error.message).toContain('invalid');
      }
    });
  });

  describe.skip('Notification Logs and Analytics (Requires admin auth)', () => {
    it('should get notification logs', async () => {
      const result = await vibebase.push.getLogs({
        limit: 20,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data.logs)).toBe(true);
      expect(typeof result.data.total).toBe('number');

      if (result.data.logs.length > 0) {
        const log = result.data.logs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('title');
        expect(log).toHaveProperty('body');
        expect(log).toHaveProperty('recipient_count');
        expect(log).toHaveProperty('success_count');
        expect(log).toHaveProperty('created_at');
      }
    });

    it('should get logs filtered by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await vibebase.push.getLogs({
        startDate: oneHourAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.logs)).toBe(true);
    });

    it('should get logs filtered by rule ID', async () => {
      if (createdRules.length > 0) {
        const result = await vibebase.push.getLogs({
          ruleId: createdRules[0],
          limit: 10
        });

        expect(result.success).toBe(true);
        expect(Array.isArray(result.data.logs)).toBe(true);

        // フィルターされたログはすべて指定したrule_idを持つべき
        for (const log of result.data.logs) {
          if (log.rule_id) {
            expect(log.rule_id).toBe(createdRules[0]);
          }
        }
      }
    });

    it('should get push notification statistics', async () => {
      const result = await vibebase.push.getStats();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.total_notifications).toBe('number');
      expect(typeof result.data.success_rate).toBe('number');
      expect(typeof result.data.active_subscriptions).toBe('number');
      expect(typeof result.data.rules_count).toBe('number');

      // 成功率は0-1の範囲であるべき
      expect(result.data.success_rate).toBeGreaterThanOrEqual(0);
      expect(result.data.success_rate).toBeLessThanOrEqual(1);
    });

    it('should get statistics with date range', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const result = await vibebase.push.getStats({
        startDate: oneDayAgo.toISOString(),
        endDate: now.toISOString()
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe.skip('Subscription Cleanup (Requires subscription)', () => {
    it('should unsubscribe from push notifications', async () => {
      const result = await vibebase.push.unsubscribe(mockSubscription.endpoint);

      expect(result.success).toBe(true);

      // サブスクリプションが削除されたことを確認
      const listResult = await vibebase.push.listSubscriptions();
      const subscription = listResult.data.find(s => s.endpoint === mockSubscription.endpoint);
      expect(subscription?.is_active).toBe(false);
    });

    it('should handle unsubscribe from non-existent endpoint', async () => {
      try {
        await vibebase.push.unsubscribe('https://non-existent-endpoint.example.com/test');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid notification payload', async () => {
      const invalidNotification = {
        // title が不足
        body: 'Body without title'
      } as NotificationPayload;

      try {
        const result = await vibebase.push.send(invalidNotification, { allUsers: true });
        // Should fail with validation error
        expect(result.success).toBe(false);
      } catch (error: any) {
        // Error handling is also acceptable
        expect(error.message).toBeDefined();
      }
    });

    it.skip('should handle rule with invalid table name (requires admin auth)', async () => {
      const invalidRule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Invalid Table Rule',
        triggerType: 'db_change',
        tableName: 'non_existent_table',
        eventType: 'insert',
        recipientType: 'all_users',
        titleTemplate: 'Test',
        bodyTemplate: 'Test body',
        isEnabled: true
      };

      try {
        await vibebase.push.createRule(invalidRule);
      } catch (error: any) {
        expect(error.message).toContain('table');
      }
    });

    it.skip('should validate template syntax (requires admin auth)', async () => {
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Invalid Template Rule',
        triggerType: 'db_change',
        tableName: 'tasks',
        eventType: 'insert',
        recipientType: 'all_users',
        titleTemplate: 'Task {{invalid_field}}',
        bodyTemplate: 'Body {{another_invalid_field}}',
        isEnabled: true
      };

      // 無効なテンプレートフィールドでもルール作成は成功するが、
      // 実行時にエラーになる可能性がある
      const result = await vibebase.push.createRule(rule);
      if (result.success) {
        createdRules.push(result.data.id);
      }
    });
  });
});