import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowStep, Execution } from '@/types';
import {
  createExecution,
  updateExecution,
  createWorkflowStep,
  updateWorkflowStep,
  getWorkflowSteps,
  createLog
} from './database';
import { chatWithAI } from './api';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  variables: Record<string, unknown>;
  onProgress?: (progress: number, status: string) => void;
  onLog?: (level: string, message: string) => void;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startExecution(
  userId: string,
  workflow: Workflow
): Promise<Execution> {
  // Create execution record in Supabase
  const execution = await createExecution({
    workflow_id: workflow.id,
    user_id: userId,
    status: 'queued',
    progress: 0,
    result: null,
    error_message: null,
    started_at: null,
    completed_at: null
  });

  // Sync workflow_steps rows from the current node list
  await syncWorkflowSteps(workflow);

  // Run the workflow asynchronously (fire-and-forget)
  executeWorkflow({
    workflowId: workflow.id,
    executionId: execution.id,
    userId,
    variables: workflow.variables || {}
  }).catch(console.error);

  return execution;
}

export async function cancelExecution(executionId: string): Promise<void> {
  await updateExecution(executionId, {
    status: 'cancelled',
    completed_at: new Date().toISOString()
  });
}

export async function retryExecution(
  userId: string,
  workflow: Workflow
): Promise<Execution> {
  return startExecution(userId, workflow);
}

// ─── Step Sync ────────────────────────────────────────────────────────────────

/**
 * Ensures workflow_steps rows are in sync with the current node list.
 * Deletes stale rows and creates any missing ones.
 */
async function syncWorkflowSteps(workflow: Workflow): Promise<void> {
  if (!workflow.nodes || workflow.nodes.length === 0) return;

  const existing = await getWorkflowSteps(workflow.id);
  const existingIds = new Set(existing.map(s => s.id));

  // Determine topological order using edges
  const ordered = topologicalSort(workflow.nodes, workflow.edges || []);

  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i];
    if (!existingIds.has(node.id)) {
      await createWorkflowStep({
        workflow_id: workflow.id,
        step_order: i,
        node_type: resolveNodeType(node),
        name: (node.data?.label as string) || `Step ${i + 1}`,
        config: (node.data?.config as Record<string, unknown>) || node.data || {},
        status: 'pending'
      });
    }
  }
}

// ─── Core Execution ───────────────────────────────────────────────────────────

