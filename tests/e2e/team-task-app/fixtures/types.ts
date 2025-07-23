// Team Task Management App Types
// チームタスク管理アプリケーションの型定義

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Member {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  display_name: string;
  avatar_url?: string;
  bio?: string;
  job_title?: string;
  timezone?: string;
  joined_at: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

// 後方互換性のために残す
export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  invited_by?: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'completed';
  due_date?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'canceled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  completed_at?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ActivityLog {
  id: string;
  team_id: string;
  project_id?: string;
  task_id?: string;
  user_id: string;
  action: string;
  entity_type: 'team' | 'project' | 'task' | 'comment' | 'attachment';
  entity_id: string;
  details?: Record<string, any>;
  created_at: string;
}

// ユーザー情報（Vibebaseのusersテーブルと連携）
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// 拡張型（関連データを含む）
export interface TeamWithMembers extends Team {
  members: (TeamMember & { user: User })[];
}

export interface ProjectWithTasks extends Project {
  tasks: Task[];
  team: Team;
}

export interface TaskWithDetails extends Task {
  project: Project;
  assigned_user?: User;
  created_user: User;
  comments: (TaskComment & { user: User })[];
  attachments: TaskAttachment[];
}

// フィルター型
export interface TaskFilter {
  project_id?: string;
  status?: Task['status'] | Task['status'][];
  priority?: Task['priority'] | Task['priority'][];
  assigned_to?: string;
  created_by?: string;
  due_date_from?: string;
  due_date_to?: string;
}

export interface ProjectFilter {
  team_id?: string;
  status?: Project['status'] | Project['status'][];
  created_by?: string;
}

// 統計情報型
export interface TaskStatistics {
  total: number;
  by_status: Record<Task['status'], number>;
  by_priority: Record<Task['priority'], number>;
  overdue: number;
  completed_this_week: number;
}

export interface ProjectStatistics {
  total: number;
  active: number;
  completed: number;
  average_completion_time: number;
  tasks_statistics: TaskStatistics;
}