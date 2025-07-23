/**
 * Real Files Storage E2E Tests
 * 実際のファイルを使用したストレージ機能のE2Eテスト
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  loadTestFile,
  uploadTestFile,
  downloadAndCompareFile,
  verifyFileInfo,
  TEST_FILES
} from './helpers/file-test-helper';

// セットアップ情報を読み込み
const setupInfo = JSON.parse(
  readFileSync(resolve(__dirname, '../.setup-info.json'), 'utf-8')
);

const API_URL = setupInfo.apiUrl;
const testTokens = setupInfo.testTokens;

describe('Real Files Storage E2E Tests', () => {
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

  describe('Text File Operations', () => {
    
    it('should upload and download text file correctly', async () => {
      const remotePath = 'real-files/alice/sample.txt';
      
      // テキストファイルをアップロード
      const uploadResult = await uploadTestFile(aliceClient, TEST_FILES.TEXT, remotePath);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data!.url).toBeDefined();
      expect(uploadResult.data!.size).toBe(uploadResult.testFile.size);
      
      uploadedFiles.push(remotePath);
      
      // ファイル情報を検証
      const infoVerification = await verifyFileInfo(aliceClient, remotePath, uploadResult.testFile);
      expect(infoVerification.success).toBe(true);
      expect(infoVerification.matches).toBe(true);
      
      // ダウンロードして内容を比較
      const downloadVerification = await downloadAndCompareFile(aliceClient, remotePath, uploadResult.testFile);
      expect(downloadVerification.success).toBe(true);
      expect(downloadVerification.matches).toBe(true);
    });

    it('should upload and download JSON config file correctly', async () => {
      const remotePath = 'real-files/bob/config.json';
      
      const uploadResult = await uploadTestFile(bobClient, TEST_FILES.CONFIG, remotePath);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data!.contentType).toBe('application/json');
      
      uploadedFiles.push(remotePath);
      
      // ダウンロードしてJSONとしてパース可能か確認
      const downloadResult = await bobClient.storage.download(remotePath);
      expect(downloadResult.success).toBe(true);
      
      // JSONとしてパース可能であることを確認
      const parsedConfig = JSON.parse(downloadResult.data!);
      expect(parsedConfig.name).toBe('test-config');
      expect(parsedConfig.version).toBe('1.0.0');
      expect(parsedConfig.features).toContain('storage');
    });
  });

  describe('Binary File Operations', () => {
    
    it('should upload and download small PNG image correctly', async () => {
      const remotePath = 'real-files/alice/small-image.png';
      
      const uploadResult = await uploadTestFile(aliceClient, TEST_FILES.SMALL_IMAGE, remotePath);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data!.contentType).toBe('image/png');
      expect(uploadResult.data!.size).toBe(uploadResult.testFile.size);
      
      uploadedFiles.push(remotePath);
      
      // ファイル情報を検証
      const infoVerification = await verifyFileInfo(aliceClient, remotePath, uploadResult.testFile);
      expect(infoVerification.success).toBe(true);
      expect(infoVerification.matches).toBe(true);
      
      // ダウンロードしてサイズを比較（バイナリファイルなので）
      const downloadVerification = await downloadAndCompareFile(aliceClient, remotePath, uploadResult.testFile);
      expect(downloadVerification.success).toBe(true);
      expect(downloadVerification.matches).toBe(true);
    });

    it('should upload and download larger binary file correctly', async () => {
      const remotePath = 'real-files/charlie/large-image.png';
      
      const uploadResult = await uploadTestFile(charlieClient, TEST_FILES.LARGE_IMAGE, remotePath);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data!.contentType).toBe('image/png');
      expect(uploadResult.data!.size).toBe(1024); // 1KB
      
      uploadedFiles.push(remotePath);
      
      // ファイル情報を検証
      const infoResult = await charlieClient.storage.getInfo(remotePath);
      expect(infoResult.success).toBe(true);
      expect(infoResult.data!.size).toBe(1024);
      expect(infoResult.data!.contentType).toBe('image/png');
    });
  });

  describe('File Sharing Between Users', () => {
    
    it('should allow file sharing between users', async () => {
      const remotePath = 'shared-files/team-document.txt';
      
      // Alice がファイルをアップロード
      const uploadResult = await uploadTestFile(aliceClient, TEST_FILES.TEXT, remotePath, {
        metadata: { 
          uploader: 'Alice',
          shared: 'true',
          description: 'Team shared document'
        }
      });
      expect(uploadResult.success).toBe(true);
      
      uploadedFiles.push(remotePath);
      
      // Bob がファイルをダウンロード
      const bobDownload = await downloadAndCompareFile(bobClient, remotePath, uploadResult.testFile);
      expect(bobDownload.success).toBe(true);
      expect(bobDownload.matches).toBe(true);
      
      // Charlie がファイル情報を取得
      const charlieInfo = await charlieClient.storage.getInfo(remotePath);
      expect(charlieInfo.success).toBe(true);
      expect(charlieInfo.data!.metadata?.uploader).toBe('Alice');
      expect(charlieInfo.data!.metadata?.shared).toBe('true');
    });
  });

  describe('File Type Variety', () => {
    
    it('should handle different file types correctly', async () => {
      const files = [
        { 
          testFile: TEST_FILES.TEXT, 
          remotePath: 'variety/sample.txt',
          user: aliceClient,
          expectedType: 'text/plain'
        },
        { 
          testFile: TEST_FILES.CONFIG, 
          remotePath: 'variety/config.json',
          user: bobClient,
          expectedType: 'application/json'
        },
        { 
          testFile: TEST_FILES.SVG, 
          remotePath: 'variety/icon.svg',
          user: charlieClient,
          expectedType: 'image/svg+xml'
        },
        { 
          testFile: TEST_FILES.SMALL_IMAGE, 
          remotePath: 'variety/image.png',
          user: aliceClient,
          expectedType: 'image/png'
        }
      ];

      // 全ファイルをアップロード
      const uploadResults = [];
      for (const fileConfig of files) {
        const result = await uploadTestFile(
          fileConfig.user, 
          fileConfig.testFile, 
          fileConfig.remotePath
        );
        expect(result.success).toBe(true);
        expect(result.data!.contentType).toBe(fileConfig.expectedType);
        
        uploadedFiles.push(fileConfig.remotePath);
        uploadResults.push({ ...result, config: fileConfig });
      }

      // ファイルリストを取得して確認
      const listResult = await aliceClient.storage.list('variety/');
      expect(listResult.success).toBe(true);
      expect(listResult.data!.files.length).toBe(4);
      
      // 各ファイルタイプが正しく保存されていることを確認
      const fileNames = listResult.data!.files.map(f => f.name);
      files.forEach(file => {
        expect(fileNames).toContain(file.remotePath);
      });
    });
  });

  describe('File Operations Edge Cases', () => {
    
    it('should handle file overwrite correctly', async () => {
      const remotePath = 'overwrite-test/document.txt';
      
      // 最初のファイルをアップロード
      const firstUpload = await uploadTestFile(aliceClient, TEST_FILES.TEXT, remotePath, {
        metadata: { version: '1' }
      });
      expect(firstUpload.success).toBe(true);
      
      uploadedFiles.push(remotePath);
      
      // 同じパスに別のファイルをアップロード（上書き）
      const secondUpload = await uploadTestFile(aliceClient, TEST_FILES.CONFIG, remotePath, {
        metadata: { version: '2' }
      });
      expect(secondUpload.success).toBe(true);
      
      // 上書き後のファイル情報を確認
      const infoResult = await aliceClient.storage.getInfo(remotePath);
      expect(infoResult.success).toBe(true);
      expect(infoResult.data!.contentType).toBe('application/json'); // CONFIGファイルのタイプ
      expect(infoResult.data!.metadata?.version).toBe('2');
    });

    it('should handle file deletion correctly', async () => {
      const remotePath = 'delete-test/temp-file.txt';
      
      // ファイルをアップロード
      const uploadResult = await uploadTestFile(bobClient, TEST_FILES.TEXT, remotePath);
      expect(uploadResult.success).toBe(true);
      
      // ファイルが存在することを確認
      const infoResult = await bobClient.storage.getInfo(remotePath);
      expect(infoResult.success).toBe(true);
      
      // ファイルを削除
      const deleteResult = await bobClient.storage.delete(remotePath);
      expect(deleteResult.success).toBe(true);
      
      // ファイルが削除されたことを確認
      try {
        const infoAfterDelete = await bobClient.storage.getInfo(remotePath);
        expect(infoAfterDelete.success).toBe(false);
      } catch (error) {
        // getInfoがthrowする場合もある（削除されたファイルに対して）
        expect(error).toBeDefined();
      }
      
      // ダウンロード試行も失敗することを確認
      const downloadAfterDelete = await bobClient.storage.download(remotePath);
      expect(downloadAfterDelete.success).toBe(false);
    });
  });

  describe('File Metadata and Properties', () => {
    
    it('should preserve and retrieve file metadata correctly', async () => {
      const remotePath = 'metadata-test/document-with-metadata.txt';
      const customMetadata = {
        author: 'Alice',
        project: 'E2E Tests',
        priority: 'high',
        tags: 'test,storage,metadata'
      };
      
      const uploadResult = await uploadTestFile(aliceClient, TEST_FILES.TEXT, remotePath, {
        metadata: customMetadata
      });
      expect(uploadResult.success).toBe(true);
      
      uploadedFiles.push(remotePath);
      
      // メタデータが正しく保存されていることを確認
      const infoResult = await aliceClient.storage.getInfo(remotePath);
      expect(infoResult.success).toBe(true);
      expect(infoResult.data!.metadata?.author).toBe('Alice');
      expect(infoResult.data!.metadata?.project).toBe('E2E Tests');
      expect(infoResult.data!.metadata?.priority).toBe('high');
      expect(infoResult.data!.metadata?.tags).toBe('test,storage,metadata');
    });
  });
});