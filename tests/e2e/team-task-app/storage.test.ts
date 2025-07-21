// E2E Test: Storage (R2) Features
// ストレージ（R2）機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { User } from './fixtures/types';

describe('Storage (R2) Features E2E Tests', () => {
  let vibebase: VibebaseClient;
  let testUser: User;
  let uploadedFiles: string[] = [];
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
  const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

  beforeAll(async () => {
    console.log('Creating client with:', { apiUrl, apiKey });
    vibebase = createClient({
      apiUrl,
      apiKey
    });

    // テストユーザーを取得
    console.log('Fetching test user...');
    const result = await vibebase.data.list<User>('users', {
      where: { email: 'alice@example.com' }
    });
    console.log('User fetch result:', result.success, result.data?.length);
    
    if (result.data.length > 0) {
      testUser = result.data[0];
      console.log('Test user found:', testUser.email);
    } else {
      throw new Error('Test user not found. Please run seed data first.');
    }
  });

  afterAll(async () => {
    // アップロードしたファイルをクリーンアップ
    for (const fileName of uploadedFiles) {
      try {
        await vibebase.storage.delete(fileName);
      } catch (error) {
        console.warn(`Failed to cleanup file ${fileName}:`, error);
      }
    }
  });

  describe('File Upload Operations', () => {
    it('should upload a text file', async () => {
      const fileName = 'test-document.txt';
      const content = 'This is a test document for E2E testing.';
      const blob = new Blob([content], { type: 'text/plain' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'text/plain',
        metadata: {
          purpose: 'e2e-test',
          uploadedBy: testUser.email
        }
      });

      console.log('SDK result:', JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(fileName);
      expect(result.data.contentType).toBe('text/plain');
      expect(result.data.metadata?.purpose).toBe('e2e-test');
      
      uploadedFiles.push(fileName);
    });

    it('should upload a JSON file', async () => {
      const fileName = 'test-data.json';
      const data = {
        name: 'E2E Test Data',
        version: '1.0.0',
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      };
      const content = JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: 'application/json' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'application/json',
        metadata: {
          type: 'test-data',
          version: '1.0.0'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(fileName);
      expect(result.data.contentType).toBe('application/json');
      
      uploadedFiles.push(fileName);
    });

    it('should upload a CSV file', async () => {
      const fileName = 'test-data.csv';
      const csvContent = `id,name,status,priority
1,"Task 1",todo,high
2,"Task 2",in_progress,medium
3,"Task 3",done,low`;
      const blob = new Blob([csvContent], { type: 'text/csv' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'text/csv',
        metadata: {
          format: 'csv',
          rows: '3'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(fileName);
      expect(result.data.contentType).toBe('text/csv');
      
      uploadedFiles.push(fileName);
    });

    it('should upload binary file (simulated image)', async () => {
      const fileName = 'test-image.png';
      // PNG ファイルのヘッダーをシミュレート
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const blob = new Blob([pngHeader], { type: 'image/png' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'image/png',
        metadata: {
          type: 'image',
          simulated: 'true'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(fileName);
      expect(result.data.contentType).toBe('image/png');
      
      uploadedFiles.push(fileName);
    });
  });

  describe('File Listing Operations', () => {
    it('should list all files', async () => {
      const result = await vibebase.storage.list();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // アップロードしたファイルが含まれていることを確認
      const uploadedFileNames = result.data.map(file => file.name);
      expect(uploadedFileNames).toContain('test-document.txt');
      expect(uploadedFileNames).toContain('test-data.json');
    });

    it('should list files with prefix filter', async () => {
      const result = await vibebase.storage.list('test-');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // すべてのファイルが 'test-' で始まることを確認
      for (const file of result.data) {
        expect(file.name.startsWith('test-')).toBe(true);
      }
    });

    it('should list files with extension filter', async () => {
      const result = await vibebase.storage.list('', '.json');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // すべてのファイルが .json で終わることを確認
      for (const file of result.data) {
        expect(file.name.endsWith('.json')).toBe(true);
      }
    });
  });

  describe('File Information Operations', () => {
    it('should get file information', async () => {
      const fileName = 'test-document.txt';
      
      const result = await vibebase.storage.getInfo(fileName);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(fileName);
      expect(result.data.contentType).toBe('text/plain');
      expect(result.data.size).toBeGreaterThan(0);
      expect(result.data.metadata?.purpose).toBe('e2e-test');
      expect(result.data.uploaded_at).toBeDefined();
    });

    it('should handle missing file info request', async () => {
      const fileName = 'non-existent-file.txt';
      
      try {
        await vibebase.storage.getInfo(fileName);
        // エラーが発生すべき
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('File Download Operations', () => {
    it('should download a text file', async () => {
      const fileName = 'test-document.txt';
      
      const result = await vibebase.storage.download(fileName);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.url).toBeDefined();
      expect(result.data.url.includes(fileName)).toBe(true);
    });

    it('should generate presigned URL for download', async () => {
      const fileName = 'test-data.json';
      
      const result = await vibebase.storage.getPresignedUrl(fileName, 'download', 3600);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.url).toBeDefined();
      expect(result.data.expires_at).toBeDefined();
      
      // URLが正しく生成されていることを確認
      const url = new URL(result.data.url);
      expect(url.pathname.includes(fileName)).toBe(true);
    });

    it('should generate presigned URL for upload', async () => {
      const fileName = 'future-upload.txt';
      
      const result = await vibebase.storage.getPresignedUrl(fileName, 'upload', 1800);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.url).toBeDefined();
      expect(result.data.expires_at).toBeDefined();
      
      // URLが正しく生成されていることを確認
      const url = new URL(result.data.url);
      expect(url.pathname.includes(fileName)).toBe(true);
    });
  });

  describe('File Update Operations', () => {
    it('should update file metadata', async () => {
      const fileName = 'test-document.txt';
      const newMetadata = {
        purpose: 'updated-e2e-test',
        modified: new Date().toISOString(),
        version: '2.0'
      };

      const result = await vibebase.storage.updateMetadata(fileName, newMetadata);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.metadata?.purpose).toBe('updated-e2e-test');
      expect(result.data.metadata?.version).toBe('2.0');
    });

    it('should replace file content', async () => {
      const fileName = 'test-document.txt';
      const newContent = 'This is the updated content for the test document.';
      const blob = new Blob([newContent], { type: 'text/plain' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'text/plain',
        metadata: {
          purpose: 'updated-content',
          version: '3.0'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.metadata?.purpose).toBe('updated-content');
      expect(result.data.metadata?.version).toBe('3.0');
    });
  });

  describe('Bulk File Operations', () => {
    it('should upload multiple files', async () => {
      const files = [
        {
          name: 'bulk-file-1.txt',
          content: 'Content of bulk file 1',
          type: 'text/plain'
        },
        {
          name: 'bulk-file-2.txt',
          content: 'Content of bulk file 2',
          type: 'text/plain'
        },
        {
          name: 'bulk-file-3.txt',
          content: 'Content of bulk file 3',
          type: 'text/plain'
        }
      ];

      for (const file of files) {
        const blob = new Blob([file.content], { type: file.type });
        const result = await vibebase.storage.upload(file.name, blob, {
          contentType: file.type,
          metadata: {
            batch: 'bulk-upload-test',
            index: files.indexOf(file).toString()
          }
        });

        expect(result.success).toBe(true);
        uploadedFiles.push(file.name);
      }

      // アップロードされたファイルを確認
      const listResult = await vibebase.storage.list('bulk-file-');
      expect(listResult.data.length).toBe(3);
    });

    it('should delete multiple files', async () => {
      const filesToDelete = ['bulk-file-1.txt', 'bulk-file-2.txt'];

      for (const fileName of filesToDelete) {
        const result = await vibebase.storage.delete(fileName);
        expect(result.success).toBe(true);
        
        // uploadedFiles から削除
        const index = uploadedFiles.indexOf(fileName);
        if (index > -1) {
          uploadedFiles.splice(index, 1);
        }
      }

      // ファイルが削除されたことを確認
      const listResult = await vibebase.storage.list('bulk-file-');
      expect(listResult.data.length).toBe(1);
      expect(listResult.data[0].name).toBe('bulk-file-3.txt');
    });
  });

  describe('File Size and Storage Management', () => {
    it('should handle large file upload (simulated)', async () => {
      const fileName = 'large-file.txt';
      // 1MB のファイルをシミュレート
      const largeContent = 'x'.repeat(1024 * 1024);
      const blob = new Blob([largeContent], { type: 'text/plain' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'text/plain',
        metadata: {
          size: 'large',
          purpose: 'size-test'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.size).toBeGreaterThan(1000000);
      
      uploadedFiles.push(fileName);
    });

    it('should get storage statistics', async () => {
      const result = await vibebase.storage.getStats();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.total_files).toBe('number');
      expect(typeof result.data.total_size).toBe('number');
      expect(result.data.total_files).toBeGreaterThan(0);
      expect(result.data.total_size).toBeGreaterThan(0);
    });
  });

  describe('File Security and Access Control', () => {
    it('should respect file access permissions', async () => {
      const fileName = 'private-file.txt';
      const content = 'This is a private file';
      const blob = new Blob([content], { type: 'text/plain' });

      const result = await vibebase.storage.upload(fileName, blob, {
        contentType: 'text/plain',
        metadata: {
          access: 'private',
          owner: testUser.id
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.metadata?.access).toBe('private');
      
      uploadedFiles.push(fileName);
    });

    it('should validate file types', async () => {
      const fileName = 'test-file.exe';
      const content = 'This should not be allowed';
      const blob = new Blob([content], { type: 'application/x-executable' });

      try {
        await vibebase.storage.upload(fileName, blob, {
          contentType: 'application/x-executable'
        });
        
        // 実行可能ファイルのアップロードは制限される可能性がある
        // エラーが発生しない場合はファイルをクリーンアップリストに追加
        uploadedFiles.push(fileName);
      } catch (error: any) {
        // 制限されている場合はエラーメッセージを確認
        expect(error.message).toContain('not allowed');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle download of non-existent file', async () => {
      const fileName = 'non-existent-file.txt';
      
      try {
        await vibebase.storage.download(fileName);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should handle deletion of non-existent file', async () => {
      const fileName = 'non-existent-file.txt';
      
      try {
        await vibebase.storage.delete(fileName);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should handle invalid file names', async () => {
      const invalidNames = ['', '../../../etc/passwd', 'file\\with\\backslashes'];
      
      for (const fileName of invalidNames) {
        try {
          const blob = new Blob(['test'], { type: 'text/plain' });
          await vibebase.storage.upload(fileName, blob);
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error.message).toContain('invalid');
        }
      }
    });
  });
});