# Cloudflare Access セットアップガイド

このガイドでは、VibebaseでCloudflare Accessを使用してGitHub認証を設定する方法を説明します。

## 前提条件

- Cloudflareアカウント
- GitHubアカウント
- VibebaseがCloudflareにデプロイ済み

## 1. Cloudflare Zero Trustの有効化

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)にログイン
2. 左メニューから「Zero Trust」を選択
3. 初回の場合、Zero Trustのセットアップを完了

## 2. GitHub Identity Providerの設定

### GitHubでOAuth Appを作成

1. GitHubの[Developer settings](https://github.com/settings/developers)にアクセス
2. 「OAuth Apps」→「New OAuth App」
3. 以下の設定で作成：
   ```
   Application name: Vibebase (任意)
   Homepage URL: https://your-vibebase-domain.com
   Authorization callback URL: https://your-team-name.cloudflareaccess.com/cdn-cgi/access/callback
   ```
4. `Client ID`と`Client Secret`をコピー

### CloudflareでGitHub IdPを設定

1. Zero Trust → Settings → Authentication → Login methods
2. 「Add new」→「GitHub」
3. 設定項目：
   ```
   App ID: <GitHubのClient ID>
   Client secret: <GitHubのClient Secret>
   ```
4. 「Save」をクリック

## 3. Vibebaseアプリケーションの保護

### アプリケーションの追加

1. Zero Trust → Access → Applications
2. 「Add an application」→「Self-hosted」
3. 設定：
   ```
   Application name: Vibebase Dashboard
   Session Duration: 24 hours (推奨)
   
   Application domain:
   - Subdomain: your-vibebase-subdomain
   - Domain: your-domain.com
   ```

### アクセスポリシーの設定

1. 「Next」をクリック後、ポリシーを設定
2. 以下のポリシーを追加：

**ポリシー名**: Allow All GitHub Users
```
Action: Allow
Rules:
- Include: Everyone
```

> **注意**: これは全てのGitHubユーザーにCloudflare Access通過を許可しますが、
> Vibebase側で実際のアクセス制御を行います。

3. 「Next」→「Add application」

## 4. 環境変数の設定

wrangler.tomlに以下を追加（オプション）：

```toml
[vars]
CLOUDFLARE_TEAM_DOMAIN = "your-team-name"  # your-team-name.cloudflareaccess.com
```

## 5. セットアップの確認

### 初回アクセス

1. `https://your-vibebase-domain.com`にアクセス
2. Cloudflare Accessのログイン画面が表示される
3. 「Login with GitHub」をクリック
4. GitHubで認証
5. Vibebaseダッシュボードにアクセス
6. 初回アクセスの場合、自動的に管理者として登録される

### 管理者の追加

1. ダッシュボードの設定画面にアクセス
2. 「管理者」セクションで新しいGitHubユーザーネームを入力
3. 「追加」をクリック

## 6. トラブルシューティング

### よくある問題

**Q: Cloudflare Access画面が表示されない**
- ドメインの設定を確認
- アプリケーションのパスが正しいか確認

**Q: GitHub認証後にアクセス拒否される**
- GitHubユーザーネームが正しく抽出されているか確認
- データベースの管理者テーブルを確認

**Q: 「Invalid GitHub authentication」エラー**
- JWT内のGitHubユーザー情報の形式を確認
- Cloudflare AccessのGitHub連携設定を確認

### デバッグ情報の確認

Worker のログでJWTペイロードを確認：

```javascript
// 一時的なデバッグコード（本番では削除）
console.log('JWT Payload:', accessPayload);
console.log('Extracted GitHub Username:', githubUsername);
```

## セキュリティ考慮事項

1. **Session Duration**: 適切なセッション期間を設定
2. **定期的な管理者見直し**: 不要な管理者は削除
3. **アクセスログの監視**: Zero Trustのログを定期確認

## API認証（Service Token）

### Service Tokenの作成

1. Zero Trust → Access → Service Tokens
2. 「Create Service Token」
3. 用途に応じて設定
4. 生成されたトークンをAPI呼び出し時に使用

### 使用方法

```bash
curl -H "CF-Access-Client-Id: <client-id>" \
     -H "CF-Access-Client-Secret: <client-secret>" \
     https://your-vibebase-domain.com/api/tables
```

## まとめ

この設定により：
- ✅ GitHubアカウントでのシングルサインオン
- ✅ 初回アクセス時の自動管理者登録
- ✅ 管理者による追加ユーザー管理
- ✅ 企業グレードのセキュリティ

個人開発者には無料で使える強力な認証システムが完成します。