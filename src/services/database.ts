import { supabase } from '@/lib/supabase';
import type {
  User, Agent, Workflow, WorkflowStep, Execution, Schedule,
  Log, Notification, FileItem, Settings, Profile
} from '@/types';

// Schema
export async function getDatabaseSchema(): Promise<any> {
  const { data, error } = await supabase.rpc('get_database_schema');
  if (error) throw error;
  return data;
}

// Agents
export async function getAgents(userId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAgent(id: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createAgent(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .insert(agent)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Workflows
export async function getWorkflows(userId: string): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow> {
  const { data, error } = await supabase
    .from('workflows')
    .insert(workflow)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
  const { data, error } = await supabase
    .from('workflows')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getWorkflowTemplates(): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('is_template', true);

  if (error) throw error;
  return data || [];
}

// Workflow Steps
export async function getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createWorkflowStep(step: Omit<WorkflowStep, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowStep> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .insert(step)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkflowStep(id: string, updates: Partial<WorkflowStep>): Promise<WorkflowStep> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Executions
export async function getExecutions(userId: string, limit = 50): Promise<Execution[]> {
  const { data, error } = await supabase
    .from('executions')
    .select('*, workflows(name, variables)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getExecution(id: string): Promise<Execution | null> {
  const { data, error } = await supabase
    .from('executions')
    .select('*, workflows(name, nodes, edges)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createExecution(execution: Omit<Execution, 'id' | 'created_at'>): Promise<Execution> {
  const { data, error } = await supabase
    .from('executions')
    .insert(execution)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExecution(id: string, updates: Partial<Execution>): Promise<Execution> {
  const { data, error } = await supabase
    .from('executions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExecution(id: string): Promise<void> {
  console.log(`[deleteExecution] Attempting to delete execution with id: ${id}`);
  
  const { data, error } = await supabase
    .from('executions')
    .delete()
    .eq('id', id)
    .select();

  console.log(`[deleteExecution] Returned data:`, data);
  console.log(`[deleteExecution] Returned error:`, error);
  console.log(`[deleteExecution] Affected rows:`, data?.length || 0);

  if (error) {
    console.error('Supabase delete error:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    throw new Error('Execution not found or permission denied (RLS).');
  }

  // Verify deletion by querying again
  const { data: checkData, error: checkError } = await supabase
    .from('executions')
    .select('id')
    .eq('id', id);
    
  if (checkError) {
    console.error('[deleteExecution] Verification query error:', checkError);
  } else if (checkData && checkData.length > 0) {
    console.error('[deleteExecution] CRITICAL: Row still exists in Supabase despite successful delete response!', checkData);
    throw new Error(`Row still exists in database: ${JSON.stringify(checkData)}`);
  } else {
    console.log(`[deleteExecution] Verified: row ${id} is no longer in database.`);
  }
}

export async function deleteExecutions(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  console.log(`[deleteExecutions] Attempting to delete executions with ids:`, ids);
  
  const { data, error } = await supabase
    .from('executions')
    .delete()
    .in('id', ids)
    .select();

  console.log(`[deleteExecutions] Returned data:`, data);
  console.log(`[deleteExecutions] Returned error:`, error);
  console.log(`[deleteExecutions] Affected rows:`, data?.length || 0);

  if (error) {
    console.error('Supabase bulk delete error:', error);
    throw error;
  }
  
  if (!data || data.length !== ids.length) {
    console.warn(`Attempted to delete ${ids.length} executions, but only ${data?.length || 0} were deleted.`);
    if (!data || data.length === 0) {
      throw new Error('No executions were deleted. Permission denied (RLS) or not found.');
    }
  }

  // Verify deletion by querying again
  const { data: checkData, error: checkError } = await supabase
    .from('executions')
    .select('id')
    .in('id', ids);
    
  if (checkError) {
    console.error('[deleteExecutions] Verification query error:', checkError);
  } else if (checkData && checkData.length > 0) {
    console.error('[deleteExecutions] CRITICAL: Rows still exist in Supabase despite successful delete response!', checkData);
    throw new Error(`Rows still exist in database: ${JSON.stringify(checkData)}`);
  } else {
    console.log(`[deleteExecutions] Verified: rows are no longer in database.`);
  }
}

// Schedules
export async function getSchedules(userId: string, filters?: { status?: string }): Promise<Schedule[]> {
  let query = supabase
    .from('schedules')
    .select('*, workflows(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSchedule(id: string): Promise<Schedule | null> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Logs
export async function getLogs(executionId: string): Promise<Log[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('execution_id', executionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLog(log: Omit<Log, 'id' | 'created_at'>): Promise<Log> {
  const { data, error } = await supabase
    .from('logs')
    .insert(log)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Notifications
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;
}



// Files
export async function getFiles(userId: string): Promise<FileItem[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createFile(file: Omit<FileItem, 'id' | 'created_at'>): Promise<FileItem> {
  const { data, error } = await supabase
    .from('files')
    .insert(file)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFile(id: string): Promise<void> {
  const { data: file } = await supabase
    .from('files')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (file?.storage_path) {
    await supabase.storage.from('files').remove([file.storage_path]);
  }

  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function uploadFile(userId: string, file: globalThis.File): Promise<FileItem> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('files')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const fileRecord = await createFile({
    user_id: userId,
    name: fileName,
    original_name: file.name,
    mime_type: file.type,
    size: file.size,
    storage_path: fileName,
    entity_type: null,
    entity_id: null
  });

  return fileRecord;
}

// Settings
export async function getSettings(userId: string): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSettings(userId: string, updates: Partial<Settings>): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Profile
export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Dashboard Stats
export async function getDashboardStats(userId: string) {
  const [
    workflowsRes,
    executionsRes,
    agentsRes,
    templatesRes,
    todayExecutionsRes
  ] = await Promise.all([
    supabase.from('workflows').select('id').eq('user_id', userId),
    supabase.from('executions').select('status').eq('user_id', userId),
    supabase.from('agents').select('id').eq('user_id', userId),
    supabase.from('workflows').select('id').eq('user_id', userId).eq('is_template', true),
    supabase.from('executions').select('id').eq('user_id', userId).gte('created_at', new Date().toISOString().split('T')[0])
  ]);

  const executions = executionsRes.data || [];
  const running = executions.filter(e => e.status === 'running').length;
  const completed = executions.filter(e => e.status === 'completed').length;
  const failed = executions.filter(e => e.status === 'failed').length;
  const total = executions.length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    totalWorkflows: workflowsRes.data?.length || 0,
    runningExecutions: running,
    completedExecutions: completed,
    failedExecutions: failed,
    savedTemplates: templatesRes.data?.length || 0,
    totalAgents: agentsRes.data?.length || 0,
    successRate,
    todayExecutions: todayExecutionsRes.data?.length || 0
  };
}

// Analytics
export async function getAnalytics(userId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const [executionsRes, agentsRes, workflowsRes, timedExecutionsRes] = await Promise.all([
    supabase.from('executions')
      .select('created_at, status, workflow_id')
      .eq('user_id', userId)
      .gte('created_at', startDateStr),
    supabase.from('agents')
      .select('id, name')
      .eq('user_id', userId),
    supabase.from('workflows')
      .select('id, name')
      .eq('user_id', userId),
    supabase.from('executions')
      .select('created_at, started_at, completed_at, workflow_id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null)
      .gte('created_at', startDateStr)
  ]);

  const executions = executionsRes.data || [];
  const agents = agentsRes.data || [];
  const workflows = workflowsRes.data || [];
  const timedExecutions = timedExecutionsRes.data || [];

  // Daily usage — count real executions per day
  const dailyUsage: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = executions.filter(e => e.created_at.startsWith(dateStr)).length;
    dailyUsage.push({ date: dateStr, count });
  }

  // Agent usage — count executions per agent (via workflow->agent join not available, approximate by agent count vs total)
  const agentUsage = agents.map(agent => ({
    name: agent.name,
    count: executions.length > 0 ? Math.ceil(executions.length / Math.max(agents.length, 1)) : 0
  }));

  // Success rate from real data
  const completed = executions.filter(e => e.status === 'completed').length;
  const failed = executions.filter(e => e.status === 'failed').length;
  const successRate = [
    { name: 'Completed', value: completed },
    { name: 'Failed', value: failed }
  ];

  // Task completion from real execution statuses
  const taskCompletion = [
    { status: 'Pending', count: executions.filter(e => e.status === 'queued').length },
    { status: 'Running', count: executions.filter(e => e.status === 'running').length },
    { status: 'Completed', count: completed },
    { status: 'Failed', count: failed }
  ];

  // Top workflows — count executions per workflow_id from real data
  const workflowExecutionCounts: Record<string, number> = {};
  executions.forEach(e => {
    if (e.workflow_id) {
      workflowExecutionCounts[e.workflow_id] = (workflowExecutionCounts[e.workflow_id] || 0) + 1;
    }
  });
  const topWorkflows = workflows
    .map(wf => ({ name: wf.name, executions: workflowExecutionCounts[wf.id] || 0 }))
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 5);

  // Top agents — approximate since executions don't store agent_id directly
  const topAgents = agents
    .map(agent => ({ name: agent.name, executions: workflowExecutionCounts[agent.id] || 0 }))
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 5);

  // Execution time — compute real average per day from completed executions
  const executionTime = dailyUsage.map(d => {
    const dayExecs = timedExecutions.filter(e => e.created_at.startsWith(d.date));
    let avgTime = 0;
    if (dayExecs.length > 0) {
      const total = dayExecs.reduce((sum, e) => {
        const start = new Date(e.started_at!).getTime();
        const end = new Date(e.completed_at!).getTime();
        return sum + (end - start);
      }, 0);
      avgTime = total / dayExecs.length;
    }
    return { date: d.date, avg_time: avgTime };
  });

  return {
    dailyUsage,
    agentUsage,
    successRate,
    taskCompletion,
    topAgents,
    topWorkflows,
    executionTime
  };
}

// Admin functions
export async function getAllUsers(page = 1, limit = 20) {
  const { data, error, count } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  return { users: data || [], total: count || 0 };
}

export async function updateUserStatus(userId: string, status: 'active' | 'suspended' | 'inactive') {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId);

  if (error) throw error;
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
}

export async function updateUserRole(userId: string, role: 'admin' | 'manager' | 'employee') {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);

  if (error) throw error;
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// Search
export async function globalSearch(userId: string, query: string) {
  const searchTerm = `%${query}%`;

  const [workflows, tasks, agents, reports, files] = await Promise.all([
    supabase.from('workflows').select('id, name').eq('user_id', userId).ilike('name', searchTerm).limit(5),
    supabase.from('tasks').select('id, title').or(`assigned_to.eq.${userId},user_id.eq.${userId}`).ilike('title', searchTerm).limit(5),
    supabase.from('agents').select('id, name').eq('user_id', userId).ilike('name', searchTerm).limit(5),
    supabase.from('reports').select('id, title').eq('user_id', userId).ilike('title', searchTerm).limit(5),
    supabase.from('files').select('id, name').eq('user_id', userId).ilike('name', searchTerm).limit(5)
  ]);

  return {
    workflows: workflows.data || [],
    tasks: tasks.data || [],
    agents: agents.data || [],
    reports: reports.data || [],
    files: files.data || []
  };
}
