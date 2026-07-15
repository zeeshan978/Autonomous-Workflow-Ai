import { supabase } from '@/lib/supabase';

// We no longer instantiate GoogleGenerativeAI on the client.
// All requests are sent to the Supabase Edge Function `gemini-api`.

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface GeneratedWorkflow {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
}

const WORKFLOW_SYSTEM_PROMPT = `You are an AI workflow generator for an automation platform (similar to Zapier/Make). Given a user prompt, generate a fully configured, executable workflow.

Available node types and their EXACT config fields (use these field names precisely — the executor will not recognize any others):

- ai_prompt: { prompt: string, system_prompt?: string }
- condition: { condition: string }  // e.g. "\${node_name.count} > 0"
- delay: { duration: number }  // milliseconds
- database: { operation: "select"|"insert"|"update"|"delete", table: string, columns?: string, filters?: object, record?: object, updates?: object, limit?: number }
  - select/query: use "filters" (object of column:value pairs), NOT raw SQL
  - insert: use "record" (object of column:value pairs)
  - update: use "updates" (object of column:value pairs) + "filters"
  - delete: requires "filters" (at least one, for safety)
- email: { to: string, subject: string, body: string }
- api_call: { url: string, method: string, headers?: object, query_params?: object, body?: string|object }
- webhook: { url: string, payload?: object }
- loop: { items: string }  // MUST reference a prior node's array output, e.g. "\${fetch_users.rows}" — NOT "iterate", and NOT a bare iteration count when real data exists
- decision: { condition: string, true_label?: string, false_label?: string }
- file_upload: { filename: string }
- notification: { title: string, message: string }
- export: { format: "json"|"csv", data_key?: string }

Available Database Tables (ONLY these exist — do not invent others):
users, profiles, agents, workflows, workflow_steps, executions, tasks, logs, notifications, reports, settings, files, api_keys, audit_logs, schedules

IMPORTANT RULES:
1. FULLY CONFIGURE nodes using the EXACT field names above. Do not use "action", "query" (as raw SQL), "iterate", or any other field name not listed.
2. AUTO VARIABLE MAPPING: A database node's output is available as \${node_label_lowercase_with_underscores.rows} (array) and \${node_label_lowercase_with_underscores.count}. Inside a loop, the current item is \${item} and its fields as \${item.column_name}. Ensure variables flow logically and only reference outputs that actually exist earlier in the graph.
3. EDGES: Connect nodes explicitly. Use sourceHandle "true"/"false" for conditions, and "body" for loops (with a second edge using sourceHandle "next" for what runs after the loop finishes).
4. AUTO LAYOUT: Provide { x, y } positions for nodes. Align them vertically (y + 150) or horizontally (x + 300).
5. If the request requires a table, integration, or credential that is not in the list above or not confirmed available, do NOT invent it — instead set node config field "needs_configuration": true and describe what's missing in a "configuration_note" field on that node.

Respond ONLY with a JSON object containing:
{
  "name": "Workflow name",
  "description": "Workflow description",
  "nodes": [
    {
      "id": "node_1",
      "type": "database",
      "name": "Fetch inactive users",
      "config": { "operation": "select", "table": "users", "filters": { "status": "inactive" } },
      "position": { "x": 100, "y": 100 }
    }
  ],
  "edges": [
    { "id": "e1", "source": "node_1", "target": "node_2" }
  ],
  "variables": {}
}`;

export async function generateWorkflowFromPrompt(userPrompt: string): Promise<GeneratedWorkflow> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'generateWorkflow',
        payload: { systemPrompt: WORKFLOW_SYSTEM_PROMPT, userPrompt }
      }
    });

    if (error) throw error;
    
    if (data && data.simulated) {
      return simulateWorkflowGeneration(userPrompt);
    }

    if (data && data.text) {
      const jsonMatch = data.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as GeneratedWorkflow;
      }
    }

    return simulateWorkflowGeneration(userPrompt);
  } catch (error) {
    console.error('Gemini API error:', error);
    return simulateWorkflowGeneration(userPrompt);
  }
}

