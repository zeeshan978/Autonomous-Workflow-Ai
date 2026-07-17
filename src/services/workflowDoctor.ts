/**
 * workflowDoctor.ts
 * ─────────────────────────────────────────────────────────────────
 * AI Workflow Doctor — Deterministic Diagnosis Engine
 *
 * Flow:
 *   1. Parse runtime ExecutionIssue from execution.error_message
 *   2. Run static validation (validateWorkflow)
 *   3. Cross-reference execution report.nodes for inputs/outputs
 *   4. Build a structured DiagnosisResult
 *   5. Optionally call Gemini to explain complex failures
 *   6. Always provide a deterministic fallback if AI is unavailable
 * ─────────────────────────────────────────────────────────────────
 */

import type { Execution, WorkflowNode, WorkflowEdge } from '@/types';
import type { ExecutionIssue } from './executionEngine';
import {
  validateWorkflow,
  type ValidationResult,
  type ValidationIssue,
} from './workflowValidation';
import { ALLOWED_TABLES, normalizeNodeLabel, extractNodeIdFromReference } from './executionEngine';
import { supabase } from '@/lib/supabase';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type DiagnosisConfidence = 'high' | 'medium' | 'low';

export interface NodePatch {
  nodeId: string;
  nodeName: string;
  field: string;         // e.g. 'url', 'table', 'prompt', 'message', 'items'
  oldValue: unknown;
  newValue: unknown;     // best-guess corrected value; '' means user must fill in
  description: string;   // Human string: "Set the URL field on the API Call node"
  isSafe: boolean;       // true = can auto-apply; false = show warning
  unsafeReason?: string; // Why it can't be auto-applied
}

export interface DiagnosisResult {
  // Core diagnosis
  problem: string;         // What failed? (1-2 sentences, plain English)
  rootCause: string;       // Why did it fail?
  affectedNodeId: string | null;
  affectedNodeName: string | null;
  affectedNodeType: string | null;

  // Suggested action
  suggestedFix: string;    // What should change?
  confidence: DiagnosisConfidence;
  category: string;        // e.g. "CONFIGURATION ERROR", "RUNTIME ERROR"

  // Auto-patch (may be null for complex issues)
  proposedPatch: NodePatch | null;

  // Source data
  runtimeIssue: ExecutionIssue | null;
  validationIssues: ValidationIssue[];
  reportNodeData: any | null; // the failed node's inputs/outputs from report

