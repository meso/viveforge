import type { D1Database } from '../types/cloudflare'

export interface SetupStatus {
  id: number
  github_oauth_configured: boolean
  cloudflare_access_configured: boolean
  first_admin_registered: boolean
  setup_completed_at: string | null
  deploy_method: string
}

export class SetupWizard {
  constructor(private db: D1Database) {}

  async getSetupStatus(): Promise<SetupStatus | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM setup_status WHERE id = 1')
        .first() as SetupStatus | null

      return result
    } catch (error) {
      console.error('Failed to get setup status:', error)
      return null
    }
  }

  async updateSetupStatus(updates: Partial<SetupStatus>): Promise<void> {
    try {
      const setClause = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(', ')
      
      const values = Object.values(updates)
      values.push(new Date().toISOString()) // updated_at
      
      await this.db
        .prepare(`UPDATE setup_status SET ${setClause}, updated_at = ? WHERE id = 1`)
        .bind(...values)
        .run()
    } catch (error) {
      console.error('Failed to update setup status:', error)
      throw error
    }
  }

  async markSetupCompleted(): Promise<void> {
    await this.updateSetupStatus({
      setup_completed_at: new Date().toISOString()
    })
  }

  async isSetupCompleted(): Promise<boolean> {
    const status = await this.getSetupStatus()
    return status?.setup_completed_at !== null
  }

  async isAuthConfigured(): Promise<boolean> {
    const status = await this.getSetupStatus()
    return status?.github_oauth_configured === true && 
           status?.cloudflare_access_configured === true
  }

  generateSetupWizardHTML(domain: string): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibebase セットアップ</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">🎉 Vibebase デプロイ完了！</h1>
            <p class="text-gray-600">あと少しでBaaSが使えるようになります</p>
        </div>

        <div class="space-y-6">
            <!-- Step 1: GitHub認証設定 -->
            <div class="border rounded-lg p-6">
                <div class="flex items-center mb-4">
                    <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold mr-3">1</div>
                    <h2 class="text-xl font-semibold">GitHub認証の設定</h2>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                    <p class="text-sm text-blue-800 mb-2"><strong>所要時間:</strong> 約2分</p>
                    <p class="text-sm text-blue-700">
                        GitHub OAuth Appを作成して、Vibebaseにログインできるようにします。
                    </p>
                </div>

                <div class="space-y-3">
                    <div>
                        <h3 class="font-medium mb-2">📋 設定手順:</h3>
                        <ol class="text-sm text-gray-600 space-y-1 ml-4">
                            <li>1. <a href="https://github.com/settings/developers" target="_blank" class="text-blue-600 hover:underline">GitHub Developer Settings</a> にアクセス</li>
                            <li>2. "OAuth Apps" → "New OAuth App" をクリック</li>
                            <li>3. 以下の情報を入力:</li>
                        </ol>
                    </div>
                    
                    <div class="bg-gray-100 p-3 rounded text-sm font-mono">
                        <div><strong>Application name:</strong> Vibebase</div>
                        <div><strong>Homepage URL:</strong> https://${domain}</div>
                        <div><strong>Callback URL:</strong> https://[team-name].cloudflareaccess.com/cdn-cgi/access/callback</div>
                    </div>
                    
                    <div class="flex space-x-3">
                        <a href="https://github.com/settings/applications/new" target="_blank" 
                           class="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 text-sm">
                            GitHub OAuth App作成
                        </a>
                        <button onclick="showStep2()" 
                                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
                            作成完了 →
                        </button>
                    </div>
                </div>
            </div>

            <!-- Step 2: Cloudflare Access設定 -->
            <div id="step2" class="border rounded-lg p-6" style="display: none;">
                <div class="flex items-center mb-4">
                    <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold mr-3">2</div>
                    <h2 class="text-xl font-semibold">Cloudflare Access設定</h2>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                    <p class="text-sm text-blue-800 mb-2"><strong>所要時間:</strong> 約3分</p>
                    <p class="text-sm text-blue-700">
                        Cloudflare Zero TrustでGitHub認証を有効にします。
                    </p>
                </div>

                <div class="space-y-3">
                    <div>
                        <h3 class="font-medium mb-2">🔧 設定手順:</h3>
                        <ol class="text-sm text-gray-600 space-y-1 ml-4">
                            <li>1. <a href="https://one.dash.cloudflare.com/" target="_blank" class="text-blue-600 hover:underline">Cloudflare Zero Trust</a> にアクセス</li>
                            <li>2. Settings → Authentication → Login methods</li>
                            <li>3. "Add new" → "GitHub" を選択</li>
                            <li>4. GitHubのClient IDとSecretを入力</li>
                            <li>5. Access → Applications → "Add application"</li>
                            <li>6. ${domain} を保護するよう設定</li>
                        </ol>
                    </div>
                    
                    <div class="flex space-x-3">
                        <a href="https://one.dash.cloudflare.com/" target="_blank" 
                           class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 text-sm">
                            Cloudflare Zero Trust
                        </a>
                        <button onclick="completeSetup()" 
                                class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
                            設定完了！
                        </button>
                    </div>
                </div>
            </div>

            <!-- Skip Option -->
            <div class="text-center pt-4 border-t">
                <p class="text-sm text-gray-500 mb-3">認証なしでまず試してみる場合:</p>
                <a href="/dashboard" class="text-blue-600 hover:underline text-sm">
                    ⏭️ スキップしてダッシュボードへ（認証なしモード）
                </a>
            </div>
        </div>
    </div>

    <script>
        function showStep2() {
            document.getElementById('step2').style.display = 'block';
            document.querySelector('[onclick="showStep2()"]').style.display = 'none';
        }

        function completeSetup() {
            alert('設定完了！ページをリロードしてGitHub認証をテストしてください。');
            window.location.reload();
        }
    </script>
</body>
</html>`
  }
}