async function executeWorkflow(context: ExecutionContext): Promise<void> {
  const { workflowId, executionId, variables, onProgress, onLog } = context;

  const log = async (level: string, message: string) => {
    await createLog({
      execution_id: executionId,
      level: level as 'debug' | 'info' | 'warn' | 'error',
      message,
      metadata: {}
    });
    onLog?.(level, message);
  };

  try {
    await updateExecution(executionId, {
      status: 'running',
      started_at: new Date().toISOString()
    });

    await log('info', `Execution started for workflow ${workflowId}`);

    // Fetch the workflow to get nodes + edges for topological sort
    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (wfError || !workflow) {
      throw new Error('Workflow not found');
    }

    const nodes: WorkflowNode[] = (workflow.nodes as WorkflowNode[]) || [];
    const edges: WorkflowEdge[] = (workflow.edges as WorkflowEdge[]) || [];

    if (nodes.length === 0) {
      await log('warn', 'Workflow has no nodes');
      await updateExecution(executionId, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        result: { message: 'Workflow has no nodes' }
      });
      return;
    }

    // Sort nodes in execution order
    const orderedNodes = topologicalSort(nodes, edges);
    await log('info', `Execution order: ${orderedNodes.map(n => n.data?.label || n.id).join(' → ')}`);

    // Shared context variables — each node writes its output here
    const ctx: Record<string, unknown> = { ...variables };

    const skippedNodeIds = new Set<string>();
    const branchDecisions = new Map<string, string>(); // nodeId -> branch/selected
    const loopHandledNodes = new Set<string>();

    // Execute each node in topological order
    for (let i = 0; i < orderedNodes.length; i++) {
      const node = orderedNodes[i];
      const progress = Math.round(((i + 1) / orderedNodes.length) * 100);
      const nodeType = resolveNodeType(node);
      const nodeName = (node.data?.label as string) || nodeType;
      const nodeConfig = buildNodeConfig(node, edges, ctx);

      // Find or create the step record
      const steps = await getWorkflowSteps(workflowId);
      let step = steps.find(s => s.id === node.id);
      if (!step) {
        step = await createWorkflowStep({
          workflow_id: workflowId,
          step_order: i,
          node_type: nodeType,
          name: nodeName,
          config: nodeConfig,
          status: 'pending'
        });
      }

      // Check if node is part of a loop body handled by executeLoop
      if (loopHandledNodes.has(node.id)) {
        await log('info', `[${i + 1}/${orderedNodes.length}] Skipping node: ${nodeName} (handled by loop)`);
        await updateWorkflowStep(step.id, { status: 'skipped' });
        skippedNodeIds.add(node.id);
        continue;
      }

      // Check if node should be skipped due to conditional branching
      const incomingEdges = edges.filter(e => e.target === node.id);
      if (incomingEdges.length > 0) {
        const isActive = incomingEdges.some(e => {
          // Edge is inactive if its source was skipped
          if (skippedNodeIds.has(e.source)) return false;
          // If source was a decision/condition, check the branch
          if (branchDecisions.has(e.source)) {
            const takenBranch = branchDecisions.get(e.source);
            // If the edge specifies a branch and it doesn't match the taken one, it's inactive
            // (Note: some edges might have sourceHandle === null/undefined, meaning they are unconditional)
            if (e.sourceHandle && e.sourceHandle !== takenBranch) return false;
          }
          return true; // Edge is active
        });

        if (!isActive) {
          await log('info', `[${i + 1}/${orderedNodes.length}] Skipping node: ${nodeName} (branch not taken)`);
          await updateWorkflowStep(step.id, { status: 'skipped' });
          skippedNodeIds.add(node.id);
          continue;
        }
      }

      await log('info', `[${i + 1}/${orderedNodes.length}] Running node: ${nodeName} (${nodeType})`);

      await updateWorkflowStep(step.id, { status: 'running' });

      try {
        let result: any;
        let retries = 0;
        const maxRetries = ['api_call', 'api', 'webhook', 'email'].includes(nodeType) ? 2 : 0;

        while (true) {
          try {
            result = await executeNode(nodeType, nodeConfig, ctx, log, node, nodes, edges);
            break;
          } catch (nodeError) {
            if (retries < maxRetries) {
              retries++;
              const delayMs = retries === 1 ? 1000 : 2000;
              await log('warn', `Node "${nodeName}" failed. Retrying (${retries}/${maxRetries}) in ${delayMs}ms...`);
              await new Promise(r => setTimeout(r, delayMs));
              continue;
            }
            throw nodeError;
          }
        }

        // Handle loop explicitly handled nodes
        if (nodeType === 'loop' && result && typeof result === 'object' && 'handledNodes' in result) {
          (result.handledNodes as string[]).forEach(id => loopHandledNodes.add(id));
        }

        // Track branch decisions
        if (nodeType === 'condition' && result && typeof result === 'object' && 'branch' in result) {
          branchDecisions.set(node.id, (result as any).branch);
        } else if (nodeType === 'decision' && result && typeof result === 'object' && 'selected' in result) {
          branchDecisions.set(node.id, (result as any).selected);
        }

        // Store output in shared context under node id and label
        const normalizedName = nodeName.toLowerCase().replace(/\s+/g, '_');
        ctx[`node_${node.id}`] = result;
        ctx[`${normalizedName}_output`] = result; // legacy
        ctx[normalizedName] = result;             // exact name mapping (e.g. analyze_weather)

        await updateWorkflowStep(step.id, { status: 'completed' });
        await updateExecution(executionId, { progress });
        onProgress?.(progress, `${nodeName} completed`);
        await log('info', `✓ ${nodeName} completed`);

      } catch (nodeError) {
        const msg = nodeError instanceof Error ? nodeError.message : String(nodeError);
        await log('error', `✗ ${nodeName} failed: ${msg}`);
        await updateWorkflowStep(step.id, { status: 'failed' });
        await updateExecution(executionId, {
          status: 'failed',
          error_message: `Node "${nodeName}" failed: ${msg}`,
          completed_at: new Date().toISOString()
        });
        return;
      }
    }

    // All nodes succeeded
    await updateExecution(executionId, {
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
      result: { variables: ctx }
    });

    await log('info', 'Workflow execution completed successfully');
    onProgress?.(100, 'Completed');

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await log('error', `Workflow failed: ${msg}`);
    await updateExecution(executionId, {
      status: 'failed',
      error_message: msg,
      completed_at: new Date().toISOString()
    }).catch(console.error);
    onProgress?.(0, 'Failed');
  }
}