  // Whether AI was used for the explanation
  aiEnhanced: boolean;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Diagnose a failed execution.
 *
 * Always returns a DiagnosisResult, even if AI is unavailable.
 * Never invents node IDs, table names, column names, or credentials.
 */
export async function diagnoseExecution(
  execution: Execution,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  useAI = true
): Promise<DiagnosisResult> {
  // ── Step 1: Parse runtime ExecutionIssue ──────────────────────────────────
  const runtimeIssue = parseRuntimeIssue(execution.error_message);

  // ── Step 2: Static validation ─────────────────────────────────────────────
  const validationResult: ValidationResult = validateWorkflow(nodes, edges);
  const validationIssues = [...validationResult.errors, ...validationResult.warnings];

  // ── Step 3: Locate the failed node and its report data ──────────────────
  const report = (execution.result as any)?.report as any;
  const failedReportNode = report?.nodes?.find((n: any) => n.status === 'failed') ?? null;

  let affectedNodeId: string | null = runtimeIssue?.nodeId ?? null;
  let affectedNodeName: string | null = runtimeIssue?.nodeName ?? null;
  let affectedNodeType: string | null = runtimeIssue?.nodeType ?? null;

  // If runtime issue pointed at 'global', try to find from report
  if ((!affectedNodeId || affectedNodeId === 'global') && failedReportNode) {
    affectedNodeId = failedReportNode.id ?? null;
    affectedNodeName = failedReportNode.name ?? null;
    affectedNodeType = failedReportNode.type ?? null;
  }

  // ── Step 4: Find the actual WorkflowNode for the failed node ─────────────
  const failedNode = affectedNodeId
    ? nodes.find(n => n.id === affectedNodeId) ?? null
    : null;

  // ── Step 5: Build deterministic diagnosis ─────────────────────────────────
  const deterministic = buildDeterministicDiagnosis(
    runtimeIssue,
    validationIssues,
    failedNode,
    failedReportNode,
    nodes,
    edges
  );

  // ── Step 6: Optionally enhance with AI explanation ─────────────────────
  let aiEnhanced = false;
  let aiExplanation: { problem?: string; rootCause?: string; suggestedFix?: string } = {};

  if (useAI) {
    try {
      aiExplanation = await getAIExplanation(deterministic, runtimeIssue, failedReportNode, nodes, edges);
      aiEnhanced = true;
    } catch {
      // AI unavailable — fall back to deterministic only
      aiEnhanced = false;
    }
  }

  return {
    problem: aiExplanation.problem ?? deterministic.problem,
    rootCause: aiExplanation.rootCause ?? deterministic.rootCause,
    affectedNodeId,
    affectedNodeName,
    affectedNodeType,
    suggestedFix: aiExplanation.suggestedFix ?? deterministic.suggestedFix,
    confidence: deterministic.confidence,
    category: deterministic.category,
    proposedPatch: deterministic.proposedPatch,
    runtimeIssue,
    validationIssues,
    reportNodeData: failedReportNode,
    aiEnhanced,
  };
}

// ─── Deterministic Diagnosis ──────────────────────────────────────────────────

interface PartialDiagnosis {
  problem: string;
  rootCause: string;
  suggestedFix: string;
  confidence: DiagnosisConfidence;
  category: string;
  proposedPatch: NodePatch | null;
}

function buildDeterministicDiagnosis(
  issue: ExecutionIssue | null,
  valIssues: ValidationIssue[],
  failedNode: WorkflowNode | null,
  reportNode: any,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): PartialDiagnosis {
  const nodeType = String(issue?.nodeType ?? (failedNode ? getNodeType(failedNode) : 'unknown'));
  const nodeName = String(issue?.nodeName ?? failedNode?.data?.label ?? 'Unknown Node');
  const rawError = String(issue?.rawError ?? issue?.reason ?? '');
  const category = issue?.category ?? 'RUNTIME ERROR';

  // ── 1. CONFIGURATION ERRORS — missing required fields ────────────────────
  if (category === 'CONFIGURATION ERROR' || isConfigError(rawError)) {
    return diagnoseConfigError(issue, failedNode, nodeType, nodeName, rawError, valIssues, nodes);
  }

  // ── 2. VARIABLE REFERENCE ERRORS ─────────────────────────────────────────
  if (isVariableError(rawError)) {
    return diagnoseVariableError(issue, failedNode, nodeType, nodeName, rawError, nodes, edges, reportNode);
  }

  // ── 3. NETWORK / API ERRORS ───────────────────────────────────────────────
  if (category === 'NETWORK ERROR' || category === 'AUTHENTICATION ERROR' || category === 'RATE LIMIT ERROR') {
    return diagnoseNetworkError(issue, failedNode, nodeType, nodeName, rawError);
  }

  // ── 4. PERMISSION ERRORS ─────────────────────────────────────────────────
  if (category === 'PERMISSION ERROR') {
    return {
      problem: `The "${nodeName}" node failed due to a permission or Row-Level Security restriction.`,
      rootCause: 'The database rejected the operation because the current user does not have permission to access or modify this data.',
      suggestedFix: 'Check that the RLS policy on the table allows the authenticated user to perform this operation. If you are inserting data, make sure the record includes a matching user_id.',
      confidence: 'high',
      category,
      proposedPatch: null,
    };
  }

  // ── 5. VALIDATION ISSUES (no runtime issue, but static validator found problems) ──
  if (!issue && valIssues.length > 0) {
    const primary = valIssues[0];
    return {
      problem: `The workflow has a configuration issue on the "${primary.nodeName}" node.`,
      rootCause: primary.message,
      suggestedFix: primary.suggestion ?? 'Open the node configuration and fix the reported issue.',
      confidence: 'high',
      category: primary.severity === 'error' ? 'CONFIGURATION ERROR' : 'VALIDATION WARNING',
      proposedPatch: buildPatchFromValidationIssue(primary, nodes),
    };
  }

  // ── 6. GENERIC FALLBACK ───────────────────────────────────────────────────
  return {
    problem: `The "${nodeName}" node failed during execution.`,
    rootCause: rawError || issue?.message || 'An unexpected error occurred.',
    suggestedFix: issue?.suggestion ?? 'Review the node configuration and the raw error below.',
    confidence: 'low',
    category,
    proposedPatch: null,
  };
}

// ─── Specialized Diagnosers ───────────────────────────────────────────────────

function diagnoseConfigError(
  issue: ExecutionIssue | null,
  failedNode: WorkflowNode | null,
  nodeType: string,
  nodeName: string,
  rawError: string,
  valIssues: ValidationIssue[],
  nodes: WorkflowNode[]
): PartialDiagnosis {
  const config = getConfig(failedNode);

  // URL missing
  if (nodeType === 'api_call' || nodeType === 'webhook') {
    if (!config.url || String(config.url).trim() === '') {
      return {
        problem: `The "${nodeName}" node is missing its URL.`,
        rootCause: 'The node has no URL configured, so it cannot make any HTTP request.',
        suggestedFix: 'Open the node configuration and enter a valid URL (e.g. https://api.example.com/data).',
        confidence: 'high',
        category: 'CONFIGURATION ERROR',
        proposedPatch: failedNode ? {
          nodeId: failedNode.id,
          nodeName,
          field: 'url',
          oldValue: config.url ?? '',
          newValue: '',
          description: 'Enter a valid API endpoint URL',
          isSafe: false,
          unsafeReason: 'URL cannot be automatically guessed',
        } : null,
      };
    }
  }

  // Database table missing or invalid
  if (nodeType === 'database') {
    const table = String(config.table ?? '').trim();
    if (!table) {
      return {
        problem: `The "${nodeName}" database node has no table selected.`,
        rootCause: 'A database operation requires a target table. None is configured.',
        suggestedFix: `Select one of the available tables: ${ALLOWED_TABLES.join(', ')}.`,
        confidence: 'high',
        category: 'CONFIGURATION ERROR',
        proposedPatch: failedNode ? {
          nodeId: failedNode.id,
          nodeName,
          field: 'table',
          oldValue: '',
          newValue: '',
          description: `Select an available table (${ALLOWED_TABLES.slice(0, 4).join(', ')}, ...)`,
          isSafe: false,
          unsafeReason: 'Cannot automatically select a table without knowing your intent',
        } : null,
      };
    }
    if (!ALLOWED_TABLES.includes(table)) {
      const closest = ALLOWED_TABLES.find(t => levenshtein(t, table) <= 3) ?? ALLOWED_TABLES[0];
      return {
        problem: `The "${nodeName}" node references a table "${table}" that does not exist.`,
        rootCause: `The table "${table}" is not in the list of available tables.`,
        suggestedFix: `Did you mean "${closest}"? Available tables: ${ALLOWED_TABLES.join(', ')}.`,
        confidence: 'high',
        category: 'CONFIGURATION ERROR',
        proposedPatch: failedNode ? {
          nodeId: failedNode.id,
          nodeName,
          field: 'table',
          oldValue: table,
          newValue: closest,
          description: `Change table from "${table}" to "${closest}"`,
          isSafe: true,
        } : null,
      };
    }
  }

  // Email missing to/subject
  if (nodeType === 'email') {
    if (!config.to || String(config.to).trim() === '') {
      return {
        problem: `The "${nodeName}" email node is missing a recipient address.`,
        rootCause: 'The "To" field is empty, so the email cannot be delivered.',
        suggestedFix: 'Enter an email address in the "To" field, or map it from a prior node output (e.g. ${fetch_users.rows[0].email}).',
        confidence: 'high',
        category: 'CONFIGURATION ERROR',
        proposedPatch: failedNode ? {
          nodeId: failedNode.id,
          nodeName,
          field: 'to',
          oldValue: '',
          newValue: '',
          description: 'Set recipient email address',
          isSafe: false,
          unsafeReason: 'Email address cannot be automatically guessed',
        } : null,
      };
    }
  }

  // AI Prompt missing
  if (nodeType === 'ai_prompt' || nodeType === 'ai') {
    if (!config.prompt || String(config.prompt).trim() === '') {
      return {
        problem: `The "${nodeName}" AI Prompt node has no prompt text.`,
        rootCause: 'The prompt field is empty, so the AI has nothing to respond to.',
        suggestedFix: 'Enter a prompt in the node configuration. You can reference upstream outputs using ${node_name.field}.',
        confidence: 'high',
        category: 'CONFIGURATION ERROR',
        proposedPatch: null,
      };
    }
  }

  // Loop missing items source
  if (nodeType === 'loop') {
    if (!config.items || String(config.items).trim() === '') {
      return {
        problem: `The "${nodeName}" loop node has no input array configured.`,
        rootCause: 'The loop needs an array to iterate over, but the Items field is empty.',
        suggestedFix: 'Set the Items field to reference an upstream array, e.g. ${fetch_users.rows} from a database node.',
        confidence: 'high',
        category: 'CONFIGURATION ERROR',
        proposedPatch: null,
      };
    }
  }

  // Fallback config error
  return {
    problem: `The "${nodeName}" node has a configuration problem.`,
    rootCause: issue?.message ?? rawError,
    suggestedFix: issue?.suggestion ?? 'Open the node and check all required fields.',
    confidence: 'medium',
    category: 'CONFIGURATION ERROR',
    proposedPatch: buildPatchFromValidationIssue(valIssues.find(v => v.nodeId === failedNode?.id) ?? null, nodes),
  };
}

function diagnoseVariableError(
  issue: ExecutionIssue | null,
  failedNode: WorkflowNode | null,
  nodeType: string,
  nodeName: string,
  rawError: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  reportNode: any
): PartialDiagnosis {
  // Extract the variable path from the error message
  const varMatch = rawError.match(/Missing variable "?\$\{([^}"]+)\}/i)
    ?? rawError.match(/Missing property "?\$\{([^}"]+)\}/i)
    ?? rawError.match(/unresolved variable[:\s]+"?([^"]+)"?/i);
  const varPath = varMatch?.[1] ?? '';

  // Try to figure out what node the variable references
  const parts = varPath.split('.');
  const refSegment = parts[0];
  const referencedNodeId = refSegment ? extractNodeIdFromReference(refSegment, nodes) : null;
  const referencedNode = referencedNodeId ? nodes.find(n => n.id === referencedNodeId) : null;
  const referencedNodeName = referencedNode?.data?.label ?? refSegment;

  // Find all upstream nodes that actually ran (from report)
  const upstreamIds = getUpstreamNodeIds(failedNode?.id ?? '', edges);
  const availableOutputs = nodes
    .filter(n => upstreamIds.has(n.id))
    .map(n => `\${node_${n.id}.field} or \${${normalizeNodeLabel(String(n.data?.label ?? n.id))}.field}`)
    .join(', ');

  const problem = `The "${nodeName}" node tried to use a variable "\${${varPath}}" that doesn't exist.`;
  let rootCause = '';
  let suggestedFix = '';
  let proposedPatch: NodePatch | null = null;

  if (referencedNodeId) {
    // Referenced node exists — is it upstream?
    if (!upstreamIds.has(referencedNodeId)) {
      rootCause = `The node "${referencedNodeName}" exists in the workflow but runs AFTER "${nodeName}", so its output is not yet available.`;
      suggestedFix = `Reorder the workflow so "${referencedNodeName}" runs before "${nodeName}", or check the connections between them.`;
    } else {
      // Referenced node is upstream — the field path is wrong
      rootCause = `The node "${referencedNodeName}" runs before "${nodeName}", but the field path ".${parts.slice(1).join('.')}" doesn't match its actual output.`;
      suggestedFix = `Check the actual output of "${referencedNodeName}" and update the variable path.`;

      // Check report for what the node actually returned
      const reportData = (reportNode as any)?._prevOutputs?.[referencedNodeId] ?? null;
      if (reportData && typeof reportData === 'object') {
        const availFields = Object.keys(reportData).join(', ');
        suggestedFix += ` Available fields: ${availFields}.`;
      }
    }
  } else {
    // Referenced node doesn't exist at all
    rootCause = `No node with the label or ID "${refSegment}" exists in this workflow.`;
    suggestedFix = `Check the variable name. ${availableOutputs ? `You can use outputs from: ${availableOutputs}` : 'Add a node that produces the data you need.'}`;

    // Try to suggest a fix: find any node whose normalized label is close
    const closestNode = nodes.find(n => {
      const label = normalizeNodeLabel(String(n.data?.label ?? n.id));
      return levenshtein(label, refSegment) <= 3;
    });
    if (closestNode && failedNode) {
      const correctRef = `node_${closestNode.id}`;
      const config = getConfig(failedNode);
      const configStr = JSON.stringify(config);
      const correctedStr = configStr.replace(new RegExp(escapeRegExp(refSegment), 'g'), correctRef);
      try {
        const correctedConfig = JSON.parse(correctedStr);
        // Find the first changed field
        for (const [k, v] of Object.entries(correctedConfig)) {
          if (JSON.stringify(v) !== JSON.stringify((config as any)[k])) {
            proposedPatch = {
              nodeId: failedNode.id,
              nodeName,
              field: k,
              oldValue: (config as any)[k],
              newValue: v,
              description: `Fix variable reference: "${refSegment}" → "${correctRef}" (did you mean "${closestNode.data?.label}"?)`,
              isSafe: true,
            };
            break;
          }
        }
      } catch { /* skip */ }
    }
  }

  return {
    problem,
    rootCause,
    suggestedFix,
    confidence: referencedNodeId ? 'high' : 'medium',
    category: 'CONFIGURATION ERROR',
    proposedPatch,
  };
}

