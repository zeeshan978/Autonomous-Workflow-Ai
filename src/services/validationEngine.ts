import type { Workflow, WorkflowNode, WorkflowEdge } from '@/types';
import { interpolate } from './executionEngine'; // We need access to the interpolate function logic, or we can write a simple variable extractor

export interface ValidationError {
  nodeId: string;
  nodeName: string;
  message: string;
  fix?: string;
}

export interface ValidationWarning {
  nodeId: string;
  nodeName: string;
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface DatabaseSchema {
  [tableName: string]: {
    column_name: string;
    data_type: string;
    is_nullable: string;
  }[];
}

/**
 * Extracts all variables referenced in a string, e.g. "Hello ${user.email}" -> ["user.email"]
 */
export function extractVariables(text: string): string[] {
  if (!text) return [];
  const regex = /\$\{([^}]+)\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

/**
 * Validates a workflow before execution.
 * @param workflow The workflow to validate
 * @param schema Raw schema returned from getDatabaseSchema()
 */
export function validateWorkflow(workflow: Workflow, rawSchema: any[]): ValidationReport {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const nodes = workflow.nodes || [];
  const edges = workflow.edges || [];

  if (nodes.length === 0) {
    errors.push({
      nodeId: 'workflow',
      nodeName: 'Workflow',
      message: 'Workflow has no nodes.'
    });
    return { isValid: false, errors, warnings };
  }

  // Parse schema into a faster lookup format
  const schema: DatabaseSchema = {};
  if (rawSchema && Array.isArray(rawSchema)) {
    rawSchema.forEach(table => {
      schema[table.table_name] = table.columns || [];
    });
  }

  // To validate variables, we need to know what variables are available at each node.
  // This is a complex graph problem, but we can do a simplified topological sort simulation.
  // Variables are outputted as `${nodeName}_output` (legacy) or `${nodeName}`.
  
  // Actually, executionEngine uses the normalized node name or ID.
  const availableOutputs = new Set<string>();
  
  // 1. Add global/trigger variables
  if (workflow.variables) {
    Object.keys(workflow.variables).forEach(k => availableOutputs.add(k));
  }

  nodes.forEach(node => {
    const nodeType = resolveNodeType(node);
    const nodeName = (node.data?.label as string) || nodeType;
    const config = (node.data?.config as Record<string, unknown>) || node.data || {};
    const normalizedName = nodeName.toLowerCase().replace(/\s+/g, '_');
    
    // Every node outputs its result to context
    availableOutputs.add(`node_${node.id}`);
    availableOutputs.add(`${normalizedName}_output`);
    availableOutputs.add(normalizedName);
    
    // We can also assume basic outputs depending on type (e.g. database rows, api data)
    if (nodeType === 'database' || nodeType === 'db') {
      availableOutputs.add(`${normalizedName}.rows`);
      availableOutputs.add(`${normalizedName}.count`);
      availableOutputs.add(`${normalizedName}.inserted`);
      availableOutputs.add(`${normalizedName}.updated`);
      availableOutputs.add(`${normalizedName}.deleted`);
    } else if (nodeType === 'api' || nodeType === 'api_call') {
      availableOutputs.add(`${normalizedName}.data`);
      availableOutputs.add(`${normalizedName}.status`);
    } else if (nodeType === 'email') {
      availableOutputs.add(`${normalizedName}.sent`);
    }
  });

  // Now validate each node
  nodes.forEach(node => {
    const nodeType = resolveNodeType(node);
    const nodeName = (node.data?.label as string) || nodeType;
    const config = (node.data?.config as Record<string, unknown>) || node.data || {};
    
    const checkVariables = (text: string, fieldName: string) => {
      const vars = extractVariables(text);
      vars.forEach(v => {
        // Simple check: does the variable prefix match an available output?
        const prefix = v.split('.')[0];
        if (!availableOutputs.has(prefix) && !availableOutputs.has(v)) {
           // We'll log it as a warning, because complex JSON mapping might happen at runtime
           warnings.push({
             nodeId: node.id,
             nodeName,
             message: `Variable "\${${v}}" used in ${fieldName} might not exist.`
           });
        }
      });
    };

    switch (nodeType) {
      case 'database':
      case 'db': {
        const table = String(config.table || '');
        const operation = String(config.operation || 'select').toLowerCase();
        
        if (!table) {
          errors.push({ nodeId: node.id, nodeName, message: 'Database table is required.' });
        } else if (Object.keys(schema).length > 0 && !schema[table]) {
          // Schema provided but table not found
          // Find closest table using levenshtein
          let closest = '';
          let minDistance = Infinity;
          Object.keys(schema).forEach(t => {
            const dist = levenshtein(table, t);
            if (dist < minDistance) {
              minDistance = dist;
              closest = t;
            }
          });
          
          errors.push({
            nodeId: node.id,
            nodeName,
            message: `Table "${table}" does not exist.`,
            fix: minDistance <= 3 ? `Did you mean "${closest}"?` : undefined
          });
        } else if (schema[table]) {
          // Check columns if filters exist
          const filters = config.filters as Record<string, unknown>;
          if (filters) {
            Object.keys(filters).forEach(col => {
              const colExists = schema[table].some(c => c.column_name === col);
              if (!colExists) {
                let closest = '';
                let minDistance = Infinity;
                schema[table].forEach(c => {
                  const dist = levenshtein(col, c.column_name);
                  if (dist < minDistance) {
                    minDistance = dist;
                    closest = c.column_name;
                  }
                });
                errors.push({
                  nodeId: node.id,
                  nodeName,
                  message: `Missing column "${col}" in table "${table}".`,
                  fix: minDistance <= 3 ? `Did you mean "${closest}"?` : undefined
                });
              }
              // Check variables in filter values
              if (typeof filters[col] === 'string') {
                checkVariables(filters[col] as string, `filter '${col}'`);
              }
            });
          }
          // Same for updates and inserts
          const record = (config.record || config.updates || config.data) as Record<string, unknown>;
          if (record && typeof record === 'object') {
            Object.keys(record).forEach(col => {
              const colExists = schema[table].some(c => c.column_name === col);
              if (!colExists) {
                errors.push({
                  nodeId: node.id,
                  nodeName,
                  message: `Missing column "${col}" in table "${table}".`
                });
              }
              if (typeof record[col] === 'string') {
                checkVariables(record[col] as string, `field '${col}'`);
              }
            });
          }
        }
        break;
      }
      
      case 'api':
      case 'api_call': {
        const url = String(config.url || '');
        if (!url) {
          errors.push({ nodeId: node.id, nodeName, message: 'API URL is required.' });
        } else {
          checkVariables(url, 'URL');
        }
        break;
      }
      
      case 'email': {
        const to = String(config.to || '');
        const subject = String(config.subject || '');
        if (!to) errors.push({ nodeId: node.id, nodeName, message: 'Email "To" address is required.' });
        if (!subject) errors.push({ nodeId: node.id, nodeName, message: 'Email "Subject" is required.' });
        
        checkVariables(to, 'To address');
        checkVariables(subject, 'Subject');
        checkVariables(String(config.body || ''), 'Body');
        break;
      }
      
      case 'webhook': {
        const url = String(config.url || '');
        if (!url) errors.push({ nodeId: node.id, nodeName, message: 'Webhook URL is required.' });
        break;
      }

      case 'ai_prompt':
      case 'ai': {
        const prompt = String(config.prompt || '');
        if (!prompt) errors.push({ nodeId: node.id, nodeName, message: 'AI Prompt is required.' });
        checkVariables(prompt, 'Prompt');
        break;
      }
      
      case 'notification': {
        const message = String(config.message || '');
        if (!message) errors.push({ nodeId: node.id, nodeName, message: 'Notification message is required.' });
        checkVariables(message, 'Message');
        break;
      }
    }

    // Check incoming edges
    const incomingEdges = edges.filter(e => e.target === node.id);
    if (incomingEdges.length === 0 && nodeType !== 'trigger' && !config.isTrigger) {
      warnings.push({
        nodeId: node.id,
        nodeName,
        message: 'Node has no incoming connections. It may not execute correctly unless it is the first node.'
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function resolveNodeType(node: WorkflowNode): string {
  return (node.data?.node_type as string) || (node.data?.type as string) || node.type || 'unknown';
}

/**
 * Simple Levenshtein distance for spell checking
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
