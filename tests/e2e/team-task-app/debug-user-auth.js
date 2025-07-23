import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// セットアップ情報を読み込み
const setupInfo = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../.setup-info.json'), 'utf-8')
);

const aliceToken = setupInfo.testTokens.alice;
console.log('Alice token:', aliceToken.substring(0, 50) + '...');

// 直接HTTPリクエストでテスト
async function testUserAuth() {
  try {
    const response = await fetch('http://localhost:8787/api/data/users', {
      headers: {
        'Authorization': `Bearer ${aliceToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testUserAuth();