function diagnoseNetworkError(
  issue: ExecutionIssue | null,
  failedNode: WorkflowNode | null,
  nodeType: string,
  nodeName: string,
  rawError: string
): PartialDiagnosis {
  const statusMatch = rawError.match(/(?:returned|status)\s*(\d{3})/i);
  const statusCode = statusMatch?.[1];
  const config = getConfig(failedNode);

  let problem = `The "${nodeName}" node's HTTP request failed.`;
  let rootCause = rawError;
  let suggestedFix = issue?.suggestion ?? 'Check the endpoint URL and credentials.';

  if (statusCode === '401' || statusCode === '403') {
    problem = `The "${nodeName}" node received a ${statusCode} Unauthorized/Forbidden response.`;
    rootCause = 'The API rejected the request because the credentials or API key are invalid or missing.';
    suggestedFix = 'Check the Authorization header or API key in the node configuration.';
  } else if (statusCode === '404') {
    problem = `The "${nodeName}" node received a 404 Not Found response.`;
    rootCause = `The URL "${config.url ?? ''}" does not exist on the server.`;
    suggestedFix = 'Double-check the URL path. The endpoint may have moved or the spelling may be wrong.';
  } else if (statusCode === '429') {
    problem = `The "${nodeName}" node is being rate limited.`;
    rootCause = 'You are making too many requests to this API in a short time.';
    suggestedFix = 'Add a Delay node before this API Call, or check the API provider\'s rate limit documentation.';
  } else if (rawError.toLowerCase().includes('cors') || rawError.toLowerCase().includes('network')) {
    problem = `The "${nodeName}" node cannot reach the external API due to CORS or network restrictions.`;
    rootCause = 'Browser security policy blocks direct cross-origin requests to APIs that don\'t allow them.';
    suggestedFix = 'Use a CORS-friendly test API like https://dummyjson.com/products, or route the request through your own backend.';
  }

  return {
    problem,
    rootCause,
    suggestedFix,
    confidence: statusCode ? 'high' : 'medium',
    category: issue?.category ?? 'NETWORK ERROR',
    proposedPatch: null, // Network errors are never auto-patchable
  };
}