function simulateWorkflowGeneration(userPrompt: string): GeneratedWorkflow {
  const lowerPrompt = userPrompt.toLowerCase();

  let name = 'Custom Workflow';
  let description = 'Generated workflow based on user request';
  let nodes: WorkflowNode[] = [];
  let edges: WorkflowEdge[] = [];

  // Template: Email Marketing / Inactive users
  if (lowerPrompt.includes('email') || lowerPrompt.includes('inactive') || lowerPrompt.includes('marketing')) {
    name = 'Re-engagement Email Campaign';
    description = 'Send personalized emails to inactive users';
    nodes = [
      { id: 'n1', type: 'database', name: 'Fetch Inactive Users', config: { action: 'select', table: 'users', query: "SELECT * FROM users WHERE status = 'inactive'" }, position: { x: 100, y: 100 } },
      { id: 'n2', type: 'loop', name: 'Loop Users', config: { iterate: '${n1.rows}' }, position: { x: 100, y: 250 } },
      { id: 'n3', type: 'ai_prompt', name: 'Write Email', config: { prompt: 'Write a personalized re-engagement email for ${user.full_name}' }, position: { x: 100, y: 400 } },
      { id: 'n4', type: 'email', name: 'Send Email', config: { to: '${user.email}', subject: 'We miss you, ${user.full_name}!', body: '${n3.result}' }, position: { x: 100, y: 550 } },
      { id: 'n5', type: 'database', name: 'Log Campaign', config: { action: 'insert', table: 'logs', data: { message: 'Sent email to ${user.email}' } }, position: { x: 100, y: 700 } },
      { id: 'n6', type: 'notification', name: 'Notify Admin', config: { message: 'Campaign completed successfully' }, position: { x: 100, y: 850 } }
    ];
    edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'body' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n2', target: 'n6', sourceHandle: 'next' } // After loop completes
    ];
  } 
  // Template: Customer Support
  else if (lowerPrompt.includes('support') || lowerPrompt.includes('ticket')) {
    name = 'Support Ticket Triage';
    description = 'Auto-classify and route support tickets';
    nodes = [
      { id: 'n1', type: 'webhook', name: 'Receive Ticket', config: { url: '/api/webhooks/support' }, position: { x: 100, y: 100 } },
      { id: 'n2', type: 'ai_prompt', name: 'Analyze Intent', config: { prompt: 'Determine the urgency and category of this ticket: ${n1.body.message}' }, position: { x: 100, y: 250 } },
      { id: 'n3', type: 'condition', name: 'Is Urgent?', config: { condition: '${n2.result.urgency} == "high"' }, position: { x: 100, y: 400 } },
      { id: 'n4', type: 'notification', name: 'Alert Team', config: { message: 'URGENT TICKET: ${n1.body.message}' }, position: { x: -100, y: 550 } },
      { id: 'n5', type: 'database', name: 'Log Ticket', config: { action: 'insert', table: 'tasks', data: { title: 'Ticket', priority: 'medium' } }, position: { x: 300, y: 550 } }
    ];
    edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false' }
    ];
  }
  // Generic Fallback
  else {
    nodes = [
      { id: 'n1', type: 'ai_prompt', name: 'Analyze Request', config: { prompt: userPrompt }, position: { x: 100, y: 100 } },
      { id: 'n2', type: 'database', name: 'Store Result', config: { table: 'logs', action: 'insert', data: { message: '${n1.result}' } }, position: { x: 100, y: 250 } },
      { id: 'n3', type: 'notification', name: 'Notify User', config: { message: 'Generic workflow executed' }, position: { x: 100, y: 400 } }
    ];
    edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' }
    ];
  }

  return { name, description, nodes, edges, variables: {} };
}

export async function chatWithAI(message: string, context?: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'chat',
        payload: { message, context }
      }
    });

    if (error) throw error;
    
    if (data && data.simulated) {
      return `I understand you want to: "${message}". This is a simulated response. To enable full AI capabilities, please configure the Gemini API key.`;
    }

    return data.text || 'I apologize, but I received an empty response. Please try again.';
  } catch (error) {
    console.error('Chat error:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again.';
  }
}

export async function analyzeData(dataInput: Record<string, unknown>[], prompt: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'analyze',
        payload: { data: dataInput, prompt }
      }
    });

    if (error) throw error;

    if (data && data.simulated) {
      return `Based on ${dataInput.length} data points, this is a simulated analysis. Configure the Gemini API key for real AI analysis.`;
    }

    return data.text || 'Analysis failed to return text. Please try again.';
  } catch (error) {
    console.error('Analysis error:', error);
    return 'Analysis failed. Please try again.';
  }
}

export async function generateSummary(text: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'summarize',
        payload: { text }
      }
    });

    if (error) throw error;

    if (data && data.simulated) {
      return `Summary: ${text.substring(0, 100)}...`;
    }

    return data.text || 'Failed to generate summary.';
  } catch (error) {
    console.error('Summary error:', error);
    return 'Failed to generate summary.';
  }
}

export async function optimizeWorkflow(workflow: GeneratedWorkflow): Promise<GeneratedWorkflow> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-api', {
      body: {
        action: 'optimize',
        payload: { workflow }
      }
    });

    if (error) throw error;

    if (data && data.simulated) {
      return workflow;
    }

    if (data && data.text) {
      const jsonMatch = data.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as GeneratedWorkflow;
      }
    }

    return workflow;
  } catch (error) {
    console.error('Optimization error:', error);
    return workflow;
  }
}
