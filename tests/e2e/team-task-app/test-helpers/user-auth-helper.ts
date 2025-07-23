// Test Helper: User Authentication with JWT
// テスト用ユーザー認証ヘルパー（JWT使用）

import { createClient, type VibebaseClient } from '@vibebase/sdk';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
   * .dev.varsファイルと同じ値を使用
   */
  private async getJWTSecret(): Promise<string> {
    // 開発環境の.dev.varsファイルと同じ固定シークレットを使用
    return "k7x9w2m5n8q3r6v1z4p7s0t3u6y9b2e5h8j1l4o7r0u3x6a9d2g5k8n1q4t7w0z3";
  }

  /**
   * テスト用ユーザーセッションを作成（setupで作成済みのセッションを使用）
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

    // 2. setupで作成された固定セッションIDとトークンを使用
    let sessionId: string;
    let userToken: string;
    
    // setup-info.jsonからトークンを読み取り
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // e2eディレクトリの.setup-info.jsonへのパス
    const setupInfoPath = resolve(__dirname, '../../.setup-info.json');
    const setupInfo = JSON.parse(readFileSync(setupInfoPath, 'utf-8'));
    
    if (email === 'alice@example.com') {
      sessionId = 'test-session-alice';
      userToken = setupInfo.testTokens.alice;
    } else if (email === 'bob@example.com') {
      sessionId = 'test-session-bob';
      userToken = setupInfo.testTokens.bob;
    } else if (email === 'charlie@example.com') {
      sessionId = 'test-session-charlie';
      userToken = setupInfo.testTokens.charlie;
    } else {
      throw new Error(`No test session configured for user ${email}`);
    }

    // セッションIDを記録（クリーンアップ用）
    this.createdSessions.push(sessionId);

    // デバッグ用ログ
    console.log(`Using setup token for ${email}:`);
    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);
    console.log('JWT token:', userToken.substring(0, 50) + '...');

    // 3. ユーザークライアントを作成
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
   * （setupで作成されたセッションなので、実際には削除しない）
   */
  async cleanup(): Promise<void> {
    // setupで作成されたセッションは永続的なので、クリーンアップ不要
    // テスト間で再利用される
    this.createdSessions = [];
  }
}