// ─── AI Enhancement ───────────────────────────────────────────────────────────

async function getAIExplanation(
  deterministic: PartialDiagnosis,
  issue: ExecutionIssue | null,
  reportNode: any,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<{ problem?: string; rootCause?: string; suggestedFix?: string }> {
  const nodeList = nodes.map(n => `- ${n.data?.label ?? n.id} (${getNodeType(n)})`).join('\n');
  const edgeList = edges.map(e => `${e.source} → ${e.target}${e.sourceHandle ? ` [${e.sourceHandle}]` : ''}`).join('\n');

  const context = `
WORKFLOW STRUCTURE:
Nodes:
${nodeList}

Edges:
${edgeList}

FAILED NODE: ${issue?.nodeName ?? 'Unknown'} (${issue?.nodeType ?? 'unknown'})
ERROR CATEGORY: ${issue?.category ?? deterministic.category}
ERROR MESSAGE: ${issue?.message ?? ''}
RAW ERROR: ${issue?.rawError ?? ''}
ACTUAL NODE INPUTS: ${reportNode?.inputs ? JSON.stringify(reportNode.inputs, null, 2).substring(0, 400) : 'N/A'}

DETERMINISTIC ANALYSIS:
Problem: ${deterministic.problem}
Root Cause: ${deterministic.rootCause}
Suggested Fix: ${deterministic.suggestedFix}
`.trim();

  const prompt = `You are a workflow automation expert helping a user debug a failed automated workflow.

Based on this diagnostic information, provide a clear, concise explanation in JSON format:

${context}

Return ONLY valid JSON with these exact fields:
{
  "problem": "1-2 sentence plain-English description of what failed",
  "rootCause": "Technical explanation of WHY it failed",
  "suggestedFix": "Actionable steps the user should take"
}

Rules:
- Do NOT invent node IDs, table names, or credentials
- Use the exact node names from the workflow structure above
- Be specific and actionable
- Keep each field under 150 words`;

  const { data, error } = await supabase.functions.invoke('gemini-api', {
    body: {
      action: 'chat',
      payload: { message: prompt }
    }
  });

  if (error || !data?.text) throw new Error('AI unavailable');

  const jsonMatch = data.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI response not parseable');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    problem: typeof parsed.problem === 'string' ? parsed.problem : undefined,
    rootCause: typeof parsed.rootCause === 'string' ? parsed.rootCause : undefined,
    suggestedFix: typeof parsed.suggestedFix === 'string' ? parsed.suggestedFix : undefined,
  };
}

