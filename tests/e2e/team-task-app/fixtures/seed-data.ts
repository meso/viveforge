// Test Data Generator for Team Task Management App
// チームタスク管理アプリのテストデータ生成

import type { Team, Member, Project, Task, TaskComment, User } from './types';

// テストユーザー
export const testUsers: Omit<User, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    email: 'alice@example.com',
    name: 'Alice Johnson',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice'
  },
  {
    email: 'bob@example.com',
    name: 'Bob Smith',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob'
  },
  {
    email: 'charlie@example.com',
    name: 'Charlie Brown',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie'
  },
  {
    email: 'diana@example.com',
    name: 'Diana Prince',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana'
  },
  {
    email: 'eve@example.com',
    name: 'Eve Wilson',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=eve'
  }
];

// テストチーム
export const generateTeams = (userIds: string[]): Omit<Team, 'id' | 'created_at' | 'updated_at'>[] => [
  {
    name: 'Engineering Team',
    description: 'Core product development team',
    created_by: userIds[0]
  },
  {
    name: 'Marketing Team',
    description: 'Growth and marketing initiatives',
    created_by: userIds[1]
  },
  {
    name: 'Design Team',
    description: 'UI/UX and product design',
    created_by: userIds[2]
  }
];

// チームメンバー（チーム固有プロフィール含む）
export const generateMembers = (teamIds: string[], userIds: string[]): Omit<Member, 'id' | 'joined_at' | 'created_at' | 'updated_at'>[] => [
  // Engineering Team
  { 
    team_id: teamIds[0], user_id: userIds[0], role: 'owner', invited_by: userIds[0],
    display_name: 'Alice (Tech Lead)', 
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice-eng',
    bio: 'Full-stack engineer with 8 years experience',
    job_title: 'Senior Engineering Manager',
    timezone: 'America/New_York'
  },
  { 
    team_id: teamIds[0], user_id: userIds[1], role: 'admin', invited_by: userIds[0],
    display_name: 'Bob Smith',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob-eng',
    bio: 'Backend specialist, loves GraphQL and microservices',
    job_title: 'Senior Backend Engineer',
    timezone: 'America/Los_Angeles'
  },
  { 
    team_id: teamIds[0], user_id: userIds[2], role: 'member', invited_by: userIds[0],
    display_name: 'Charlie Brown',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie-eng',
    bio: 'Frontend enthusiast, React and TypeScript expert',
    job_title: 'Frontend Developer',
    timezone: 'Europe/London'
  },
  { 
    team_id: teamIds[0], user_id: userIds[3], role: 'member', invited_by: userIds[1],
    display_name: 'Diana Prince',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana-eng',
    bio: 'Mobile developer focused on React Native',
    job_title: 'Mobile Developer',
    timezone: 'America/New_York'
  },
  
  // Marketing Team - 異なるペルソナ
  { 
    team_id: teamIds[1], user_id: userIds[1], role: 'owner', invited_by: userIds[1],
    display_name: 'Bobby (Growth)', 
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob-marketing',
    bio: 'Growth hacker with data-driven mindset',
    job_title: 'VP of Growth',
    timezone: 'America/Los_Angeles'
  },
  { 
    team_id: teamIds[1], user_id: userIds[3], role: 'admin', invited_by: userIds[1],
    display_name: 'Wonder Woman',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana-marketing', 
    bio: 'Creative marketing strategist',
    job_title: 'Marketing Director',
    timezone: 'America/New_York'
  },
  { 
    team_id: teamIds[1], user_id: userIds[4], role: 'member', invited_by: userIds[1],
    display_name: 'Eve Wilson',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=eve-marketing',
    bio: 'Content creator and social media expert',
    job_title: 'Content Marketing Manager', 
    timezone: 'America/Chicago'
  },
  
  // Design Team - クリエイティブペルソナ
  { 
    team_id: teamIds[2], user_id: userIds[2], role: 'owner', invited_by: userIds[2],
    display_name: '🎨 Charlie Design',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie-design',
    bio: 'Design systems enthusiast, accessibility advocate',
    job_title: 'Lead Product Designer',
    timezone: 'Europe/London'
  },
  { 
    team_id: teamIds[2], user_id: userIds[0], role: 'member', invited_by: userIds[2],
    display_name: 'Alice J.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice-design',
    bio: 'Engineer with design background',
    job_title: 'Design Engineer',
    timezone: 'America/New_York'
  },
  { 
    team_id: teamIds[2], user_id: userIds[4], role: 'member', invited_by: userIds[2],
    display_name: 'Evie ✨',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=eve-design',
    bio: 'UI designer passionate about micro-interactions',
    job_title: 'UI Designer',
    timezone: 'America/Chicago'
  }
];

