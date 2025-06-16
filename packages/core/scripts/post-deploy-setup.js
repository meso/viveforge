#!/usr/bin/env node

/**
 * Post-Deploy Setup for Vibebase
 * 
 * このスクリプトは Deploy to Cloudflare ボタンでのデプロイ後に
 * 認証設定を自動化します。
 * 
 * 実行タイミング: 
 * - Cloudflare Workers のデプロイ後
 * - 初回アクセス時（Worker内から呼び出し）
 */

import { execSync } from 'child_process'

class PostDeploySetup {
  constructor() {
    this.workerDomain = process.env.WORKER_DOMAIN || 'vibebase.mesongo.workers.dev'
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN
  }

  async run() {
    console.log('🚀 Vibebase Post-Deploy Setup')
    console.log(`Domain: ${this.workerDomain}`)

    try {
      // 1. GitHub OAuth App の自動作成（GitHub API使用）
      const githubApp = await this.createGitHubOAuthApp()
      
      // 2. Cloudflare Access の設定
      await this.setupCloudflareAccess(githubApp)
      
      // 3. 環境変数の更新
      await this.updateWorkerSecrets(githubApp)
      
      console.log('\n✅ セットアップ完了!')
      console.log(`🌐 https://${this.workerDomain} にアクセスして認証をテストしてください`)
      
    } catch (error) {
      console.error('❌ セットアップエラー:', error.message)
      
      // フォールバック: 手動設定ガイドを表示
      this.showManualSetupGuide()
    }
  }

  async createGitHubOAuthApp() {
    console.log('\n📋 GitHub OAuth App を自動作成中...')
    
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN が設定されていません')
    }

    const appData = {
      name: `Vibebase-${Date.now()}`,
      url: `https://${this.workerDomain}`,
      callback_url: `https://vibebase.cloudflareaccess.com/cdn-cgi/access/callback`
    }

    try {
      const response = await fetch('https://api.github.com/user/applications/oauth', {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appData)
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`)
      }

      const app = await response.json()
      console.log('✅ GitHub OAuth App を作成しました')
      
      return {
        client_id: app.client_id,
        client_secret: app.client_secret
      }
      
    } catch (error) {
      throw new Error(`GitHub OAuth App の作成に失敗: ${error.message}`)
    }
  }

  async setupCloudflareAccess(githubApp) {
    console.log('\n🔧 Cloudflare Access を設定中...')
    
    if (!this.apiToken || !this.accountId) {
      throw new Error('Cloudflare API Token または Account ID が設定されていません')
    }

    try {
      // 1. GitHub Identity Provider の作成
      await this.createIdentityProvider(githubApp)
      
      // 2. Access Application の作成
      await this.createAccessApplication()
      
      console.log('✅ Cloudflare Access を設定しました')
      
    } catch (error) {
      throw new Error(`Cloudflare Access の設定に失敗: ${error.message}`)
    }
  }

  async createIdentityProvider(githubApp) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/access/identity_providers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'GitHub',
        type: 'github',
        config: {
          client_id: githubApp.client_id,
          client_secret: githubApp.client_secret
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      if (error.errors?.[0]?.message?.includes('already exists')) {
        console.log('ℹ️ GitHub Identity Provider は既に存在します')
        return
      }
      throw new Error(`Identity Provider 作成エラー: ${error.errors?.[0]?.message || response.statusText}`)
    }
  }

  async createAccessApplication() {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/access/apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Vibebase Dashboard',
        domain: this.workerDomain,
        type: 'self_hosted',
        session_duration: '24h',
        auto_redirect_to_identity: true,
        policies: [{
          name: 'Allow GitHub Users',
          decision: 'allow',
          include: [{
            github: {}
          }]
        }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      if (error.errors?.[0]?.message?.includes('already exists')) {
        console.log('ℹ️ Access Application は既に存在します')
        return
      }
      throw new Error(`Access Application 作成エラー: ${error.errors?.[0]?.message || response.statusText}`)
    }
  }

  async updateWorkerSecrets(githubApp) {
    console.log('\n🔐 Worker の環境変数を更新中...')
    
    try {
      // Wrangler secret コマンドで環境変数を設定
      execSync(`echo "${githubApp.client_id}" | wrangler secret put GITHUB_CLIENT_ID`, { stdio: 'pipe' })
      execSync(`echo "${githubApp.client_secret}" | wrangler secret put GITHUB_CLIENT_SECRET`, { stdio: 'pipe' })
      
      console.log('✅ 環境変数を更新しました')
      
    } catch (error) {
      console.warn('⚠️ 環境変数の更新に失敗（手動設定が必要）:', error.message)
    }
  }

  showManualSetupGuide() {
    console.log('\n📋 手動設定ガイド')
    console.log('================')
    console.log('')
    console.log('自動設定に失敗しました。以下の手順で手動設定してください:')
    console.log('')
    console.log('1. GitHub OAuth App を作成:')
    console.log('   https://github.com/settings/developers')
    console.log(`   - Homepage URL: https://${this.workerDomain}`)
    console.log('   - Callback URL: https://[team].cloudflareaccess.com/cdn-cgi/access/callback')
    console.log('')
    console.log('2. Cloudflare Zero Trust でIdentity Provider設定:')
    console.log('   https://one.dash.cloudflare.com/')
    console.log('')
    console.log('3. Access Application を作成してドメインを保護')
    console.log('')
    console.log('詳細な手順: https://github.com/meso/vibebase/blob/main/docs/cloudflare-access-setup.md')
  }
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new PostDeploySetup()
  setup.run()
}

export default PostDeploySetup