// ─── Patch Builder from Validation Issues ────────────────────────────────────

function buildPatchFromValidationIssue(
  issue: ValidationIssue | null,
  nodes: WorkflowNode[]
): NodePatch | null {
  if (!issue) return null;
  const node = nodes.find(n => n.id === issue.nodeId);
  if (!node) return null;

  const nodeName = issue.nodeName;
  const field = issue.field;
  if (!field) return null;

  const config = getConfig(node);
  const oldValue = (config as any)[field] ?? '';

  return {
    nodeId: issue.nodeId,
    nodeName,
    field,
    oldValue,
    newValue: '', // user must fill in
    description: `Fix "${field}" on the "${nodeName}" node: ${issue.message}`,
    isSafe: false,
    unsafeReason: 'Value must be provided by the user',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRuntimeIssue(errorMessage: string | null): ExecutionIssue | null {
  if (!errorMessage) return null;
  try {
    const parsed = JSON.parse(errorMessage);
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      return parsed as ExecutionIssue;
    }
  } catch { /* not JSON */ }
  // Plain string error
  return {
    nodeId: 'global',
    nodeName: 'Workflow',
    nodeType: 'system',
    severity: 'error',
    category: 'RUNTIME ERROR',
    message: errorMessage,
    rawError: errorMessage,
  };
}

function getNodeType(node: WorkflowNode): string {
  return (
    (node.data?.node_type as string) ||
    (node.data?.type as string) ||
    node.type ||
    'unknown'
  );
}

function getConfig(node: WorkflowNode | null): Record<string, unknown> {
  if (!node) return {};
  return (node.data?.config as Record<string, unknown>) || {};
}

function getUpstreamNodeIds(nodeId: string, edges: WorkflowEdge[]): Set<string> {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const e of edges) {
      if (e.target === curr && !visited.has(e.source)) {
        visited.add(e.source);
        queue.push(e.source);
      }
    }
  }
  return visited;
}

function isConfigError(rawError: string): boolean {
  const e = rawError.toLowerCase();
  return e.includes('required') || e.includes('is required') || e.includes('not configured')
    || e.includes('missing') || e.includes('does not exist in the database')
    || e.includes('table name is required');
}

function isVariableError(rawError: string): boolean {
  const e = rawError.toLowerCase();
  return e.includes('missing variable') || e.includes('missing property')
    || e.includes('unresolved variable') || e.includes('cannot resolve')
    || e.includes('undefined variable');
}

function levenshtein(a: string, b: string): number {
  if (!a) return b?.length ?? 0;
  if (!b) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = a[i - 1] === b[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[a.length][b.length];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
