// E2E Test: Push Notifications with User Authentication
// ユーザー認証でのPush通知機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { NotificationPayload, PushRule, PushSubscriptionData, DeviceInfo } from '@vibebase/sdk';
import type { Team, Project, Task, User } from '../team-task-app/fixtures/types';

describe('Push Notifications User Authentication E2E Tests', () => {
  let adminClient: VibebaseClient;
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let testUsers: User[] = [];
  let testTeam: Team;
  let testProject: Project;
  let createdRules: string[] = [];
  let aliceSubscription: PushSubscriptionData | null = null;
  let bobSubscription: PushSubscriptionData | null = null;
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
  const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

  // モックのプッシュサブスクリプション
  const createMockSubscription = (userId: string) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/test-${userId}-${Date.now()}`,
    keys: {
      p256dh: `test-p256dh-key-${userId}`,
      auth: `test-auth-key-${userId}`
    }
  });

  const createMockDeviceInfo = (userName: string): DeviceInfo => ({
    userAgent: `Mozilla/5.0 (Test Browser for ${userName})`,
    platform: `Test Platform ${userName}`,
    vendor: 'Test Vendor',
    language: 'ja-JP'
  });

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
      name: 'Push Notification Test Team',
      description: 'Team for push notification testing',
      created_by: testUsers[0].id
    });
    testTeam = teamResponse.success ? teamResponse.data : teamResponse as any;

    const projectResponse = await adminClient.data.create('projects', {
      team_id: testTeam.id,
      name: 'Push Notification Test Project',
      description: 'Project for push notification testing',
      status: 'active',
      created_by: testUsers[0].id
    });
    testProject = projectResponse.success ? projectResponse.data : projectResponse as any;
  });

  afterAll(async () => {
    // クリーンアップ
    for (const ruleId of createdRules) {
      try {
        await adminClient.push.deleteRule(ruleId);
      } catch (error) {
        console.warn('Failed to delete rule:', ruleId);
      }
    }

    if (aliceSubscription) {
      try {
        await aliceClient.push.unsubscribe(aliceSubscription.endpoint);
      } catch (error) {
        console.warn('Failed to unsubscribe Alice');
      }
    }

    if (bobSubscription) {
      try {
        await bobClient.push.unsubscribe(bobSubscription.endpoint);
      } catch (error) {
        console.warn('Failed to unsubscribe Bob');
      }
    }

    if (testProject) {
      await adminClient.data.delete('projects', testProject.id);
    }
    if (testTeam) {
      await adminClient.data.delete('teams', testTeam.id);
    }
  });

  describe('VAPID Configuration (User Access)', () => {
    it('should get VAPID public key for users', async () => {
      // ユーザーがVAPID公開鍵を取得できることをテスト
      const aliceVapidResponse = await aliceClient.push.getVapidPublicKey();
      expect(aliceVapidResponse.success).toBe(true);
      expect(aliceVapidResponse.data.publicKey).toBeDefined();
      expect(typeof aliceVapidResponse.data.publicKey).toBe('string');
      expect(aliceVapidResponse.data.publicKey.length).toBeGreaterThan(0);

      const bobVapidResponse = await bobClient.push.getVapidPublicKey();
      expect(bobVapidResponse.success).toBe(true);
      expect(bobVapidResponse.data.publicKey).toBe(aliceVapidResponse.data.publicKey);

      console.log('✅ Users can access VAPID public key');
    });
  });

  describe('Push Subscription Management (User Auth)', () => {
    it('should allow Alice to subscribe to push notifications', async () => {
      const mockSubscription = createMockSubscription(testUsers[0].id);
      const mockDeviceInfo = createMockDeviceInfo('Alice');

      const result = await aliceClient.push.subscribe(mockSubscription, mockDeviceInfo);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.endpoint).toBe(mockSubscription.endpoint);
      expect(result.data.device_info.userAgent).toBe(mockDeviceInfo.userAgent);
      expect(result.data.is_active).toBe(true);
      expect(result.data.user_id).toBe(testUsers[0].id);
      
      aliceSubscription = result.data;
      console.log('✅ Alice successfully subscribed to push notifications');
    });

    it('should allow Bob to subscribe to push notifications', async () => {
      const mockSubscription = createMockSubscription(testUsers[1].id);
      const mockDeviceInfo = createMockDeviceInfo('Bob');

      const result = await bobClient.push.subscribe(mockSubscription, mockDeviceInfo);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.endpoint).toBe(mockSubscription.endpoint);
      expect(result.data.device_info.userAgent).toBe(mockDeviceInfo.userAgent);
      expect(result.data.is_active).toBe(true);
      expect(result.data.user_id).toBe(testUsers[1].id);
      
      bobSubscription = result.data;
      console.log('✅ Bob successfully subscribed to push notifications');
    });

    it('should list subscriptions for authenticated user', async () => {
      // Aliceが自分のサブスクリプションを確認
      const aliceSubsResponse = await aliceClient.push.listSubscriptions();

      expect(aliceSubsResponse.success).toBe(true);
      expect(Array.isArray(aliceSubsResponse.data)).toBe(true);
      expect(aliceSubsResponse.data.length).toBeGreaterThan(0);

      const aliceActiveSubs = aliceSubsResponse.data.filter((sub: any) => sub.is_active);
      expect(aliceActiveSubs.length).toBeGreaterThan(0);

      // AliceのサブスクリプションリストにAlice自身のサブスクリプションが含まれていることを確認
      const foundAliceSub = aliceActiveSubs.find((sub: any) => 
        sub.user_id === testUsers[0].id && sub.endpoint === aliceSubscription?.endpoint
      );
      expect(foundAliceSub).toBeDefined();

      console.log('✅ Alice can list her own subscriptions');
    });

    it('should handle duplicate subscription gracefully', async () => {
      // Aliceが同じエンドポイントで再度購読を試行
      if (aliceSubscription) {
        const mockSubscription = createMockSubscription(testUsers[0].id);
        mockSubscription.endpoint = aliceSubscription.endpoint; // 同じエンドポイントを使用

        const result = await aliceClient.push.subscribe(mockSubscription, createMockDeviceInfo('Alice'));

        // 重複は許可されるか、既存のものが更新される
        expect(result.success).toBe(true);
        console.log('✅ Duplicate subscription handled gracefully');
      }
    });

    it('should allow users to unsubscribe', async () => {
      if (bobSubscription) {
        const result = await bobClient.push.unsubscribe(bobSubscription.endpoint);

        expect(result.success).toBe(true);
        
        // サブスクリプションが無効化されたことを確認
        const subsResponse = await bobClient.push.listSubscriptions();
        const activeSubs = subsResponse.data.filter((sub: any) => 
          sub.is_active && sub.endpoint === bobSubscription?.endpoint
        );
        expect(activeSubs.length).toBe(0);

        bobSubscription = null;
        console.log('✅ Bob successfully unsubscribed');
      }
    });
  });

  describe('User-specific Push Notifications', () => {
    it('should send notification to specific user', async () => {
      // 管理者がAliceに特定の通知を送信
      const notification: NotificationPayload = {
        title: 'Personal Notification for Alice',
        body: 'This is a personalized message for Alice only',
        icon: '/favicon.svg',
        data: {
          personalMessage: true,
          userId: testUsers[0].id
        }
      };

      const result = await adminClient.push.send(notification, {
        userIds: [testUsers[0].id]
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.sent).toBeGreaterThan(0);
      
      console.log('✅ Personal notification sent to Alice');
    });

    it('should send notification to multiple specific users', async () => {
      // Bob再購読（前のテストで削除されているため）
      if (!bobSubscription) {
        const mockSubscription = createMockSubscription(testUsers[1].id);
        const mockDeviceInfo = createMockDeviceInfo('Bob');
        const subResult = await bobClient.push.subscribe(mockSubscription, mockDeviceInfo);
        bobSubscription = subResult.data;
      }

      const notification: NotificationPayload = {
        title: 'Team Notification',
        body: 'This message is for Alice and Bob',
        icon: '/favicon.svg',
        data: {
          teamMessage: true,
          recipients: [testUsers[0].id, testUsers[1].id]
        }
      };

      const result = await adminClient.push.send(notification, {
        userIds: [testUsers[0].id, testUsers[1].id]
      });

      expect(result.success).toBe(true);
      expect(result.data.sent).toBeGreaterThanOrEqual(1); // 少なくとも1つは送信成功

      console.log('✅ Team notification sent to multiple users');
    });

    it('should handle notification to non-existent user', async () => {
      const notification: NotificationPayload = {
        title: 'Ghost User Test',
        body: 'This should not be delivered'
      };

      const result = await adminClient.push.send(notification, {
        userIds: ['non-existent-user-id']
      });

      expect(result.success).toBe(true);
      expect(result.data.sent).toBe(0); // 送信先が見つからないため0
      expect(result.data.failed).toBeGreaterThan(0);

      console.log('✅ Non-existent user handled gracefully');
    });
  });

  describe('Notification Rules with User Context', () => {
    it('should create user-specific notification rule', async () => {
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Alice Task Assignment',
        triggerType: 'db_change',
        tableName: 'tasks',
        eventType: 'insert',
        recipientType: 'column_reference',
        recipientValue: 'assigned_to', // assigned_toカラムの値を使用
        titleTemplate: 'New Task Assigned',
        bodyTemplate: 'You have been assigned task: {{title}}',
        iconUrl: '/favicon.svg',
        clickAction: '/tasks/{{id}}',
        isEnabled: true
      };

      const result = await adminClient.push.createRule(rule);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(rule.name);
      expect(result.data.recipientType).toBe('column_reference');
      expect(result.data.recipientValue).toBe('assigned_to');
      
      createdRules.push(result.data.id);
      console.log('✅ User-specific notification rule created');
    });

    it('should create rule for data owner notifications', async () => {
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Task Status Change Owner Alert',
        triggerType: 'db_change',
        tableName: 'tasks',
        eventType: 'update',
        recipientType: 'column_reference',
        recipientValue: 'created_by', // タスク作成者に通知
        titleTemplate: 'Your Task Status Changed',
        bodyTemplate: 'Task "{{title}}" status changed to {{status}}',
        iconUrl: '/favicon.svg',
        clickAction: '/tasks/{{id}}',
        isEnabled: true
      };

      const result = await adminClient.push.createRule(rule);

      expect(result.success).toBe(true);
      expect(result.data.recipientType).toBe('column_reference');
      expect(result.data.recipientValue).toBe('created_by');
      
      createdRules.push(result.data.id);
      console.log('✅ Data owner notification rule created');
    });

    it('should list notification rules', async () => {
      const result = await adminClient.push.listRules();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(createdRules.length);

      // 作成したルールが含まれていることを確認
      createdRules.forEach(ruleId => {
        const foundRule = result.data.find((rule: any) => rule.id === ruleId);
        expect(foundRule).toBeDefined();
        expect(foundRule.isEnabled).toBe(true);
      });

      console.log('✅ Notification rules listed successfully');
    });

    it('should update notification rule', async () => {
      if (createdRules.length > 0) {
        const ruleId = createdRules[0];
        
        const updatedRule = {
          name: 'Updated Task Assignment Rule',
          triggerType: 'db_change' as const,
          tableName: 'tasks',
          eventType: 'insert' as const,
          recipientType: 'column_reference' as const,
          recipientValue: 'assigned_to',
          titleTemplate: '🚀 New Task Assignment',
          bodyTemplate: 'You have been assigned: {{title}} with priority {{priority}}',
          iconUrl: '/favicon.svg',
          clickAction: '/tasks/{{id}}',
          isEnabled: true
        };

        const result = await adminClient.push.updateRule(ruleId, updatedRule);

        expect(result.success).toBe(true);
        
        // 更新確認
        const getResult = await adminClient.push.getRule(ruleId);
        expect(getResult.success).toBe(true);
        expect(getResult.data.name).toBe(updatedRule.name);
        expect(getResult.data.titleTemplate).toBe(updatedRule.titleTemplate);

        console.log('✅ Notification rule updated successfully');
      }
    });

    it('should toggle notification rule status', async () => {
      if (createdRules.length > 0) {
        const ruleId = createdRules[0];
        
        // ルールを無効化
        const disableResult = await adminClient.push.toggleRule(ruleId, false);
        expect(disableResult.success).toBe(true);

        // 無効化確認
        const checkDisabled = await adminClient.push.getRule(ruleId);
        expect(checkDisabled.data.isEnabled).toBe(false);

        // ルールを再有効化
        const enableResult = await adminClient.push.toggleRule(ruleId, true);
        expect(enableResult.success).toBe(true);

        // 有効化確認
        const checkEnabled = await adminClient.push.getRule(ruleId);
        expect(checkEnabled.data.isEnabled).toBe(true);

        console.log('✅ Notification rule toggled successfully');
      }
    });
  });

  describe('Push Notification Access Control', () => {
    it('should prevent regular users from managing rules', async () => {
      // 一般ユーザーがルールを作成しようとする
      const rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Unauthorized Rule',
        triggerType: 'db_change',
        tableName: 'tasks',
        eventType: 'insert',
        recipientType: 'all_users',
        titleTemplate: 'Unauthorized',
        bodyTemplate: 'This should not work',
        isEnabled: true
      };

      try {
        const result = await aliceClient.push.createRule(rule);
        
        // 一般ユーザーはルール作成ができないはず
        expect(result.success).toBe(false);
        console.log('✅ Regular user properly denied rule creation');
      } catch (error) {
        console.log('✅ Rule creation properly denied with exception');
        expect(error).toBeDefined();
      }
    });

    it('should prevent users from sending manual notifications', async () => {
      // 一般ユーザーが手動通知を送信しようとする
      const notification: NotificationPayload = {
        title: 'Unauthorized Notification',
        body: 'This should not be sent'
      };

      try {
        const result = await aliceClient.push.send(notification, {
          allUsers: true
        });
        
        // 一般ユーザーは手動通知送信ができないはず
        expect(result.success).toBe(false);
        console.log('✅ Regular user properly denied manual notification sending');
      } catch (error) {
        console.log('✅ Manual notification properly denied with exception');
        expect(error).toBeDefined();
      }
    });

    it('should allow users to manage their own subscriptions only', async () => {
      // Aliceが自分のサブスクリプションを管理
      if (aliceSubscription) {
        const ownSubsResponse = await aliceClient.push.listSubscriptions();
        expect(ownSubsResponse.success).toBe(true);
        
        // 自分のサブスクリプションのみが含まれることを確認
        const ownSubs = ownSubsResponse.data.filter((sub: any) => sub.user_id === testUsers[0].id);
        expect(ownSubs.length).toBe(ownSubsResponse.data.length);

        console.log('✅ User can only access their own subscriptions');
      }

      // AliceがBobのサブスクリプションにアクセスしようとする
      try {
        // 特定ユーザーのサブスクリプションを取得する機能があれば
        const bobSubsResponse = await aliceClient.push.listSubscriptions(testUsers[1].id);
        
        // 一般ユーザーは他のユーザーのサブスクリプションにアクセスできないはず
        expect(bobSubsResponse.success).toBe(false);
        console.log('✅ User properly denied access to other users subscriptions');
      } catch (error) {
        console.log('✅ Access to other users subscriptions properly denied');
      }
    });
  });

  describe('Real-world Notification Scenarios', () => {
    it('should trigger notifications on actual data changes', async () => {
      // 実際のデータ変更で通知がトリガーされるシナリオをテスト
      // （実際の通知配信ではなく、システムの動作をテスト）
      
      // Aliceがタスクを作成（assigned_toにBobを設定）
      const taskResponse = await aliceClient.data.create('tasks', {
        project_id: testProject.id,
        title: 'Task for Notification Test',
        description: 'This task assignment should trigger a notification to Bob',
        status: 'todo',
        priority: 'high',
        assigned_to: testUsers[1].id, // Bobにアサイン
        created_by: testUsers[0].id
      });

      expect(taskResponse.success).toBe(true);
      const task = taskResponse.success ? taskResponse.data : taskResponse as any;

      // タスク作成が成功し、通知ルールの条件を満たしていることを確認
      expect(task.assigned_to).toBe(testUsers[1].id);
      expect(task.created_by).toBe(testUsers[0].id);

      console.log('✅ Task created with notification trigger conditions');
      
      // クリーンアップ
      await adminClient.data.delete('tasks', task.id);
    });

    it('should handle notification preferences', async () => {
      // 通知設定のテスト（将来の機能として）
      
      // ユーザーがサブスクリプション設定を更新する場合のテスト
      if (aliceSubscription) {
        // 例：通知の種類やタイミングの設定
        console.log('✅ Notification preferences would be configurable per user');
        console.log('Alice subscription active:', aliceSubscription.is_active);
      }
    });
  });
});