// ─── Node Dispatcher ──────────────────────────────────────────────────────────

async function executeNode(
  nodeType: string,
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (level: string, message: string) => Promise<void>,
  node?: WorkflowNode,
  nodes?: WorkflowNode[],
  edges?: WorkflowEdge[]
): Promise<unknown> {
  switch (nodeType) {
    case 'ai_prompt':
    case 'ai':
      return executeAIPrompt(config, ctx, log);

    case 'api_call':
    case 'api':
      return executeApiCall(config, ctx, log);

    case 'webhook':
      return executeWebhook(config, ctx, log);

    case 'database':
    case 'db':
      return executeDatabaseNode(config, ctx, log);

    case 'condition':
      return executeCondition(config, ctx, log);

    case 'delay':
      return executeDelay(config, ctx, log);

    case 'loop':
      return executeLoop(config, ctx, log, node, nodes, edges);

    case 'email':
      return executeEmail(config, ctx, log);

    case 'notification':
      return executeNotification(config, ctx, log);

    case 'export':
      return executeExport(config, ctx, log);

    case 'decision':
      return executeDecision(config, ctx, log);

    case 'file_upload':
      return executeFileUpload(config, ctx, log);

    default:
      await log('warn', `Unknown node type: "${nodeType}" — skipping`);
      return { skipped: true, nodeType };
  }
}

// ─── Node Implementations ─────────────────────────────────────────────────────

/** AI Prompt — real Gemini API call */
async function executeAIPrompt(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const prompt = interpolate(String(config.prompt || 'No prompt configured'), ctx);
  const systemPrompt = config.system_prompt ? interpolate(String(config.system_prompt), ctx) : undefined;

  await log('info', `AI Prompt: ${prompt.substring(0, 120)}${prompt.length > 120 ? '...' : ''}`);

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const response = await chatWithAI(fullPrompt);

  await log('info', `AI Response: ${response.substring(0, 120)}${response.length > 120 ? '...' : ''}`);
  return { 
    response, 
    result: response, 
    output: response, 
    text: response, 
    content: response,
    prompt 
  };
}

/** API Call — real fetch() */
async function executeApiCall(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const rawUrl = String(config.url || '');
  if (!rawUrl) throw new Error('API Call node: URL is required');

  const method = String(config.method || 'GET').toUpperCase();
  let url = interpolate(rawUrl, ctx);

  // Append query params
  const queryParams = config.query_params as Record<string, string> | undefined;
  if (queryParams && typeof queryParams === 'object') {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(queryParams)) {
      params.set(key, interpolate(String(val), ctx));
    }
    const qs = params.toString();
    if (qs) url = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
  }

  // Build headers
  const rawHeaders = (config.headers as Record<string, string>) || {};
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const [k, v] of Object.entries(rawHeaders)) {
    headers[k] = interpolate(String(v), ctx);
  }

  // Build body
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD' && config.body) {
    const rawBody = typeof config.body === 'string'
      ? interpolate(config.body, ctx)
      : JSON.stringify(config.body);
    body = rawBody;
  }

  await log('info', `API Call: ${method} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body
    });
  } catch (error: any) {
    // Browser CORS or network error
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Network'))) {
      await log('warn', `API Call failed due to a network or CORS error. In the browser, you cannot call APIs that lack CORS headers. For testing, try a CORS-friendly API like https://dummyjson.com`);
      return { status: 0, statusText: 'CORS/Network Error', error: error.message };
    }
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  let responseData: unknown;
  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    throw new Error(`API returned ${response.status} ${response.statusText}: ${JSON.stringify(responseData).substring(0, 200)}`);
  }

  await log('info', `API responded with status ${response.status}`);

  return {
    status: response.status,
    statusText: response.statusText,
    data: responseData,
    headers: Object.fromEntries(response.headers.entries())
  };
}