// プロジェクト
export const generateProjects = (teamIds: string[], userIds: string[]): Omit<Project, 'id' | 'created_at' | 'updated_at'>[] => {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return [
    // Engineering Projects
    {
      team_id: teamIds[0],
      name: 'API v2.0 Development',
      description: 'Major API overhaul with GraphQL support',
      status: 'active',
      due_date: nextMonth.toISOString(),
      created_by: userIds[0]
    },
    {
      team_id: teamIds[0],
      name: 'Mobile App Launch',
      description: 'React Native app for iOS and Android',
      status: 'active',
      due_date: nextWeek.toISOString(),
      created_by: userIds[1]
    },
    {
      team_id: teamIds[0],
      name: 'Legacy System Migration',
      description: 'Migrate from monolith to microservices',
      status: 'completed',
      due_date: lastMonth.toISOString(),
      created_by: userIds[0]
    },
    
    // Marketing Projects
    {
      team_id: teamIds[1],
      name: 'Q4 Campaign',
      description: 'Year-end marketing campaign',
      status: 'active',
      due_date: nextMonth.toISOString(),
      created_by: userIds[1]
    },
    {
      team_id: teamIds[1],
      name: 'Content Strategy 2024',
      description: 'Blog and social media content planning',
      status: 'active',
      created_by: userIds[3]
    },
    
    // Design Projects
    {
      team_id: teamIds[2],
      name: 'Design System 2.0',
      description: 'Complete component library redesign',
      status: 'active',
      due_date: nextMonth.toISOString(),
      created_by: userIds[2]
    },
    {
      team_id: teamIds[2],
      name: 'Mobile App Redesign',
      description: 'New UI for mobile application',
      status: 'archived',
      created_by: userIds[2]
    }
  ];
};

// タスク
export const generateTasks = (projectIds: string[], userIds: string[]): Omit<Task, 'id' | 'created_at' | 'updated_at'>[] => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const tasks: Omit<Task, 'id' | 'created_at' | 'updated_at'>[] = [];

  // API v2.0 Development tasks
  tasks.push(
    {
      project_id: projectIds[0],
      title: 'Design GraphQL Schema',
      description: 'Define the complete GraphQL schema for v2.0',
      status: 'done',
      priority: 'high',
      assigned_to: userIds[0],
      estimated_hours: 16,
      actual_hours: 20,
      created_by: userIds[0],
      completed_at: yesterday.toISOString()
    },
    {
      project_id: projectIds[0],
      title: 'Implement Authentication',
      description: 'JWT-based auth with refresh tokens',
      status: 'in_progress',
      priority: 'urgent',
      assigned_to: userIds[1],
      due_date: tomorrow.toISOString(),
      estimated_hours: 24,
      actual_hours: 12,
      created_by: userIds[0]
    },
    {
      project_id: projectIds[0],
      title: 'Write API Documentation',
      description: 'Complete API docs with examples',
      status: 'todo',
      priority: 'medium',
      assigned_to: userIds[2],
      due_date: nextWeek.toISOString(),
      estimated_hours: 8,
      created_by: userIds[1]
    },
    {
      project_id: projectIds[0],
      title: 'Performance Testing',
      description: 'Load testing and optimization',
      status: 'todo',
      priority: 'high',
      estimated_hours: 16,
      created_by: userIds[0]
    }
  );

  // Mobile App Launch tasks
  tasks.push(
    {
      project_id: projectIds[1],
      title: 'Fix iOS Push Notifications',
      description: 'Notifications not working on iOS 17',
      status: 'review',
      priority: 'urgent',
      assigned_to: userIds[3],
      due_date: tomorrow.toISOString(),
      estimated_hours: 8,
      actual_hours: 10,
      created_by: userIds[1]
    },
    {
      project_id: projectIds[1],
      title: 'Implement Offline Mode',
      description: 'Local data sync when offline',
      status: 'in_progress',
      priority: 'high',
      assigned_to: userIds[0],
      estimated_hours: 40,
      actual_hours: 25,
      created_by: userIds[1]
    },
    {
      project_id: projectIds[1],
      title: 'App Store Submission',
      description: 'Prepare and submit to Apple App Store',
      status: 'todo',
      priority: 'high',
      due_date: nextWeek.toISOString(),
      estimated_hours: 4,
      created_by: userIds[1]
    }
  );

  // Marketing Campaign tasks
  tasks.push(
    {
      project_id: projectIds[3],
      title: 'Create Landing Page',
      description: 'Campaign-specific landing page',
      status: 'in_progress',
      priority: 'high',
      assigned_to: userIds[4],
      due_date: nextWeek.toISOString(),
      estimated_hours: 16,
      actual_hours: 8,
      created_by: userIds[1]
    },
    {
      project_id: projectIds[3],
      title: 'Social Media Assets',
      description: 'Design posts for all platforms',
      status: 'todo',
      priority: 'medium',
      assigned_to: userIds[2],
      estimated_hours: 12,
      created_by: userIds[3]
    }
  );

  // Design System tasks
  tasks.push(
    {
      project_id: projectIds[5],
      title: 'Color System Redesign',
      description: 'New color palette with accessibility in mind',
      status: 'done',
      priority: 'high',
      assigned_to: userIds[2],
      estimated_hours: 20,
      actual_hours: 24,
      created_by: userIds[2],
      completed_at: yesterday.toISOString()
    },
    {
      project_id: projectIds[5],
      title: 'Component Documentation',
      description: 'Storybook setup and docs',
      status: 'in_progress',
      priority: 'medium',
      assigned_to: userIds[4],
      estimated_hours: 30,
      actual_hours: 15,
      created_by: userIds[2]
    },
    {
      project_id: projectIds[5],
      title: 'Dark Mode Support',
      description: 'Implement dark mode across all components',
      status: 'todo',
      priority: 'low',
      estimated_hours: 40,
      created_by: userIds[0]
    }
  );

  return tasks;
};

