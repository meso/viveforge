// E2E Test: Custom SQL Features
// カスタムSQL機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Project, Task, User } from './fixtures/types';

describe('Custom SQL Features E2E Tests', () => {
  let vibebase: VibebaseClient;
  let testTeam: Team;
  let testProject: Project;
  let testUsers: User[] = [];
  let createdCustomQueries: string[] = [];
  
  const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
  const apiKey = process.env.VIBEBASE_API_KEY || 'vb_live_test123456789012345678901234567890';

  beforeAll(async () => {
    vibebase = createClient({
      apiUrl,
      apiKey
    });

    // テスト用カスタムクエリをクリーンアップ
    try {
      const existingQueries = await vibebase.customQueries.list();
      if (existingQueries.success) {
        for (const query of existingQueries.data) {
          if (query.name.includes('Test') || query.slug.includes('test')) {
            try {
              await vibebase.customQueries.delete(query.id);
            } catch (error) {
              console.warn(`Failed to cleanup existing query ${query.id}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup existing queries:', error);
    }

    // テストユーザーを取得
    const userEmails = ['alice@example.com', 'bob@example.com'];
    for (const email of userEmails) {
      const result = await vibebase.data.list<User>('users', {
        where: { email }
      });
      if (result.data.length > 0) {
        testUsers.push(result.data[0]);
      }
    }

    // テスト用のチームとプロジェクトを作成
    testTeam = await vibebase.data.create<Team>('teams', {
      name: 'Custom SQL Test Team',
      description: 'Team for custom SQL testing',
      created_by: testUsers[0].id
    });

    const projectData = {
      team_id: testTeam.success ? testTeam.data.id : testTeam.id,
      name: 'Custom SQL Test Project',
      description: 'Project for custom SQL testing',
      status: 'active',
      created_by: testUsers[0].id
    };
    
    testProject = await vibebase.data.create<Project>('projects', projectData);

    // テスト用のタスクをいくつか作成
    for (let i = 1; i <= 5; i++) {
      await vibebase.data.create<Task>('tasks', {
        project_id: testProject?.success ? testProject.data.id : testProject?.id,
        title: `Test Task ${i}`,
        description: `Description for test task ${i}`,
        status: i <= 2 ? 'todo' : i <= 4 ? 'in_progress' : 'done',
        priority: i <= 2 ? 'high' : i <= 4 ? 'medium' : 'low',
        created_by: testUsers[0].id
      });
    }
  });

  afterAll(async () => {
    // クリーンアップ
    for (const queryId of createdCustomQueries) {
      try {
        await vibebase.customQueries.delete(queryId);
      } catch (error) {
        console.warn(`Failed to cleanup custom query ${queryId}:`, error);
      }
    }

    // プロジェクトのタスクを削除
    const tasksResult = await vibebase.data.list<Task>('tasks', {
      where: { project_id: testProject.id }
    });
    for (const task of tasksResult.data) {
      await vibebase.data.delete('tasks', task.id);
    }

    if (testProject) {
      await vibebase.data.delete('projects', testProject?.success ? testProject.data.id : testProject?.id);
    }
    if (testTeam) {
      await vibebase.data.delete('teams', testTeam.id);
    }
  });

  describe('Custom Query Creation and Management', () => {
    it('should create a custom query', async () => {
      const timestamp = Date.now();
      const query = {
        slug: `get-project-tasks-${timestamp}`,
        name: 'Get Project Tasks',
        sql_query: 'SELECT * FROM tasks WHERE project_id = :project_id ORDER BY created_at DESC',
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        cache_ttl: 300,
        is_enabled: true
      };

      // First test basic API connection
      console.log('Testing API connection...');
      try {
        const healthResult = await vibebase.health();
        console.log('Health check result:', healthResult);
      } catch (error) {
        console.log('Health check error:', error);
      }

      console.log('Sending query:', JSON.stringify(query, null, 2));
      const result = await vibebase.customQueries.create(query);
      console.log('Create result:', JSON.stringify(result, null, 2));
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(query.name);
      expect(result.data.sql_query).toBe(query.sql_query);
      expect(result.data.is_enabled).toBe(true);
      
      createdCustomQueries.push(result.data.id);
    });

    it('should list custom queries', async () => {
      const result = await vibebase.customQueries.list();
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      const createdQuery = result.data.find(q => q.name === 'Get Project Tasks');
      expect(createdQuery).toBeDefined();
    });

    it('should update a custom query', async () => {
      const queryId = createdCustomQueries[0];
      const updates = {
        name: 'Get Project Tasks (Updated)',
        cache_ttl: 600,
        is_enabled: false
      };

      const result = await vibebase.customQueries.update(queryId, updates);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe(updates.name);
      expect(result.data.cache_ttl).toBe(updates.cache_ttl);
      expect(result.data.is_enabled).toBe(updates.is_enabled ? 1 : 0);
    });

    it('should get a specific custom query', async () => {
      const queryId = createdCustomQueries[0];
      
      const result = await vibebase.customQueries.get(queryId);
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(queryId);
      expect(result.data.name).toBe('Get Project Tasks (Updated)');
    });
  });

  describe('Custom Query Execution', () => {
    it('should execute a custom query with parameters', async () => {
      // まず実行可能なクエリを作成
      const timestamp = Date.now();
      const query = {
        slug: `get-tasks-by-status-${timestamp}`,
        name: 'Get Tasks by Status',
        sql_query: 'SELECT id, title, status, priority FROM tasks WHERE status = :status AND project_id = :project_id',
        parameters: [
          {
            name: 'status',
            type: 'string' as const,
            required: true
          },
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      const projectId = testProject?.success ? testProject.data.id : testProject?.id;

      // クエリを実行
      const executeResult = await vibebase.customQueries.execute(createResult.data.id, {
        status: 'todo',
        project_id: projectId
      });
      expect(executeResult.success).toBe(true);
      expect(Array.isArray(executeResult.data.data)).toBe(true);
      expect(executeResult.data.parameters).toEqual({
        status: 'todo',
        project_id: projectId
      });
      expect(typeof executeResult.data.execution_time).toBe('number');
      expect(typeof executeResult.data.cached).toBe('boolean');
    });

    it('should execute query by slug', async () => {
      // 日本語名のクエリを作成
      const timestamp = Date.now();
      const query = {
        slug: `project-tasks-by-slug-${timestamp}`,
        name: 'プロジェクトタスク一覧',
        sql_query: 'SELECT id, title, status FROM tasks WHERE project_id = :project_id',
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      // slugで実行
      const executeResult = await vibebase.customQueries.executeBySlug(createResult.data.slug, {
        project_id: testProject?.success ? testProject.data.id : testProject?.id
      });

      expect(executeResult.success).toBe(true);
      expect(Array.isArray(executeResult.data.data)).toBe(true);
    });

    it('should handle missing required parameters', async () => {
      // 有効なクエリを作成（前のテストで最初のクエリが無効化されているため）
      const timestamp = Date.now();
      const query = {
        slug: `test-missing-params-${timestamp}`,
        name: 'Test Missing Parameters',
        sql_query: 'SELECT * FROM tasks WHERE project_id = :project_id AND status = :status',
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          },
          {
            name: 'status',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      try {
        await vibebase.customQueries.execute(createResult.data.id, {
          // project_id パラメータが不足
          status: 'todo'
        });
        
        // エラーが発生すべき
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('Required');
      }
    });

    it('should validate parameter types', async () => {
      // 数値パラメータを持つクエリを作成
      const timestamp = Date.now();
      const query = {
        slug: `get-recent-tasks-validation-${timestamp}`,
        name: 'Get Recent Tasks',
        sql_query: 'SELECT * FROM tasks WHERE project_id = :project_id LIMIT :limit',
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          },
          {
            name: 'limit',
            type: 'number' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      // 正しい型で実行
      const executeResult = await vibebase.customQueries.execute(createResult.data.id, {
        project_id: testProject?.success ? testProject.data.id : testProject?.id,
        limit: 3
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.data.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Custom Query Caching', () => {
    it('should cache query results', async () => {
      // キャッシュ付きクエリを作成
      const timestamp = Date.now();
      const query = {
        slug: `cached-task-count-${timestamp}`,
        name: 'Cached Task Count',
        sql_query: 'SELECT COUNT(*) as count FROM tasks WHERE project_id = :project_id',
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        cache_ttl: 60,
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      const params = { project_id: testProject?.success ? testProject.data.id : testProject?.id };

      // 最初の実行（キャッシュなし）
      const firstResult = await vibebase.customQueries.execute(createResult.data.id, params);
      expect(firstResult.success).toBe(true);
      expect(firstResult.data.cached).toBe(false);

      // 2回目の実行（キャッシュあり）
      const secondResult = await vibebase.customQueries.execute(createResult.data.id, params);
      expect(secondResult.success).toBe(true);
      expect(secondResult.data.cached).toBe(true);
      
      // 結果は同じであるべき
      expect(secondResult.data.data).toEqual(firstResult.data.data);
    });
  });

  describe('Complex Query Scenarios', () => {
    it('should execute aggregation queries', async () => {
      const timestamp = Date.now();
      const query = {
        slug: `task-statistics-${timestamp}`,
        name: 'Task Statistics',
        sql_query: `
          SELECT 
            status,
            priority,
            COUNT(*) as count,
            AVG(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completion_rate
          FROM tasks 
          WHERE project_id = :project_id 
          GROUP BY status, priority
          ORDER BY status, priority
        `,
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      const executeResult = await vibebase.customQueries.execute(createResult.data.id, {
        project_id: testProject?.success ? testProject.data.id : testProject?.id
      });

      expect(executeResult.success).toBe(true);
      expect(Array.isArray(executeResult.data.data)).toBe(true);
      
      // 統計データが含まれていることを確認
      const stats = executeResult.data.data;
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0]).toHaveProperty('status');
      expect(stats[0]).toHaveProperty('priority');
      expect(stats[0]).toHaveProperty('count');
    });

    it('should execute joins with related tables', async () => {
      const timestamp = Date.now();
      const query = {
        slug: `tasks-with-project-info-${timestamp}`,
        name: 'Tasks with Project Info',
        sql_query: `
          SELECT 
            t.id,
            t.title,
            t.status,
            p.name as project_name,
            u.email as created_by_email
          FROM tasks t
          JOIN projects p ON t.project_id = p.id
          JOIN users u ON t.created_by = u.id
          WHERE t.project_id = :project_id
          ORDER BY t.created_at DESC
        `,
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      const executeResult = await vibebase.customQueries.execute(createResult.data.id, {
        project_id: testProject?.success ? testProject.data.id : testProject?.id
      });

      expect(executeResult.success).toBe(true);
      expect(Array.isArray(executeResult.data.data)).toBe(true);
      
      // JOINされたデータが含まれていることを確認
      if (executeResult.data.data.length > 0) {
        const task = executeResult.data.data[0];
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('project_name');
        expect(task).toHaveProperty('created_by_email');
      }
    });

    it('should handle date parameters', async () => {
      const timestamp = Date.now();
      const query = {
        slug: `tasks-by-date-range-${timestamp}`,
        name: 'Tasks by Date Range',
        sql_query: `
          SELECT id, title, created_at 
          FROM tasks 
          WHERE project_id = :project_id 
            AND created_at >= :start_date 
            AND created_at <= :end_date
          ORDER BY created_at DESC
        `,
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          },
          {
            name: 'start_date',
            type: 'date' as const,
            required: true
          },
          {
            name: 'end_date',
            type: 'date' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const executeResult = await vibebase.customQueries.execute(createResult.data.id, {
        project_id: testProject?.success ? testProject.data.id : testProject?.id,
        start_date: oneWeekAgo.toISOString(),
        end_date: now.toISOString()
      });

      expect(executeResult.success).toBe(true);
      expect(Array.isArray(executeResult.data.data)).toBe(true);
    });
  });

  describe('Query Security and Validation', () => {
    it('should reject non-SELECT queries', async () => {
      const timestamp = Date.now();
      const query = {
        slug: `malicious-query-test-${timestamp}`,
        name: 'Malicious Query',
        sql_query: 'DELETE FROM tasks WHERE id = :task_id',
        parameters: [
          {
            name: 'task_id',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: true
      };

      try {
        await vibebase.customQueries.create(query);
        // エラーが発生すべき
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('SELECT');
      }
    });

    it('should handle disabled queries', async () => {
      // 無効なクエリを作成
      const timestamp = Date.now();
      const query = {
        slug: `disabled-query-test-${timestamp}`,
        name: 'Disabled Query',
        sql_query: 'SELECT * FROM tasks WHERE project_id = :project_id',
        parameters: [
          {
            name: 'project_id',
            type: 'string' as const,
            required: true
          }
        ],
        is_enabled: false
      };

      const createResult = await vibebase.customQueries.create(query);
      expect(createResult.success).toBe(true);
      createdCustomQueries.push(createResult.data.id);

      try {
        await vibebase.customQueries.execute(createResult.data.id, {
          project_id: testProject?.success ? testProject.data.id : testProject?.id
        });
        // エラーが発生すべき
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('disabled');
      }
    });
  });
});