/** Webhook — real fetch() POST */
async function executeWebhook(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const url = interpolate(String(config.url || ''), ctx);
  if (!url) throw new Error('Webhook node: URL is required');

  const payload = config.payload
    ? (typeof config.payload === 'string' ? JSON.parse(interpolate(config.payload, ctx)) : config.payload)
    : ctx;

  await log('info', `Webhook POST → ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error: any) {
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Network'))) {
      await log('warn', `Webhook failed due to browser CORS restrictions. Services like webhook.site often block browser requests. For browser testing, try: https://httpbin.org/post`);
      return { status: 0, error: 'CORS/Network Error', hint: 'Use https://httpbin.org/post for testing' };
    }
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${JSON.stringify(data).substring(0, 200)}`);
  }

  await log('info', `Webhook responded with status ${response.status}`);
  return { status: response.status, data };
}

/** Database Node — real Supabase CRUD */
async function executeDatabaseNode(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const operation = String(config.operation || 'select').toLowerCase();
  const table = String(config.table || '');
  if (!table) throw new Error('Database node: table name is required');

  const ALLOWED_TABLES = [
    'users', 'workflows', 'workflow_steps', 'executions', 'logs', 
    'reports', 'weather_reports', 'notifications', 'tasks', 'settings', 
    'api_keys', 'agents', 'files', 'profiles'
  ];

  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Database error: Table "${table}" does not exist in the database. Please use an existing table (e.g., users).`);
  }

  await log('info', `Database ${operation} on table "${table}"`);

  switch (operation) {
    case 'select':
    case 'query': {
      let query = supabase.from(table).select((config.columns as string) || '*');

      // Apply filters
      const filters = config.filters as Record<string, unknown> | undefined;
      if (filters && typeof filters === 'object') {
        for (const [col, val] of Object.entries(filters)) {
          const interpolatedVal = typeof val === 'string' ? interpolate(val, ctx) : val;
          query = query.eq(col, interpolatedVal) as typeof query;
        }
      }

      // Apply limit
      if (config.limit) {
        query = query.limit(Number(config.limit)) as typeof query;
      }

      const { data, error } = await query;
      if (error) throw new Error(`Database select error: ${error.message}`);
      await log('info', `Database select returned ${data?.length ?? 0} rows`);
      return { rows: data, count: data?.length ?? 0 };
    }

    case 'insert': {
      const record = config.record as Record<string, unknown>;
      if (!record) throw new Error('Database insert node: record is required');

      // Interpolate string values in the record
      const interpolated: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(record)) {
        interpolated[k] = typeof v === 'string' ? interpolate(v, ctx) : v;
      }

      // --- RLS Debugging ---
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user?.id || 'none';
      const role = session?.user?.role || 'none';
      await log('info', `DB Insert RLS Debug - table: ${table} | user_id: ${authUser} | role: ${role}`);
      // ---------------------

      const { data, error } = await supabase.from(table).insert(interpolated).select().single();
      if (error) throw new Error(`Database insert error: ${error.message}`);
      await log('info', `Database insert created record with id: ${(data as Record<string, unknown>)?.id ?? 'unknown'}`);
      return { inserted: data };
    }

    case 'update': {
      const updates = config.updates as Record<string, unknown>;
      const filters = config.filters as Record<string, unknown>;
      if (!updates) throw new Error('Database update node: updates are required');

      // Build the update query with filters chained
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(table).update(updates);
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          const interpolatedVal = typeof val === 'string' ? interpolate(val, ctx) : val;
          query = query.eq(col, interpolatedVal);
        }
      }

      const { data, error } = await query.select();
      if (error) throw new Error(`Database update error: ${error.message}`);
      await log('info', `Database update affected ${(data as unknown[])?.length ?? 0} rows`);
      return { updated: data, count: (data as unknown[])?.length ?? 0 };
    }

    case 'delete': {
      const filters = config.filters as Record<string, unknown>;
      if (!filters || Object.keys(filters).length === 0) {
        throw new Error('Database delete node: at least one filter is required for safety');
      }

      let query = supabase.from(table).delete();
      for (const [col, val] of Object.entries(filters)) {
        const interpolatedVal = typeof val === 'string' ? interpolate(val, ctx) : val;
        query = query.eq(col, interpolatedVal) as typeof query;
      }

      const { error, count } = await query;
      if (error) throw new Error(`Database delete error: ${error.message}`);
      await log('info', `Database delete removed ${count ?? 0} rows`);
      return { deleted: true, count: count ?? 0 };
    }

    default:
      throw new Error(`Database node: unsupported operation "${operation}". Use: select, insert, update, delete`);
  }
}

