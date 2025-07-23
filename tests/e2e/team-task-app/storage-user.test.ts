/**
 * User Authentication Storage E2E Tests
 * ユーザー認証でのストレージ機能のE2Eテスト
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// セットアップ情報を読み込み
const setupInfo = JSON.parse(
  readFileSync(resolve(__dirname, '../.setup-info.json'), 'utf-8')
);

const API_URL = setupInfo.apiUrl;
const testTokens = setupInfo.testTokens;

describe('User Auth Storage E2E Tests', () => {
  // 各ユーザーのクライアント
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let charlieClient: VibebaseClient;
  
  let uploadedFiles: string[] = [];

  beforeAll(async () => {
    // ユーザー認証クライアントを初期化
    aliceClient = createClient({ apiUrl: API_URL, userToken: testTokens.alice });
    bobClient = createClient({ apiUrl: API_URL, userToken: testTokens.bob });
    charlieClient = createClient({ apiUrl: API_URL, userToken: testTokens.charlie });
  });

  afterAll(async () => {
    // アップロードしたファイルをクリーンアップ
    for (const filePath of uploadedFiles) {
      try {
        await aliceClient.storage.delete(filePath);
      } catch (error) {
        // エラーは無視（既に削除済みの可能性）
      }
    }
  });

  describe('File Upload with User Auth', () => {
    
    it('should upload a text file (Alice)', async () => {
      const content = 'This is a test file uploaded by Alice via user authentication';
      const filePath = 'user-tests/alice/test-file.txt';
      
      const result = await aliceClient.storage.upload(filePath, content, {
        contentType: 'text/plain'
      });
      
      expect(result.success).toBe(true);
      expect(result.data!.url).toBeDefined();
      
      uploadedFiles.push(filePath);
    });

    it('should upload a JSON file (Bob)', async () => {
      const jsonData = { 
        user: 'Bob', 
        message: 'Hello from Bob via user auth',
        timestamp: new Date().toISOString(),
        data: { numbers: [1, 2, 3], active: true }
      };
      const filePath = 'user-tests/bob/data.json';
      const content = JSON.stringify(jsonData, null, 2);
      
      const result = await bobClient.storage.upload(filePath, content, {
        contentType: 'application/json'
      });
      
      expect(result.success).toBe(true);
      expect(result.data!.url).toBeDefined();
      
      uploadedFiles.push(filePath);
    });

    it('should upload files to user-specific directories', async () => {
      // 各ユーザーが自分専用のディレクトリにアップロード
      const aliceContent = '# Alice\'s Project Notes\n\nThese are my personal project notes.';
      const aliceResult = await aliceClient.storage.upload(
        'user-docs/alice/project-notes.md',
        aliceContent,
        { contentType: 'text/markdown' }
      );
      
      const bobContent = '# Bob\'s API Design\n\nAPI specifications and designs.';
      const bobResult = await bobClient.storage.upload(
        'user-docs/bob/api-designs.md', 
        bobContent,
        { contentType: 'text/markdown' }
      );
      
      const charlieContent = '# Charlie\'s UI Mockups\n\nUser interface designs and mockups.';
      const charlieResult = await charlieClient.storage.upload(
        'user-docs/charlie/ui-mockups.md',
        charlieContent,
        { contentType: 'text/markdown' }
      );
      
      expect(aliceResult.success).toBe(true);
      expect(bobResult.success).toBe(true);
      expect(charlieResult.success).toBe(true);
      
      uploadedFiles.push('user-docs/alice/project-notes.md');
      uploadedFiles.push('user-docs/bob/api-designs.md');
      uploadedFiles.push('user-docs/charlie/ui-mockups.md');
    });
  });

  describe('File Download with User Auth', () => {
    
    it('should download own uploaded file (Alice)', async () => {
      const filePath = 'user-tests/alice/download-test.txt';
      const originalContent = 'Alice\'s downloadable content';
      
      // アップロード
      const uploadResult = await aliceClient.storage.upload(filePath, originalContent, {
        contentType: 'text/plain'
      });
      expect(uploadResult.success).toBe(true);
      uploadedFiles.push(filePath);
      
      // ダウンロード
      const downloadResult = await aliceClient.storage.download(filePath);
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data!).toBe(originalContent);
    });

    it('should download files uploaded by other users (public access)', async () => {
      // Bob のファイルを Alice がダウンロード（public access）
      const bobFilePath = 'user-tests/bob/public-doc.txt';
      const content = 'This is Bob\'s public document';
      
      const uploadResult = await bobClient.storage.upload(bobFilePath, content, {
        contentType: 'text/plain'
      });
      expect(uploadResult.success).toBe(true);
      uploadedFiles.push(bobFilePath);
      
      // Alice がダウンロード
      const downloadResult = await aliceClient.storage.download(bobFilePath);
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data!).toBe(content);
    });
  });

  describe('File Management with User Auth', () => {
    
    it('should list files in user directory', async () => {
      // Alice が複数ファイルをアップロード
      const files = [
        'user-files/alice/file1.txt',
        'user-files/alice/file2.txt', 
        'user-files/alice/file3.txt'
      ];
      
      for (const filePath of files) {
        const content = `Content of ${filePath}`;
        const result = await aliceClient.storage.upload(filePath, content, {
          contentType: 'text/plain'
        });
        expect(result.success).toBe(true);
        uploadedFiles.push(filePath);
      }
      
      // ファイルリストを取得
      const listResult = await aliceClient.storage.list('user-files/alice/');
      expect(listResult.success).toBe(true);
      expect(listResult.data!.files.length).toBeGreaterThanOrEqual(3);
      
      // アップロードしたファイルが含まれることを確認
      const fileNames = listResult.data!.files.map(f => f.name);
      files.forEach(file => {
        expect(fileNames).toContain(file);
      });
    });

    it('should get file info for user files', async () => {
      const filePath = 'user-info/alice/info-test.txt';
      const content = 'File info test content';
      
      const uploadResult = await aliceClient.storage.upload(filePath, content, {
        contentType: 'text/plain'
      });
      expect(uploadResult.success).toBe(true);
      uploadedFiles.push(filePath);
      
      const infoResult = await aliceClient.storage.getInfo(filePath);
      expect(infoResult.success).toBe(true);
      expect(infoResult.data!.name).toBe(filePath);
      expect(infoResult.data!.size).toBe(content.length);
      expect(infoResult.data!.contentType).toBe('text/plain');
    });

    it('should delete own files', async () => {
      const filePath = 'user-delete/alice/delete-test.txt';
      const content = 'To be deleted';
      
      // ファイルアップロード
      const uploadResult = await aliceClient.storage.upload(filePath, content, {
        contentType: 'text/plain'
      });
      expect(uploadResult.success).toBe(true);
      
      // ファイル削除
      const deleteResult = await aliceClient.storage.delete(filePath);
      expect(deleteResult.success).toBe(true);
      
      // 削除確認
      const downloadResult = await aliceClient.storage.download(filePath);
      expect(downloadResult.success).toBe(false);
    });
  });

  describe('Collaborative File Scenarios', () => {
    
    it('should handle team file sharing workflow', async () => {
      // 1. Alice がチーム共有ファイルをアップロード
      const sharedFilePath = 'team-shared/project-specs.md';
      const originalSpecs = `# Project Specifications
      
## Overview
Initial project specifications created by Alice.

## Requirements
- User authentication
- File storage
- Team collaboration
`;
      
      const aliceUpload = await aliceClient.storage.upload(sharedFilePath, originalSpecs, {
        contentType: 'text/markdown'
      });
      expect(aliceUpload.success).toBe(true);
      uploadedFiles.push(sharedFilePath);
      
      // 2. Bob がファイルをダウンロードして確認
      const bobDownload = await bobClient.storage.download(sharedFilePath);
      expect(bobDownload.success).toBe(true);
      expect(bobDownload.data!).toBe(originalSpecs);
      
      // 3. Bob がファイルを更新（追記）
      const updatedSpecs = originalSpecs + `
      
## Technical Notes (Added by Bob)
- Using JWT for authentication  
- Cloudflare R2 for storage
- Real-time updates via SSE
`;
      
      const bobUpdate = await bobClient.storage.upload(sharedFilePath, updatedSpecs, {
        contentType: 'text/markdown'
      });
      expect(bobUpdate.success).toBe(true);
      
      // 4. Charlie が最新版をダウンロード
      const charlieDownload = await charlieClient.storage.download(sharedFilePath);
      expect(charlieDownload.success).toBe(true);
      expect(charlieDownload.data!).toBe(updatedSpecs);
      expect(charlieDownload.data!).toContain('Added by Bob');
      
      // 5. Charlie がさらに追記
      const finalSpecs = updatedSpecs + `
      
## Design Notes (Added by Charlie)
- Modern UI with Tailwind CSS
- Mobile-responsive design
- Accessibility compliance
`;
      
      const charlieUpdate = await charlieClient.storage.upload(sharedFilePath, finalSpecs, {
        contentType: 'text/markdown'
      });
      expect(charlieUpdate.success).toBe(true);
      
      // 6. 最終確認 - 全員が同じ最新版を取得
      const [finalAlice, finalBob, finalCharlie] = await Promise.all([
        aliceClient.storage.download(sharedFilePath),
        bobClient.storage.download(sharedFilePath), 
        charlieClient.storage.download(sharedFilePath)
      ]);
      
      expect(finalAlice.success).toBe(true);
      expect(finalBob.success).toBe(true);
      expect(finalCharlie.success).toBe(true);
      
      expect(finalAlice.data!).toBe(finalSpecs);
      expect(finalBob.data!).toBe(finalSpecs);
      expect(finalCharlie.data!).toBe(finalSpecs);
      
      // 全てのユーザーの変更が含まれることを確認
      expect(finalSpecs).toContain('created by Alice');
      expect(finalSpecs).toContain('Added by Bob');
      expect(finalSpecs).toContain('Added by Charlie');
    });

    it('should handle file versioning by different users', async () => {
      const basePath = 'versioning-test/document';
      
      // 各ユーザーがバージョン別ファイルを作成
      const aliceContent = '# Document v1.0\nCreated by Alice';
      const aliceVersion = await aliceClient.storage.upload(`${basePath}-v1-alice.md`, 
        aliceContent, 
        { contentType: 'text/markdown' }
      );
      
      const bobContent = '# Document v2.0\nUpdated by Bob\n\nAdded new sections';
      const bobVersion = await bobClient.storage.upload(`${basePath}-v2-bob.md`,
        bobContent,
        { contentType: 'text/markdown' }
      );
      
      const charlieContent = '# Document v3.0\nFinalized by Charlie\n\nReady for production';
      const charlieVersion = await charlieClient.storage.upload(`${basePath}-v3-charlie.md`,
        charlieContent,
        { contentType: 'text/markdown' }
      );
      
      expect(aliceVersion.success).toBe(true);
      expect(bobVersion.success).toBe(true);
      expect(charlieVersion.success).toBe(true);
      
      uploadedFiles.push(`${basePath}-v1-alice.md`);
      uploadedFiles.push(`${basePath}-v2-bob.md`);
      uploadedFiles.push(`${basePath}-v3-charlie.md`);
      
      // 全バージョンのファイルリストを確認
      const versionList = await aliceClient.storage.list('versioning-test/');
      expect(versionList.success).toBe(true);
      expect(versionList.data!.files.length).toBeGreaterThanOrEqual(3);
      
      const versionFiles = versionList.data!.files.filter(f => f.name.includes('document-v'));
      expect(versionFiles.length).toBe(3);
    });
  });

  describe('File Type and Size Handling', () => {
    
    it('should handle different file types', async () => {
      const files = [
        {
          path: 'user-types/alice/config.json',
          content: JSON.stringify({ theme: 'dark', notifications: true }),
          type: 'application/json'
        },
        {
          path: 'user-types/bob/styles.css', 
          content: 'body { font-family: Arial, sans-serif; }',
          type: 'text/css'
        },
        {
          path: 'user-types/charlie/script.js',
          content: 'console.log("Hello from Charlie");',
          type: 'application/javascript'
        }
      ];
      
      for (const fileData of files) {
        const result = await aliceClient.storage.upload(fileData.path, fileData.content, {
          contentType: fileData.type
        });
        expect(result.success).toBe(true);
        uploadedFiles.push(fileData.path);
      }
    });

    it('should handle large text content', async () => {
      // 大きなテキストファイルを生成
      const largeContent = 'Large file content generated by user auth test.\n'.repeat(1000);
      const filePath = 'user-large/alice/large-file.txt';
      
      const uploadResult = await aliceClient.storage.upload(filePath, largeContent, {
        contentType: 'text/plain'
      });
      
      expect(uploadResult.success).toBe(true);
      uploadedFiles.push(filePath);
      
      // ファイル情報確認
      const infoResult = await aliceClient.storage.getInfo(filePath);
      expect(infoResult.success).toBe(true);
      expect(infoResult.data!.size).toBeGreaterThan(40000); // 40KB以上
      
      // ダウンロード確認
      const downloadResult = await aliceClient.storage.download(filePath);
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data!).toBe(largeContent);
    });
  });

  describe('User-Specific Storage Patterns', () => {
    
    it('should organize files by user and purpose', async () => {
      const userFiles = [
        // Alice の個人ファイル
        { path: 'personal/alice/notes.md', content: 'Alice\'s personal notes' },
        { path: 'personal/alice/bookmarks.json', content: '{"bookmarks": ["https://example.com"]}' },
        
        // Bob のプロジェクトファイル
        { path: 'projects/bob/api-docs.md', content: '# API Documentation by Bob' },
        { path: 'projects/bob/test-data.json', content: '{"testCases": [1, 2, 3]}' },
        
        // Charlie のデザインファイル
        { path: 'designs/charlie/wireframes.md', content: '# UI Wireframes by Charlie' },
        { path: 'designs/charlie/color-palette.json', content: '{"colors": ["#FF0000", "#00FF00"]}' }
      ];
      
      // 各ユーザーが対応するファイルをアップロード
      const aliceUploads = await Promise.all([
        aliceClient.storage.upload(userFiles[0].path, userFiles[0].content, { contentType: 'text/markdown' }),
        aliceClient.storage.upload(userFiles[1].path, userFiles[1].content, { contentType: 'application/json' })
      ]);
      
      const bobUploads = await Promise.all([
        bobClient.storage.upload(userFiles[2].path, userFiles[2].content, { contentType: 'text/markdown' }),
        bobClient.storage.upload(userFiles[3].path, userFiles[3].content, { contentType: 'application/json' })
      ]);
      
      const charlieUploads = await Promise.all([
        charlieClient.storage.upload(userFiles[4].path, userFiles[4].content, { contentType: 'text/markdown' }),
        charlieClient.storage.upload(userFiles[5].path, userFiles[5].content, { contentType: 'application/json' })
      ]);
      
      // 全てのアップロードが成功
      [...aliceUploads, ...bobUploads, ...charlieUploads].forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // ファイルパスをクリーンアップリストに追加
      userFiles.forEach(file => uploadedFiles.push(file.path));
      
      // 各ディレクトリの内容を確認
      const personalFiles = await aliceClient.storage.list('personal/alice/');
      const projectFiles = await bobClient.storage.list('projects/bob/');
      const designFiles = await charlieClient.storage.list('designs/charlie/');
      
      expect(personalFiles.success).toBe(true);
      expect(projectFiles.success).toBe(true);
      expect(designFiles.success).toBe(true);
      
      expect(personalFiles.data!.files.length).toBe(2);
      expect(projectFiles.data!.files.length).toBe(2);
      expect(designFiles.data!.files.length).toBe(2);
    });

    it('should handle file access across team members', async () => {
      // チーム共有ディレクトリ
      const teamFilePath = 'team-resources/shared-config.json';
      const config = {
        teamName: 'Development Team',
        settings: { notifications: true, theme: 'professional' },
        members: ['Alice', 'Bob', 'Charlie']
      };
      
      // Alice が共有設定をアップロード
      const configContent = JSON.stringify(config, null, 2);
      const uploadResult = await aliceClient.storage.upload(teamFilePath, configContent, {
        contentType: 'application/json'
      });
      expect(uploadResult.success).toBe(true);
      uploadedFiles.push(teamFilePath);
      
      // 全チームメンバーが同じファイルにアクセス可能
      const [aliceAccess, bobAccess, charlieAccess] = await Promise.all([
        aliceClient.storage.download(teamFilePath),
        bobClient.storage.download(teamFilePath),
        charlieClient.storage.download(teamFilePath)
      ]);
      
      expect(aliceAccess.success).toBe(true);
      expect(bobAccess.success).toBe(true);
      expect(charlieAccess.success).toBe(true);
      
      // 全員が同じ内容を取得
      const parsedAlice = JSON.parse(aliceAccess.data!);
      const parsedBob = JSON.parse(bobAccess.data!);
      const parsedCharlie = JSON.parse(charlieAccess.data!);
      
      expect(parsedAlice).toEqual(config);
      expect(parsedBob).toEqual(config);
      expect(parsedCharlie).toEqual(config);
    });
  });
});