// User types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'employee';
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  company_name: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  language: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Agent types
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  system_prompt: string | null;
  temperature: number;
  model: string;
  status: 'active' | 'paused' | 'archived';
  memory: Record<string, unknown>;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

// Workflow types
export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  prompt: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  node_type: string;
  name: string | null;
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  created_at: string;
  updated_at: string;
}

// Execution types
export interface Execution {
  id: string;
  workflow_id: string;
  user_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  schedule_id?: string | null;
}

// Schedule types
export interface Schedule {
  id: string;
  workflow_id: string;
  user_id: string;
  name: string;
  interval_type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  cron_expression: string | null;
  status: 'active' | 'paused' | 'disabled';
  last_run: string | null;
  next_run: string | null;
  created_at: string;
  updated_at: string;
}



// Log types
export interface Log {
  id: string;
  execution_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}



// Settings types
export interface Settings {
  id: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  email_notifications: boolean;
  api_keys: Record<string, string>;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// File types
export interface FileItem {
  id: string;
  user_id: string;
  name: string;
  original_name: string;
  mime_type: string | null;
  size: number | null;
  storage_path: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

// API Key types
export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  last_used: string | null;
  expires_at: string | null;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  totalWorkflows: number;
  runningExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  savedTemplates: number;
  totalAgents: number;
  successRate: number;
  todayExecutions: number;
}

// Analytics types
export interface AnalyticsData {
  dailyUsage: { date: string; count: number }[];
  agentUsage: { name: string; count: number }[];
  successRate: { name: string; value: number }[];
  executionTime: { date: string; avg_time: number }[];
  taskCompletion: { status: string; count: number }[];
  topAgents: { name: string; executions: number }[];
  topWorkflows: { name: string; executions: number }[];
}