/** Condition — real expression evaluator */
async function executeCondition(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const expression = interpolate(String(config.condition || config.expression || 'true'), ctx);
  const result = evaluateExpression(expression, ctx);

  await log('info', `Condition "${expression}" → ${result}`);

  return {
    condition: expression,
    result,
    branch: result ? 'true' : 'false'
  };
}

/** Delay — real async wait */
async function executeDelay(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const durationMs = Number(config.duration || config.ms || 1000);
  const safeDuration = Math.min(Math.max(durationMs, 0), 300_000); // cap at 5 min

  await log('info', `Delay: waiting ${safeDuration}ms`);
  await new Promise<void>(resolve => setTimeout(resolve, safeDuration));
  await log('info', `Delay: ${safeDuration}ms elapsed`);

  return { waited_ms: safeDuration };
}

/** Loop — iterate and collect results */
async function executeLoop(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>,
  node?: WorkflowNode,
  nodes?: WorkflowNode[],
  edges?: WorkflowEdge[]
): Promise<unknown> {
  const iterations = Number(config.iterations || 1);
  const itemsKey = config.items as string | undefined;
  const items = itemsKey && ctx[itemsKey] ? (ctx[itemsKey] as unknown[]) : null;
  const count = items ? items.length : Math.min(iterations, 100);

  await log('info', `Loop: ${count} iterations`);

  let bodyNodes: WorkflowNode[] = [];
  if (node && nodes && edges) {
    let bodyEdges = edges.filter(e => e.source === node.id && (e.sourceHandle === 'body' || e.sourceHandle === 'item'));
    if (bodyEdges.length === 0) {
      bodyEdges = edges.filter(e => e.source === node.id && e.sourceHandle !== 'next');
    }
    bodyNodes = nodes.filter(n => bodyEdges.some(e => e.target === n.id));
  }

  const results: unknown[] = [];
  for (let i = 0; i < count; i++) {
    const item = items ? items[i] : i;
    ctx['item'] = item;
    ctx['index'] = i;

    let lastResult = null;
    for (const bNode of bodyNodes) {
      const bType = resolveNodeType(bNode);
      const bConfig = buildNodeConfig(bNode, edges || [], ctx);
      
      try {
        await log('info', `Loop body [${i + 1}/${count}]: running ${bNode.data?.label || bType}`);
        lastResult = await executeNode(bType, bConfig, ctx, log, bNode, nodes, edges);
      } catch (err) {
        await log('error', `Loop body node ${bNode.id} failed on index ${i}: ${String(err)}`);
        throw err;
      }
    }

    results.push({ index: i, item, completed: true, result: lastResult });
  }

  return { results, iterations: count, handledNodes: bodyNodes.map(n => n.id) };
}

