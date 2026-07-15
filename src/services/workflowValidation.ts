import type { WorkflowNode, WorkflowEdge } from '@/types';
import { ALLOWED_TABLES, topologicalSort } from './executionEngine';

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
  
  // Mapping of variable safe names to node IDs
  const safeLabelToNodeId = new Map<string, string>();
  for (const node of nodes) {
    const label = getLabel(node);
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    safeLabelToNodeId.set(safeLabel, node.id);
  }

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
      if (!config.condition || String(config.condition).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'condition', severity: 'error', message: 'Condition expression is required.', suggestion: 'Enter a condition (e.g. ${step.count} > 0).' });
      }
    } else if (type === 'loop') {
      if (!config.items || String(config.items).trim() === '') {
        addIssue({ nodeId: node.id, nodeName: label, field: 'items', severity: 'warning', message: 'Loop has no item source configured — will run a fixed iteration count instead of real data.', suggestion: 'Reference an array output, e.g. ${fetch_users.rows}.' });
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
      
      if (operation === 'insert' && (!config.record || Object.keys(config.record).length === 0)) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'record', severity: 'error', message: 'Insert operation requires a record payload.', suggestion: 'Provide record data to insert.' });
      } else if (operation === 'update' && (!config.updates || Object.keys(config.updates).length === 0)) {
        addIssue({ nodeId: node.id, nodeName: label, field: 'updates', severity: 'error', message: 'Update operation requires an updates payload.', suggestion: 'Provide updates data.' });
      } else if (operation === 'delete' && (!config.filters || Object.keys(config.filters).length === 0)) {
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
      if (parts.length > 0) {
        const refNodeLabel = parts[0];
        if (refNodeLabel === 'item') continue; // Loop item variable, valid inside loop bodies (assumed safe for now)
        
        const refNodeId = safeLabelToNodeId.get(refNodeLabel);
        if (refNodeId) {
          const currentIndex = nodeOrderIndex.get(node.id) ?? -1;
          const refIndex = nodeOrderIndex.get(refNodeId) ?? -1;
          
          if (refIndex >= currentIndex) {
            addIssue({ nodeId: node.id, nodeName: label, field: 'config', severity: 'error', message: `Variable \${${varPath}} references a node that hasn't run at this point in the workflow.`, suggestion: `Ensure "${refNodeLabel}" executes before this node.` });
          }
        } else {
          // If we can't find a matching node, it might be a system variable or invalid. We'll warn if it's not 'env' or 'item'
          if (refNodeLabel !== 'env' && refNodeLabel !== 'item') {
             addIssue({ nodeId: node.id, nodeName: label, field: 'config', severity: 'error', message: `Variable \${${varPath}} references a node that doesn't exist yet or hasn't run at this point in the workflow.`, suggestion: `Check variable spelling or ensure the node exists.` });
          }
        }
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