// タスクコメント
export const generateTaskComments = (taskIds: string[], userIds: string[]): Omit<TaskComment, 'id' | 'created_at' | 'updated_at'>[] => [
  {
    task_id: taskIds[0],
    user_id: userIds[1],
    comment: 'Great progress on the schema design! I think we should also consider subscriptions.',
    is_edited: false
  },
  {
    task_id: taskIds[0],
    user_id: userIds[0],
    comment: 'Good point! I\'ll add subscription support in the next iteration.',
    is_edited: false
  },
  {
    task_id: taskIds[1],
    user_id: userIds[0],
    comment: 'How\'s the progress on this? We need it done by tomorrow.',
    is_edited: false
  },
  {
    task_id: taskIds[1],
    user_id: userIds[1],
    comment: 'Almost done! Just finishing up the refresh token logic. Will submit PR today.',
    is_edited: false
  },
  {
    task_id: taskIds[4],
    user_id: userIds[1],
    comment: 'I found the issue! It was a certificate problem. Testing the fix now.',
    is_edited: false
  },
  {
    task_id: taskIds[4],
    user_id: userIds[3],
    comment: 'Update: Fix is working on test devices. Ready for review.',
    is_edited: true
  },
  {
    task_id: taskIds[7],
    user_id: userIds[3],
    comment: 'Landing page first draft is ready. Please check the design mockup.',
    is_edited: false
  },
  {
    task_id: taskIds[9],
    user_id: userIds[0],
    comment: 'The new color system looks amazing! Great work on accessibility.',
    is_edited: false
  },
  {
    task_id: taskIds[9],
    user_id: userIds[2],
    comment: 'Thanks! I used WCAG 2.1 Level AA as the baseline.',
    is_edited: false
  }
];

// テスト用APIキー
export const generateAPIKeys = (userIds: string[]) => [
  {
    id: 'test-api-key-1',
    name: 'E2E Test API Key',
    key_hash: 'a596136871752b2d32b9c4fc198e0d033f49d7818a792e52647b99cb77853568', // SHA256 hash of 'vb_live_test123456789012345678901234567890'
    key_prefix: 'vb_live_test123456...',
    scopes: JSON.stringify(['data:read', 'data:write', 'data:delete', 'tables:read', 'admin:read', 'admin:write']),
    created_by: null, // 外部キー制約を避けるためnullに
    created_at: new Date().toISOString(),
    last_used_at: null,
    expires_at: null,
    is_active: 1
  }
];

// 統計データ生成用ヘルパー
export const generateActivityLogs = (teamIds: string[], projectIds: string[], taskIds: string[], userIds: string[]) => {
  const activities = [];
  const actions = ['created', 'updated', 'completed', 'assigned', 'commented'];
  const entityTypes = ['task', 'project', 'comment'] as const;

  // 最近30日間のアクティビティを生成
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    activities.push({
      team_id: teamIds[Math.floor(Math.random() * teamIds.length)],
      project_id: Math.random() > 0.3 ? projectIds[Math.floor(Math.random() * projectIds.length)] : null,
      task_id: Math.random() > 0.5 ? taskIds[Math.floor(Math.random() * taskIds.length)] : null,
      user_id: userIds[Math.floor(Math.random() * userIds.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      entity_type: entityTypes[Math.floor(Math.random() * entityTypes.length)],
      entity_id: Math.random().toString(36).substring(7),
      created_at: date.toISOString()
    });
  }

  return activities;
};

// ユーザーセッション（テスト用）
export const generateUserSessions = (userIds: string[]) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  
  return userIds.slice(0, 3).map((userId, index) => {
    const sessionId = `test-session-${userId}-${index}`;
    const accessTokenHash = btoa(`access-${sessionId}-${Date.now()}`);
    const refreshTokenHash = btoa(`refresh-${sessionId}-${Date.now()}`);
    
    return {
      id: sessionId,
      user_id: userId,
      access_token_hash: accessTokenHash,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
  });
};