/** Email — sends via Supabase Edge Function "resend-email" */
async function executeEmail(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const to = interpolate(String(config.to || ''), ctx);
  const subject = interpolate(String(config.subject || ''), ctx);
  const body = interpolate(String(config.body || ''), ctx);

  if (!to) throw new Error('Email node: "to" address is required');
  if (!subject) throw new Error('Email node: "subject" is required');

  await log('info', `Sending email → ${to} | Subject: ${subject}`);

  try {
    const { data, error } = await supabase.functions.invoke('resend-email', {
      body: { to, subject, html: body }
    });

    if (error) {
      const errMsg = typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : String(error);
      await log('error', `Email delivery failed: ${errMsg}`);
      throw new Error(`Email delivery failed: ${errMsg}`);
    }

    await log('info', `✓ Email sent successfully to ${to}`);

    return {
      sent: true,
      to,
      subject,
      response: data
    };
  } catch (err: unknown) {
    // Re-throw if it's our own Error from above
    if (err instanceof Error && err.message.startsWith('Email delivery failed:')) {
      throw err;
    }

    // Network / unexpected error
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `Email node network error: ${msg}`);
    throw new Error(`Email node failed (network): ${msg}`);
  }
}

/** Notification — creates a real Supabase notification row */
async function executeNotification(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const message = interpolate(String(config.message || ''), ctx);
  const title = interpolate(String(config.title || 'Workflow Notification'), ctx);
  const userId = ctx['user_id'] as string | undefined;

  await log('info', `Notification: "${title}"`);

  if (userId) {
    const { data, error } = await supabase.from('notifications').insert({
      user_id: userId,
      type: 'workflow',
      title,
      message,
      data: {},
      read: false
    }).select().single();

    if (error) {
      await log('warn', `Failed to create notification: ${error.message}`);
    } else {
      await log('info', `Notification created (id: ${(data as Record<string, unknown>)?.id})`);
      return { created: true, id: (data as Record<string, unknown>)?.id, title, message };
    }
  }

  return { created: false, title, message, note: 'user_id not in context' };
}

/** Export — serialize context data */
async function executeExport(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const format = String(config.format || 'json').toLowerCase();
  const dataKey = config.data_key as string | undefined;
  const sourceData = dataKey && ctx[dataKey] ? ctx[dataKey] : ctx;

  await log('info', `Export: formatting as ${format}`);

  let output: string;
  switch (format) {
    case 'csv': {
      const rows = Array.isArray(sourceData) ? sourceData : [sourceData];
      const headers = Object.keys(rows[0] as Record<string, unknown> || {});
      const csvLines = [
        headers.join(','),
        ...rows.map(row =>
          headers.map(h => {
            const val = (row as Record<string, unknown>)[h];
            const str = val === null || val === undefined ? '' : String(val);
            return str.includes(',') ? `"${str}"` : str;
          }).join(',')
        )
      ];
      output = csvLines.join('\n');
      break;
    }
    case 'json':
    default:
      output = JSON.stringify(sourceData, null, 2);
  }

  await log('info', `Export complete (${output.length} bytes)`);
  return { format, data: output, size: output.length };
}

/** Decision — pick branch based on data */
async function executeDecision(
  config: Record<string, unknown>,
  ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  const condition = interpolate(String(config.condition || 'true'), ctx);
  const result = evaluateExpression(condition, ctx);
  const selected = result
    ? String(config.true_label || 'true_branch')
    : String(config.false_label || 'false_branch');

  await log('info', `Decision: "${condition}" → ${selected}`);
  return { condition, result, selected };
}

/** File Upload — acknowledge (browser File objects cannot be passed via workflow config) */
async function executeFileUpload(
  config: Record<string, unknown>,
  _ctx: Record<string, unknown>,
  log: (l: string, m: string) => Promise<void>
): Promise<unknown> {
  await log('info', `File upload node (filename: ${config.filename || 'unknown'})`);
  return { acknowledged: true, filename: config.filename || 'unknown' };
}

