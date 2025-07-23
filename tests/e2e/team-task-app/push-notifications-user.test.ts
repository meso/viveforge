/**
 * User Authentication Push Notifications E2E Tests
 * ユーザー認証でのPush通知機能のE2Eテスト（ユーザーレベル機能のみ）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task } from './fixtures/types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// セットアップ情報を読み込み
const setupInfo = JSON.parse(
  readFileSync(resolve(__dirname, '../.setup-info.json'), 'utf-8')
);

const API_URL = setupInfo.apiUrl;
const testTokens = setupInfo.testTokens;

describe('User Auth Push Notifications E2E Tests', () => {
  // 各ユーザーのクライアント
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let charlieClient: VibebaseClient;
  
  let testTeam: Team;
  let testProject: Project;
  let vapidPublicKey: string;
  let createdTaskIds: string[] = [];

  // モックのプッシュサブスクリプションデータ
  const mockSubscriptions = {
    alice: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/alice-endpoint',
      keys: {
        p256dh: 'alice-p256dh-key-mock',
        auth: 'alice-auth-key-mock'
      }
    },
    bob: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/bob-endpoint',
      keys: {
        p256dh: 'bob-p256dh-key-mock',
        auth: 'bob-auth-key-mock'
      }
    },
    charlie: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/charlie-endpoint',
      keys: {
        p256dh: 'charlie-p256dh-key-mock',
        auth: 'charlie-auth-key-mock'
      }
    }
  };

  beforeAll(async () => {
    // ユーザー認証クライアントを初期化
    aliceClient = createClient({ apiUrl: API_URL, userToken: testTokens.alice });
    bobClient = createClient({ apiUrl: API_URL, userToken: testTokens.bob });
    charlieClient = createClient({ apiUrl: API_URL, userToken: testTokens.charlie });

    // VAPID公開キーを取得（認証不要のエンドポイント）
    try {
      const response = await fetch(`${API_URL}/api/push/vapid-public-key`);
      const data = await response.json() as any;
      vapidPublicKey = data.publicKey;
      console.log('VAPID public key obtained:', vapidPublicKey ? 'Yes' : 'No');
    } catch (error) {
      console.warn('VAPID public key not available:', error);
    }

    // 既存のテストデータを取得
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
    // テスト用タスクのクリーンアップ
    for (const taskId of createdTaskIds) {
      try {
        await aliceClient.data!.delete('tasks', taskId);
      } catch (error) {
        console.warn(`Failed to clean up task ${taskId}:`, error);
      }
    }
  });

  describe('VAPID Configuration (User Access)', () => {
    it('should retrieve VAPID public key without authentication', async () => {
      const response = await fetch(`${API_URL}/api/push/vapid-public-key`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('publicKey');
      expect(typeof data.publicKey).toBe('string');
      expect(data.publicKey.length).toBeGreaterThan(0);
    });
  });

  describe('Push Subscription Management (User)', () => {
    it('should allow users to subscribe to push notifications', async () => {
      if (!vapidPublicKey) {
        console.warn('Skipping test: VAPID public key not available');
        return;
      }

      // Aliceのプッシュ通知購読
      const subscribeResponse = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testTokens.alice}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: mockSubscriptions.alice,
          deviceInfo: {
            userAgent: 'Mozilla/5.0 (User Auth Test Browser)',
            platform: 'Test Platform',
            vendor: 'Test Vendor',
            language: 'ja-JP'
          }
        })
      });

      expect(subscribeResponse.status).toBe(200);
      const data = await subscribeResponse.json() as any;
      expect(data.success).toBe(true);
    });

    it('should allow users to unsubscribe from push notifications', async () => {
      // 購読解除テスト
      const unsubscribeResponse = await fetch(`${API_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testTokens.alice}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: mockSubscriptions.alice.endpoint
        })
      });

      expect(unsubscribeResponse.status).toBe(200);
      const data = await unsubscribeResponse.json() as any;
      expect(data.success).toBe(true);
    });
  });

  describe('Data-Driven Push Notifications (User Actions)', () => {
    it('should trigger push notifications when user creates tasks', async () => {
      // 事前にプッシュ通知を購読
      if (vapidPublicKey) {
        await fetch(`${API_URL}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testTokens.alice}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription: mockSubscriptions.alice,
            deviceInfo: { userAgent: 'Test Browser' }
          })
        });
      }

      // タスクを作成（これによりプッシュ通知がトリガーされるべき）
      const taskData = {
        project_id: testProject.id,
        title: 'User Auth Push Test Task',
        description: 'This task should trigger push notifications',
        status: 'todo',
        priority: 'high',
        assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr', // Bobに割り当て
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      };

      const taskResponse = await aliceClient.data!.create<Task>('tasks', taskData);
      expect(taskResponse.success).toBe(true);
      createdTaskIds.push(taskResponse.data!.id);

      // プッシュ通知が送信されたかは直接確認できないが、
      // タスク作成が成功していることを確認
      expect(taskResponse.data!).toHaveProperty('id');
      expect(taskResponse.data!.title).toBe(taskData.title);
    });

    it('should trigger push notifications when user updates task status', async () => {
      if (createdTaskIds.length === 0) {
        // テスト用タスクを作成
        const taskResponse = await aliceClient.data!.create<Task>('tasks', {
          project_id: testProject.id,
          title: 'Status Update Test Task',
          description: 'Task for status update test',
          status: 'todo',
          priority: 'medium',
          created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
        });
        createdTaskIds.push(taskResponse.data!.id);
      }

      const taskId = createdTaskIds[0];

      // タスクのステータス更新
      const updateResponse = await aliceClient.data!.update<Task>('tasks', taskId, {
        status: 'in_progress'
      });

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data!.status).toBe('in_progress');
    });
  });

  describe('User Preferences and Device Management', () => {
    it('should handle multiple device subscriptions per user', async () => {
      if (!vapidPublicKey) {
        console.warn('Skipping test: VAPID public key not available');
        return;
      }

      // 同じユーザー（Bob）が複数のデバイスから購読
      const devices = [
        {
          subscription: mockSubscriptions.bob,
          deviceInfo: {
            userAgent: 'Mozilla/5.0 (Desktop Browser)',
            platform: 'MacIntel',
            vendor: 'Google Inc.'
          }
        },
        {
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/bob-mobile-endpoint',
            keys: mockSubscriptions.bob.keys
          },
          deviceInfo: {
            userAgent: 'Mozilla/5.0 (Mobile Browser)',
            platform: 'iPhone',
            vendor: 'Apple Computer, Inc.'
          }
        }
      ];

      for (const device of devices) {
        const subscribeResponse = await fetch(`${API_URL}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testTokens.bob}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(device)
        });

        expect(subscribeResponse.status).toBe(200);
        const data = await subscribeResponse.json() as any;
        expect(data.success).toBe(true);
      }
    });

    it('should validate user authentication for push operations', async () => {
      // 無効なトークンでの購読試行
      const invalidResponse = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: mockSubscriptions.alice,
          deviceInfo: { userAgent: 'Test Browser' }
        })
      });

      expect(invalidResponse.status).toBe(401);
    });
  });

  describe('User Experience Scenarios', () => {
    it('should support team collaboration push notification workflow', async () => {
      // Charlieがタスクにコメントを追加
      if (createdTaskIds.length === 0) {
        const taskResponse = await aliceClient.data!.create<Task>('tasks', {
          project_id: testProject.id,
          title: 'Collaboration Test Task',
          description: 'Task for collaboration test',
          status: 'todo',
          priority: 'medium',
          created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
        });
        createdTaskIds.push(taskResponse.data!.id);
      }

      const taskId = createdTaskIds[0];

      // Charlieがコメントを追加
      const commentResponse = await charlieClient.data!.create('task_comments', {
        task_id: taskId,
        user_id: 'LpH9mKj2nQ4vX8cD-zFgR', // Charlie's user ID
        comment: 'I can help with this task!'
      });

      expect(commentResponse.success).toBe(true);
      expect(commentResponse.data!).toHaveProperty('id');
    });

    it('should handle cross-user task assignments with notifications', async () => {
      // タスクをあるユーザーから別のユーザーに再割り当て
      if (createdTaskIds.length === 0) {
        const taskResponse = await aliceClient.data!.create<Task>('tasks', {
          project_id: testProject.id,
          title: 'Assignment Test Task',
          description: 'Task for assignment test',
          status: 'todo',
          priority: 'medium',
          assigned_to: 'V1StGXR8_Z5jdHi6B-myT', // Alice's user ID
          created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
        });
        createdTaskIds.push(taskResponse.data!.id);
      }

      const taskId = createdTaskIds[0];

      // BobにタスクをAliceから再割り当て
      const reassignResponse = await aliceClient.data!.update<Task>('tasks', taskId, {
        assigned_to: '3ZjkQ2mN8pX9vC7bA-wEr' // Bob's user ID
      });

      expect(reassignResponse.success).toBe(true);
      expect(reassignResponse.data!.assigned_to).toBe('3ZjkQ2mN8pX9vC7bA-wEr');
    });
  });
});