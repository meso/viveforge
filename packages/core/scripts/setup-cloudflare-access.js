#!/usr/bin/env node

/**
 * Cloudflare Access 自動設定スクリプト
 * 
 * このスクリプトは以下を自動化します：
 * 1. Zero Trust アカウントの確認/初期化
 * 2. GitHub Identity Provider の設定
 * 3. Vibebase Application の作成
 * 4. Access Policy の設定
 */

import { execSync } from 'child_process'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

class CloudflareAccessSetup {
  constructor() {
    this.accountId = 'c84ee758532a3352dc13df8b565ebb68'
    this.domain = 'vibebase.mesongo.workers.dev'
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN
  }

  async run() {
    console.log('🚀 Cloudflare Access 自動設定を開始します...\n')

    try {
      // 1. API Token の確認
      await this.checkApiToken()
      
      // 2. GitHub OAuth 情報の取得
      const githubConfig = await this.getGitHubConfig()
      
      // 3. Zero Trust の初期化確認
      await this.checkZeroTrust()
      
      // 4. GitHub Identity Provider の設定
      await this.setupGitHubIdentityProvider(githubConfig)
      
      // 5. Application の作成
      await this.createApplication()
      
      // 6. Access Policy の設定
      await this.createAccessPolicy()
      
      console.log('\n✅ Cloudflare Access の設定が完了しました!')
      console.log(`🌐 https://${this.domain} にアクセスしてGitHub認証をテストしてください`)
      
    } catch (error) {
      console.error('❌ エラーが発生しました:', error.message)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async checkApiToken() {
    if (!this.apiToken) {
      console.log('⚠️ CLOUDFLARE_API_TOKEN 環境変数が設定されていません')
      console.log('以下の手順で API Token を作成してください:')
      console.log('1. https://dash.cloudflare.com/profile/api-tokens')
      console.log('2. "Custom token" で以下の権限を設定:')
      console.log('   - Zone:Zone Settings:Edit')
      console.log('   - Zone:Zone:Read')
      console.log('   - Account:Cloudflare Tunnel:Edit')
      console.log('   - Account:Access: Apps and Policies:Edit')
      
      this.apiToken = await question('API Token を入力してください: ')
    }
    
    console.log('✅ API Token が設定されました')
  }

  async getGitHubConfig() {
    console.log('\n📋 GitHub OAuth App の設定が必要です')
    console.log('https://github.com/settings/developers で OAuth App を作成してください')
    console.log('設定項目:')
    console.log(`- Homepage URL: https://${this.domain}`)
    console.log('- Authorization callback URL: https://[team-name].cloudflareaccess.com/cdn-cgi/access/callback')
    console.log('  (team-nameは次のステップで取得します)\n')
    
    const clientId = await question('GitHub Client ID: ')
    const clientSecret = await question('GitHub Client Secret: ')
    
    return { clientId, clientSecret }
  }

  async checkZeroTrust() {
    console.log('\n🔍 Zero Trust の状況を確認中...')
    
    try {
      const response = await this.apiCall('GET', `/accounts/${this.accountId}/access/organizations`)
      
      if (response.length === 0) {
        console.log('⚠️ Zero Trust が初期化されていません')
        console.log('https://one.dash.cloudflare.com/ にアクセスして初期設定を完了してください')
        
        const proceed = await question('初期設定完了後、Enterを押してください: ')
      }
      
      console.log('✅ Zero Trust が利用可能です')
    } catch (error) {
      throw new Error(`Zero Trust の確認に失敗: ${error.message}`)
    }
  }

  async setupGitHubIdentityProvider(githubConfig) {
    console.log('\n🔧 GitHub Identity Provider を設定中...')
    
    try {
      const response = await this.apiCall('POST', `/accounts/${this.accountId}/access/identity_providers`, {
        name: 'GitHub',
        type: 'github',
        config: {
          client_id: githubConfig.clientId,
          client_secret: githubConfig.clientSecret
        }
      })
      
      console.log('✅ GitHub Identity Provider が設定されました')
      return response.id
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ GitHub Identity Provider は既に設定済みです')
        return null
      }
      throw new Error(`GitHub IdP の設定に失敗: ${error.message}`)
    }
  }

  async createApplication() {
    console.log('\n🏗️ Access Application を作成中...')
    
    try {
      const response = await this.apiCall('POST', `/accounts/${this.accountId}/access/apps`, {
        name: 'Vibebase Dashboard',
        domain: this.domain,
        type: 'self_hosted',
        session_duration: '24h',
        auto_redirect_to_identity: true,
        allowed_idps: ['github']
      })
      
      console.log('✅ Access Application が作成されました')
      return response.id
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Application は既に作成済みです')
        return null
      }
      throw new Error(`Application の作成に失敗: ${error.message}`)
    }
  }

  async createAccessPolicy() {
    console.log('\n📋 Access Policy を設定中...')
    
    try {
      const response = await this.apiCall('POST', `/accounts/${this.accountId}/access/policies`, {
        name: 'Allow GitHub Users',
        decision: 'allow',
        include: [
          {
            github: {}
          }
        ]
      })
      
      console.log('✅ Access Policy が設定されました')
      return response.id
    } catch (error) {
      throw new Error(`Access Policy の設定に失敗: ${error.message}`)
    }
  }

  async apiCall(method, endpoint, data = null) {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    }
    
    if (data) {
      options.body = JSON.stringify(data)
    }
    
    try {
      const response = await fetch(url, options)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || 'API call failed')
      }
      
      return result.result
    } catch (error) {
      throw new Error(`API call failed: ${error.message}`)
    }
  }
}

// スクリプト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new CloudflareAccessSetup()
  setup.run()
}

export default CloudflareAccessSetup