// ─── Topological Sort (Kahn's Algorithm) ─────────────────────────────────────

/**
 * Returns nodes in a valid execution order respecting edge dependencies.
 * Nodes with no incoming edges execute first.
 * If there are cycles or disconnected nodes, they are appended after the sorted set.
 */
function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));
  const adjacency = new Map<string, string[]>(nodes.map(n => [n.id, []]));

  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      adjacency.get(edge.source)!.push(edge.target);
    }
  }

  // Start with all nodes that have no incoming edges
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id);
  }

  const sorted: WorkflowNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const neighbor of adjacency.get(id) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Append any unvisited nodes (disconnected or cycle participants)
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      sorted.push(node);
    }
  }

  return sorted;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the semantic node type from a node's data.
 * The ReactFlow `node.type` is always "custom" — the real type lives in `node.data`.
 */
function resolveNodeType(node: WorkflowNode): string {
  // Try data.node_type first, then data.type, then fall back to node.type
  return (
    (node.data?.node_type as string) ||
    (node.data?.type as string) ||
    node.type ||
    'unknown'
  );
}

/**
 * Builds the effective config for a node by merging node.data.config
 * with top-level node.data fields, minus UI-only fields.
 */
function buildNodeConfig(
  node: WorkflowNode,
  _edges: WorkflowEdge[],
  _ctx: Record<string, unknown>
): Record<string, unknown> {
  const dataConfig = (node.data?.config as Record<string, unknown>) || {};
  const { label: _label, icon: _icon, color: _color, config: _cfg, ...rest } = node.data || {};
  return { ...rest, ...dataConfig };
}

/**
 * Replaces `${variable}` and `${nested.key}` placeholders in a template string
 * with values from the context.
 */
function interpolate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_match, key) => {
    const value = key.split('.').reduce((obj: unknown, k: string) => {
      if (obj !== null && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[k];
      }
      return undefined;
    }, ctx as unknown);
    return value !== undefined && value !== null ? String(value) : _match;
  });
}

/**
 * Evaluates a simple condition expression against the context.
 *
 * Supported forms:
 *   "true" / "false"
 *   "${var} == value"
 *   "${var} != value"
 *   "${var} > value"
 *   "${var} < value"
 *   "${var} >= value"
 *   "${var} <= value"
 *   "${var} contains substring"
 *   "has_varName"   (truthy check)
 *   any variable name (truthy check)
 */
function evaluateExpression(expression: string, ctx: Record<string, unknown>): boolean {
  const trimmed = expression.trim();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Interpolate first
  const resolved = interpolate(trimmed, ctx);

  // "has_varName" shorthand
  if (resolved.startsWith('has_')) {
    const key = resolved.substring(4);
    return !!ctx[key];
  }

  // Comparison operators
  const operators = ['>=', '<=', '!=', '==', '>', '<', 'contains'];
  for (const op of operators) {
    if (resolved.includes(` ${op} `)) {
      const [left, right] = resolved.split(` ${op} `, 2).map(s => s.trim());
      const leftVal = ctx[left] !== undefined ? ctx[left] : left;
      const rightVal = right;

      switch (op) {
        case '==':  return String(leftVal) === rightVal;
        case '!=':  return String(leftVal) !== rightVal;
        case '>':   return Number(leftVal) > Number(rightVal);
        case '<':   return Number(leftVal) < Number(rightVal);
        case '>=':  return Number(leftVal) >= Number(rightVal);
        case '<=':  return Number(leftVal) <= Number(rightVal);
        case 'contains': return String(leftVal).includes(rightVal);
      }
    }
  }

  // Truthy check — if the expression resolves to a known context variable
  if (ctx[resolved] !== undefined) {
    return !!ctx[resolved];
  }

  // If the resolved string itself is a non-empty, non-"false" value
  return resolved !== '' && resolved !== 'false' && resolved !== '0';
}
