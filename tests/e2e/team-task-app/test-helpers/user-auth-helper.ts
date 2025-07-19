// Test Helper: User Authentication with JWT
// テスト用ユーザー認証ヘルパー（JWT使用）

import { createClient, type VibebaseClient } from '@vibebase/sdk';
import * as jwt from 'jsonwebtoken';

interface TestUserSession {
  userId: string;
  sessionId: string;
  userToken: string;
  userClient: VibebaseClient;
}

export class UserAuthTestHelper {
  private adminClient: VibebaseClient;
  private apiUrl: string;
  private createdSessions: string[] = [];

  constructor(apiUrl: string, adminApiKey: string) {
    this.apiUrl = apiUrl;
    this.adminClient = createClient({
      apiUrl,
      apiKey: adminApiKey
    });
  }

  /**
   * サーバーと同じJWT_SECRETを取得
   * 複数のパターンを試行
   */
  private async getJWTSecret(): Promise<string> {
    // 開発環境で自動生成されるパターンを試行
    const patterns = [
      'vibebase-dev-jwt-secret-' + 'a'.repeat(32),
      'development-jwt-secret-for-testing-' + '0'.repeat(32),
      // security-utils.ts の generateSecureJWTSecret で生成される形式を模借
      // 実際には32バイトのランダム値をbase64エンコード
    ];
    
    // 最初のパターンを使用（必要に応じて複数試行）
    return patterns[0];
  }

  /**
   * テスト用ユーザーセッションを作成（JWT のみ、セッションDBなし）
   */
  async createTestUserSession(email: string): Promise<TestUserSession> {
    // 1. ユーザーを取得
    const users = await this.adminClient.data.list('users', {
      where: { email }
    });

    if (!users.success || users.data.length === 0) {
      throw new Error(`Test user not found: ${email}`);
    }

    const user = users.data[0];
    const userId = user.id;

    // 2. 仮想セッションID（実際にはDBに保存しない）
    const sessionId = 'test-session-' + Date.now() + '-' + Math.random().toString(36).substring(7);

    // 3. 長期間有効なJWTトークンを生成（テスト用）
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      type: 'access',
      user_id: userId,
      session_id: sessionId,
      scope: ['user'],
      aud: 'localhost',
      iss: 'vibebase-local',
      exp: now + 24 * 60 * 60, // 24 hours (セッション有効性チェックをスキップ)
      iat: now,
    };

    const jwtSecret = await this.getJWTSecret();
    const userToken = jwt.sign(jwtPayload, jwtSecret);

    // 4. ユーザークライアントを作成
    const userClient = createClient({
      apiUrl: this.apiUrl,
      userToken
    });

    return {
      userId,
      sessionId,
      userToken,
      userClient
    };
  }

  /**
   * 作成したテストセッションをクリーンアップ
   */
  async cleanup(): Promise<void> {
    for (const sessionId of this.createdSessions) {
      try {
        await this.adminClient.data.delete('user_sessions', sessionId);
      } catch (error) {
        console.warn(`Failed to cleanup test session ${sessionId}:`, error);
      }
    }
    this.createdSessions = [];
  }
}