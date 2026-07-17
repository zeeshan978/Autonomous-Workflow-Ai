import type { WorkflowNode, WorkflowEdge } from '@/types';
import { ALLOWED_TABLES, topologicalSort, extractNodeIdFromReference } from './executionEngine';

export interface ValidationIssue {
  nodeId: string;
  nodeName: string;
  field?: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  needsConfiguration: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  nodeResults: Record<string, { status: 'ok' | 'warning' | 'error', issues: ValidationIssue[] }>;
}

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const nodeResults: Record<string, { status: 'ok' | 'warning' | 'error', issues: ValidationIssue[] }> = {};
  let needsConfiguration = false;

  if (!nodes || nodes.length === 0) {
    return {
      valid: false,
      needsConfiguration: false,
      errors: [{ nodeId: 'global', nodeName: 'Workflow', severity: 'error', message: 'Workflow has no nodes.' }],
      warnings: [],
      nodeResults: {}
    };
  }

  // Initialize nodeResults
  for (const node of nodes) {
    nodeResults[node.id] = { status: 'ok', issues: [] };
  }

  const addIssue = (issue: ValidationIssue) => {
    if (issue.severity === 'error') errors.push(issue);
    else warnings.push(issue);
    
    if (issue.nodeId && nodeResults[issue.nodeId]) {
      nodeResults[issue.nodeId].issues.push(issue);
      if (issue.severity === 'error') {
        nodeResults[issue.nodeId].status = 'error';
      } else if (nodeResults[issue.nodeId].status !== 'error') {
        nodeResults[issue.nodeId].status = 'warning';
      }
    }
  };

  const getLabel = (node: any): string => {
    return node.data?.label || node.name || node.id;
  }

  const getConfig = (node: any): Record<string, any> => {
    return node.data?.config || node.config || {};
  }

  const getType = (node: any): string => {
    return node.data?.node_type || node.type || node.data?.type || '';
  }

  // Topological sort for variable reference validation
  const orderedNodes = topologicalSort(nodes, edges || []);
  const nodeOrderIndex = new Map(orderedNodes.map((n, i) => [n.id, i]));
  

  for (const node of nodes) {
    const label = getLabel(node);
    const config = getConfig(node);
    const type = getType(node);

    // 1. Check required fields
    if (type === 'ai_prompt') {
      if (!config.prompt || String(config.prompt).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'prompt', severity: 'error', message: 'AI Prompt requires a prompt message.', suggestion: 'Enter a prompt.' });
      }
    } else if (type === 'api_call') {
      if (!config.url || String(config.url).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'url', severity: 'error', message: 'API Call requires a URL.', suggestion: 'Enter a valid URL.' });
      }
    } else if (type === 'webhook') {
      if (!config.url || String(config.url).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'url', severity: 'error', message: 'Webhook requires a URL.', suggestion: 'Enter a valid URL.' });
      }
    } else if (type === 'email') {
      if (!config.to || String(config.to).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'to', severity: 'error', message: 'Email requires a recipient (To).', suggestion: 'Enter an email address.' });
      }
      if (!config.subject || String(config.subject).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'subject', severity: 'error', message: 'Email requires a subject.', suggestion: 'Enter a subject line.' });
      }
    } else if (type === 'condition' || type === 'decision') {
      const mode = config.mode || 'easy';
      if (mode === 'easy') {
        const conditions = Array.isArray(config.conditions) ? config.conditions : [];
        if (conditions.length === 0) {
           addIssue({ nodeId: node.id, nodeName: label, field: 'conditions', severity: 'warning', message: 'No conditions configured.', suggestion: 'Add at least one condition or it will default to true.' });
        }
      } else {
        if (!config.condition || String(config.condition).trim() === '') {
          addIssue({ nodeId: node.id, nodeName: label, field: 'condition', severity: 'error', message: 'Condition expression is required.', suggestion: 'Enter a condition (e.g. ${step.count} > 0).' });
        }
      }
      
      const outgoingEdges = edges.filter(e => e.source === node.id);
      const hasTrue = outgoingEdges.some(e => e.sourceHandle === 'true');
      const hasFalse = outgoingEdges.some(e => e.sourceHandle === 'false');
      if (outgoingEdges.length > 0 && !hasTrue && !hasFalse) {
         // Legacy structure or malformed
         addIssue({ nodeId: node.id, nodeName: label, field: 'edges', severity: 'warning', message: 'Condition has outgoing connections without explicit TRUE/FALSE handles.', suggestion: 'Reconnect the outgoing paths to the TRUE or FALSE handles.' });
      }
    } else if (type === 'loop') {
      if (!config.items || String(config.items).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'items', severity: 'warning', message: 'Loop has no item source configured.', suggestion: 'Reference an array output, e.g. ${fetch_users.rows}.' });
      }
      
      const outgoingEdges = edges.filter(e => e.source === node.id);
      const hasBody = outgoingEdges.some(e => e.sourceHandle === 'body' || e.sourceHandle === 'item');
      if (!hasBody) {
         addIssue({ nodeId: node.id, nodeName: label, field: 'edges', severity: 'warning', message: 'Loop body is not connected.', suggestion: 'Connect the ITEM handle to the nodes you want to loop over.' });
      }
    } else if (type === 'database') {
      const operation = String(config.operation || 'select').toLowerCase();
      if (!['select', 'insert', 'update', 'delete'].includes(operation)) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'operation', severity: 'error', message: `Invalid database operation: "${operation}".`, suggestion: 'Set operation to select, insert, update, or delete.' });
      }
      const table = String(config.table || '').trim();
      if (!table) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'table', severity: 'error', message: 'Database table name is required.', suggestion: 'Select an existing table.' });
      } else if (!ALLOWED_TABLES.includes(table)) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'table', severity: 'error', message: `Table "${table}" does not exist.`, suggestion: `Select an existing table: ${ALLOWED_TABLES.join(', ')}` });
      }
      
      let parsedFilters: any = {};
      let parsedRecord: any = {};
      let parsedUpdates: any = {};
      try { parsedFilters = typeof config.filters === 'string' ? JSON.parse(config.filters) : config.filters || {}; } catch { /* ignore */ }
      try { parsedRecord = typeof config.record === 'string' ? JSON.parse(config.record) : config.record || {}; } catch { /* ignore */ }
      try { parsedUpdates = typeof config.updates === 'string' ? JSON.parse(config.updates) : config.updates || {}; } catch { /* ignore */ }

      if (operation === 'insert' && Object.keys(parsedRecord).length === 0) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'record', severity: 'error', message: 'Insert operation requires a record payload.', suggestion: 'Provide record data to insert.' });
      } else if (operation === 'update' && Object.keys(parsedUpdates).length === 0) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'updates', severity: 'error', message: 'Update operation requires an updates payload.', suggestion: 'Provide updates data.' });
      } else if (operation === 'delete' && Object.keys(parsedFilters).length === 0) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'filters', severity: 'error', message: 'Delete operation requires filters for safety.', suggestion: 'Provide at least one filter.' });
      }
    }

    // 2. Check variable references via topological sort
    const configStr = JSON.stringify(config);
    const varRegex = /\$\{([^}]+)\}/g;
    let match;
    while ((match = varRegex.exec(configStr)) !== null) {
      const varPath = match[1];
      const parts = varPath.split('.');
      if (parts.length === 0) continue;

      let refSegment = parts[0];

      // Skip well-known runtime variables
      if (refSegment === 'item' || refSegment === 'env' || refSegment === 'index') continue;

      // Handle canonical node_ prefix: ${node_nodeId.field} — extract actual node id
      // e.g. "node_node-1" → look for node with id "node-1"
      // e.g. "node_node_2_with_underscores" → look for node with that exact id
      if (refSegment.startsWith('node_')) {
        const possibleId = refSegment.substring(5); // strip 'node_'
        const directMatch = nodes.find(n => n.id === possibleId);
        if (directMatch) {
          const currentIndex = nodeOrderIndex.get(node.id) ?? -1;
          const refIndex = nodeOrderIndex.get(directMatch.id) ?? -1;
          if (refIndex >= currentIndex) {
            addIssue({ nodeId: node.id, nodeName: label, field: 'config', severity: 'error', message: `Variable \${${varPath}} references a node that hasn't run at this point in the workflow.`, suggestion: `Ensure "${directMatch.data?.label || directMatch.id}" executes before this node.` });
          }
          continue; // Valid reference — move on
        }
        // If not a direct id match, fall through to label matching below with possibleId
        refSegment = possibleId;
      }
      
      const refNodeId = extractNodeIdFromReference(refSegment, nodes);
      if (refNodeId) {
        const currentIndex = nodeOrderIndex.get(node.id) ?? -1;
        const refIndex = nodeOrderIndex.get(refNodeId) ?? -1;
        
        if (refIndex >= currentIndex) {
          addIssue({ nodeId: node.id, nodeName: label, field: 'config', severity: 'error', message: `Variable \${${varPath}} references a node that hasn't run at this point in the workflow.`, suggestion: `Ensure "${refSegment}" executes before this node.` });
        }
        // else: valid upstream reference — no issue
      } else {
        // Unknown reference — could be a typo or genuinely missing node
        addIssue({ nodeId: node.id, nodeName: label, field: 'config', severity: 'error', message: `Variable \${${varPath}} references a node that doesn't exist: "${refSegment}".`, suggestion: `Check the variable name. Use the node's label (lowercase, underscores) or the canonical node_ID format.` });
      }
    }

    // 3. Isolated node check
    const incomingEdges = edges.filter(e => e.target === node.id);
    const outgoingEdges = edges.filter(e => e.source === node.id);
    
    const isTerminal = ['email', 'notification', 'export'].includes(type) || 
      (type === 'database' && ['delete', 'update', 'insert'].includes(String(config.operation || 'select').toLowerCase()));
      
    if (nodes.length > 1) {
      if (incomingEdges.length === 0 && outgoingEdges.length === 0) {
        addIssue({ nodeId: node.id, nodeName: label, severity: 'error', message: 'Isolated node: not connected to anything.', suggestion: 'Connect this node to the workflow.' });
      } else if (incomingEdges.length === 0 && outgoingEdges.length > 0) {
        // Entry node - usually fine
      } else if (outgoingEdges.length === 0 && !isTerminal) {
         // Some node types must connect to something if they aren't terminal
         addIssue({ nodeId: node.id, nodeName: label, severity: 'warning', message: 'Node has no outgoing connections.', suggestion: 'Connect this node to a subsequent step or ensure it is the last step.' });
      }
    }

    // 4. Needs Configuration check
    const configNeedsConfig = config.needs_configuration === true || (node.data as any)?.needs_configuration === true;
    if (configNeedsConfig) {
      needsConfiguration = true;
      const note = config.configuration_note || (node.data as any)?.configuration_note || "This node needs configuration before it can run.";
      addIssue({ nodeId: node.id, nodeName: label, severity: 'warning', message: String(note), suggestion: "Review and complete this node's settings." });
    }
  }

  return {
    valid: errors.length === 0,
    needsConfiguration,
    errors,
    warnings,
    nodeResults
  };
}
