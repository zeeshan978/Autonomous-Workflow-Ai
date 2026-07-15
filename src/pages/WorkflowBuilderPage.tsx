import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
  Node, Edge, addEdge, useNodesState, useEdgesState,
  Controls, Background, MiniMap, Panel, BackgroundVariant,
  NodeTypes, OnConnect, Handle, Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Save, Play, Trash2, Settings, X, MessageSquare, GitBranch, Clock,
  Database, Mail, Globe, Webhook, RefreshCw, Upload, Bell, Download, Sparkles,
  CheckCircle, XCircle, Loader2, Copy, Edit2, Plus, ChevronRight,
  AlertCircle, Zap, List, Star, Tag, FileJson, ToggleLeft, ToggleRight, Archive, ArrowRight, AlertTriangle, SkipForward
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow, getWorkflows, getExecution, getLogs } from '@/services/database';
import { startExecution, cancelExecution } from '@/services/executionEngine';
import { validateWorkflow, type ValidationResult, type ValidationIssue } from '@/services/workflowValidation';
import { getDatabaseSchema } from '@/services/database';
import { supabase } from '@/lib/supabase';
import type { Workflow as WorkflowType, Execution } from '@/types';
import { format } from 'date-fns';
import { formatRelativeTime } from '@/lib/time';
import { SimulationOverlay } from '@/components/SimulationOverlay';
import { ParticleTrail } from '@/components/ParticleTrail';
import confetti from 'canvas-confetti';

// ─── Recently Opened (localStorage) ──────────────────────────────────────────
const RECENT_KEY = 'recentWorkflows';
const MAX_RECENT = 5;

function addToRecent(wf: { id: string; name: string }) {
  try {
    const stored: { id: string; name: string }[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const filtered = stored.filter(w => w.id !== wf.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([wf, ...filtered].slice(0, MAX_RECENT)));
  } catch { /* noop */ }
}

function getRecent(): { id: string; name: string }[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

// ─── Node Status Colors ───────────────────────────────────────────────────────
type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped' | 'needs_configuration';

// ─── Node Categories ──────────────────────────────────────────────────────────
const NODE_CATEGORIES = [
  { name: 'AI', nodes: [
    { type: 'ai_prompt', label: 'AI Prompt', icon: MessageSquare, color: 'bg-purple-500' },
    { type: 'decision', label: 'Decision', icon: GitBranch, color: 'bg-indigo-500' },
  ]},
  { name: 'Flow', nodes: [
    { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-blue-500' },
    { type: 'loop', label: 'Loop', icon: RefreshCw, color: 'bg-cyan-500' },
    { type: 'delay', label: 'Delay', icon: Clock, color: 'bg-amber-500' },
  ]},
  { name: 'Data', nodes: [
    { type: 'database', label: 'Database', icon: Database, color: 'bg-green-500' },
    { type: 'export', label: 'Export', icon: Download, color: 'bg-teal-500' },
    { type: 'file_upload', label: 'File Upload', icon: Upload, color: 'bg-orange-500' },
  ]},
  { name: 'Communication', nodes: [
    { type: 'email', label: 'Email', icon: Mail, color: 'bg-red-500' },
    { type: 'notification', label: 'Notification', icon: Bell, color: 'bg-pink-500' },
  ]},
  { name: 'Integration', nodes: [
    { type: 'api_call', label: 'API Call', icon: Globe, color: 'bg-gray-600' },
    { type: 'webhook', label: 'Webhook', icon: Webhook, color: 'bg-slate-600' },
  ]},
];

// ─── Custom Node ──────────────────────────────────────────────────────────────
const CustomNode = memo(function CustomNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const colorClass = (data.color as string) || 'bg-gray-500';
  
  let Icon = Sparkles;
  if (data.node_type) {
    for (const category of NODE_CATEGORIES) {
      const found = category.nodes.find(n => n.type === data.node_type);
      if (found && found.icon) {
        Icon = found.icon;
        break;
      }
    }
  }

  const label = (data.label as string) || 'Node';
  const status = (data._status as NodeStatus) || 'idle';
  const errorData = data._errorData as { message?: string, reason?: string, suggestion?: string } | undefined;

  const statusBorder =
    status === 'running' ? 'border-blue-500 shadow-blue-500/30 shadow-md' :
    status === 'success' ? 'border-green-400 shadow-green-400/20 shadow-md' :
    status === 'error'   ? 'border-red-500 shadow-red-500/30 shadow-lg ring-1 ring-red-500/50' :
    status === 'skipped' ? 'border-gray-400 border-dashed opacity-70' :
    status === 'needs_configuration' ? 'border-amber-400 shadow-amber-400/20 shadow-md' :
    selected             ? 'border-primary' : 'border-border';

  const nodeContent = (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ y: -5, scale: 1.02, boxShadow: '0 0 20px hsl(var(--primary) / 0.3)', borderColor: 'hsl(var(--primary) / 0.5)' }}
      className={`glass-card rounded-xl min-w-[200px] relative transition-all duration-300 ${statusBorder} ${status === 'running' ? 'animate-pulse' : ''} ${status === 'success' ? 'node-success' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 12, height: 12, background: 'hsl(var(--primary))', border: '2px solid hsl(var(--background))', borderRadius: '50%', left: -6 }}
      />
      <div className={`${colorClass} text-white px-3 py-2.5 rounded-t-xl flex items-center gap-2 bg-opacity-80 backdrop-blur-md`}>
        {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
        {status === 'success' && <CheckCircle className="h-3 w-3" />}
        {status === 'error'   && <AlertTriangle className="h-3 w-3 text-red-100" />}
        {status === 'skipped' && <SkipForward className="h-3 w-3" />}
        {status === 'needs_configuration' && <AlertTriangle className="h-3 w-3 text-amber-200" />}
        {status === 'idle'    && <Icon className="h-4 w-4" />}
        <span className="font-medium text-sm truncate">{label}</span>
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {(data.description as string) || configSummary(data)}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 12, height: 12, background: 'hsl(var(--primary))', border: '2px solid hsl(var(--background))', borderRadius: '50%', right: -6 }}
      />
    </motion.div>
  );

  if (status === 'error' && errorData) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{nodeContent}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[250px] border-red-500/20 bg-red-950/90 text-white shadow-xl z-50">
          <p className="font-bold mb-1 text-red-400">Execution Failed</p>
          <p className="text-sm">{errorData.message}</p>
          {errorData.suggestion && (
            <p className="text-xs mt-2 border-t border-red-500/30 pt-2 text-red-200">
              💡 {errorData.suggestion}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return nodeContent;
});

function configSummary(data: Record<string, unknown>): string {
  const cfg = (data.config as Record<string, unknown>) || {};
  const nodeType = (data.node_type as string) || '';
  switch (nodeType) {
    case 'ai_prompt':    return cfg.prompt ? `Prompt: ${String(cfg.prompt).substring(0, 55)}…` : 'Click to configure';
    case 'api_call':     return cfg.url ? `${cfg.method || 'GET'} ${String(cfg.url).substring(0, 45)}` : 'Click to configure';
    case 'condition':    return cfg.condition ? `If: ${cfg.condition}` : 'Click to configure';
    case 'delay':        return cfg.duration ? `Wait ${cfg.duration}ms` : 'Click to configure';
    case 'database':     return cfg.operation ? `${cfg.operation} on ${cfg.table || '?'}` : 'Click to configure';
    case 'email':        return cfg.to ? `To: ${cfg.to}` : 'Click to configure';
    case 'webhook':      return cfg.url ? `POST → ${String(cfg.url).substring(0, 45)}` : 'Click to configure';
    case 'notification': return cfg.title ? `"${cfg.title}"` : 'Click to configure';
    default:             return 'Click to configure';
  }
}

const nodeTypes: NodeTypes = { custom: CustomNode };

// ─── Node Config Editor ───────────────────────────────────────────────────────
const NodeConfigFields = memo(function NodeConfigFields({ nodeType, config, onChange, dbSchema = [] }: {
  nodeType: string;
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
  dbSchema?: any[];
}) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value });

  switch (nodeType) {
    case 'ai_prompt':
      return (
        <>
          <div className="space-y-2">
            <Label>Prompt <span className="text-red-500">*</span></Label>
            <Textarea value={(config.prompt as string) || ''} onChange={e => set('prompt', e.target.value)}
              placeholder="Enter AI prompt. Use ${variable} for dynamic values." rows={4} />
          </div>
          <div className="space-y-2">
            <Label>System Prompt <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea value={(config.system_prompt as string) || ''} onChange={e => set('system_prompt', e.target.value)}
              placeholder="Optional system/role instructions." rows={2} />
          </div>
        </>
      );
    case 'api_call':
      return (
        <>
          <div className="space-y-2">
            <Label>URL <span className="text-red-500">*</span></Label>
            <Input value={(config.url as string) || ''} onChange={e => set('url', e.target.value)}
              placeholder="https://api.example.com/endpoint" />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={(config.method as string) || 'GET'} onValueChange={v => set('method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Headers <span className="text-muted-foreground text-xs">(JSON)</span></Label>
            <Textarea value={typeof config.headers === 'object' ? JSON.stringify(config.headers, null, 2) : (config.headers as string) || '{}'}
              onChange={e => { try { set('headers', JSON.parse(e.target.value)); } catch { set('headers', e.target.value); } }}
              placeholder={'{\n  "Authorization": "Bearer ${token}"\n}'} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Body <span className="text-muted-foreground text-xs">(JSON, for POST/PUT/PATCH)</span></Label>
            <Textarea value={typeof config.body === 'object' ? JSON.stringify(config.body, null, 2) : (config.body as string) || ''}
              onChange={e => { try { set('body', JSON.parse(e.target.value)); } catch { set('body', e.target.value); } }}
              placeholder={'{\n  "key": "value"\n}'} rows={3} />
          </div>
        </>
      );
    case 'webhook':
      return (
        <>
          <div className="space-y-2">
            <Label>Webhook URL <span className="text-red-500">*</span></Label>
            <Input value={(config.url as string) || ''} onChange={e => set('url', e.target.value)}
              placeholder="https://hooks.example.com/webhook" />
          </div>
          <div className="space-y-2">
            <Label>Payload <span className="text-muted-foreground text-xs">(JSON, optional)</span></Label>
            <Textarea value={typeof config.payload === 'object' ? JSON.stringify(config.payload, null, 2) : (config.payload as string) || ''}
              onChange={e => { try { set('payload', JSON.parse(e.target.value)); } catch { set('payload', e.target.value); } }}
              placeholder={'{\n  "event": "trigger"\n}'} rows={3} />
          </div>
        </>
      );
    case 'condition':
      return (
        <>
          <div className="space-y-2">
            <Label>Condition Expression <span className="text-red-500">*</span></Label>
            <Input value={(config.condition as string) || ''} onChange={e => set('condition', e.target.value)}
              placeholder="e.g. ${status} == active" />
          </div>
          <p className="text-xs text-muted-foreground p-2 bg-muted rounded">
            Operators: ==, !=, &gt;, &lt;, &gt;=, &lt;=, contains, has_varName
          </p>
        </>
      );
    case 'delay':
      return (
        <div className="space-y-2">
          <Label>Duration (milliseconds) <span className="text-red-500">*</span></Label>
          <Input type="number" min={0} max={300000}
            value={(config.duration as number) || 1000}
            onChange={e => set('duration', Number(e.target.value))} />
          <p className="text-xs text-muted-foreground">
            = {((Number(config.duration) || 1000) / 1000).toFixed(1)}s · max 5 min
          </p>
        </div>
      );
    case 'database':
      return (
        <>
          <div className="space-y-2">
            <Label>Operation <span className="text-red-500">*</span></Label>
            <Select value={(config.operation as string) || 'select'} onValueChange={v => set('operation', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['select', 'insert', 'update', 'delete'].map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Table <span className="text-red-500">*</span></Label>
            {dbSchema && dbSchema.length > 0 ? (
              <Select value={(config.table as string) || ''} onValueChange={v => set('table', v)}>
                <SelectTrigger><SelectValue placeholder="Select a table" /></SelectTrigger>
                <SelectContent>
                  {dbSchema.map((t: any) => <SelectItem key={t.table_name} value={t.table_name}>{t.table_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={(config.table as string) || ''} onChange={e => set('table', e.target.value)} placeholder="e.g. workflows, tasks" />
            )}
          </div>
          {(config.operation === 'select' || !config.operation) && (
            <>
              <div className="space-y-2">
                <Label>Columns</Label>
                <Input value={(config.columns as string) || '*'} onChange={e => set('columns', e.target.value)} placeholder="*, id, name, status" />
              </div>
              <div className="space-y-2">
                <Label>Filters <span className="text-muted-foreground text-xs">(JSON)</span></Label>
                <Textarea value={typeof config.filters === 'object' ? JSON.stringify(config.filters, null, 2) : (config.filters as string) || '{}'}
                  onChange={e => { try { set('filters', JSON.parse(e.target.value)); } catch { set('filters', e.target.value); } }}
                  rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Limit</Label>
                <Input type="number" value={(config.limit as number) || 100} onChange={e => set('limit', Number(e.target.value))} />
              </div>
            </>
          )}
          {config.operation === 'insert' && (
            <div className="space-y-2">
              <Label>Record <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(JSON)</span></Label>
              <Textarea value={typeof config.record === 'object' ? JSON.stringify(config.record, null, 2) : (config.record as string) || '{}'}
                onChange={e => { try { set('record', JSON.parse(e.target.value)); } catch { set('record', e.target.value); } }}
                rows={3} />
            </div>
          )}
          {(config.operation === 'update' || config.operation === 'delete') && (
            <div className="space-y-2">
              <Label>Filters <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(JSON)</span></Label>
              <Textarea value={typeof config.filters === 'object' ? JSON.stringify(config.filters, null, 2) : (config.filters as string) || '{}'}
                onChange={e => { try { set('filters', JSON.parse(e.target.value)); } catch { set('filters', e.target.value); } }}
                rows={2} />
            </div>
          )}
          {config.operation === 'update' && (
            <div className="space-y-2">
              <Label>Updates <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(JSON)</span></Label>
              <Textarea value={typeof config.updates === 'object' ? JSON.stringify(config.updates, null, 2) : (config.updates as string) || '{}'}
                onChange={e => { try { set('updates', JSON.parse(e.target.value)); } catch { set('updates', e.target.value); } }}
                rows={2} />
            </div>
          )}
        </>
      );
    case 'email':
      return (
        <>
          <div className="space-y-2">
            <Label>To <span className="text-red-500">*</span></Label>
            <Input value={(config.to as string) || ''} onChange={e => set('to', e.target.value)} placeholder="recipient@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={(config.subject as string) || ''} onChange={e => set('subject', e.target.value)} placeholder="Subject line" />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea value={(config.body as string) || ''} onChange={e => set('body', e.target.value)}
              placeholder="Email body. Use ${variable} for dynamic values." rows={4} />
          </div>
          <p className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
            ⚠ Requires server-side SMTP integration. This node logs the email.
          </p>
        </>
      );
    case 'notification':
      return (
        <>
          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={(config.title as string) || ''} onChange={e => set('title', e.target.value)} placeholder="Notification title" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={(config.message as string) || ''} onChange={e => set('message', e.target.value)} rows={2} />
          </div>
        </>
      );
    case 'loop':
      return (
        <>
          <div className="space-y-2">
            <Label>Iterations</Label>
            <Input type="number" min={1} max={100} value={(config.iterations as number) || 1} onChange={e => set('iterations', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Items context key <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={(config.items as string) || ''} onChange={e => set('items', e.target.value)} placeholder="e.g. db_rows" />
          </div>
        </>
      );
    case 'export':
      return (
        <>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={(config.format as string) || 'json'} onValueChange={v => set('format', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['json', 'csv'].map(f => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data key <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={(config.data_key as string) || ''} onChange={e => set('data_key', e.target.value)} placeholder="Leave blank for full context" />
          </div>
        </>
      );
    case 'decision':
      return (
        <>
          <div className="space-y-2">
            <Label>Condition</Label>
            <Input value={(config.condition as string) || ''} onChange={e => set('condition', e.target.value)} placeholder="e.g. ${status} == approved" />
          </div>
          <div className="space-y-2">
            <Label>True branch label</Label>
            <Input value={(config.true_label as string) || 'approved'} onChange={e => set('true_label', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>False branch label</Label>
            <Input value={(config.false_label as string) || 'rejected'} onChange={e => set('false_label', e.target.value)} />
          </div>
        </>
      );
    default:
      return <p className="text-sm text-muted-foreground">No configuration needed for this node type.</p>;
  }
});

// ─── Main Page ────────────────────────────────────────────────────────────────
export function WorkflowBuilderPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Canvas state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Workflow meta
  const [workflowId, setWorkflowId] = useState<string | null>(id || null);
  const [name, setName] = useState('New Workflow');
  const [description, setDescription] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [myWorkflows, setMyWorkflows] = useState<WorkflowType[]>([]);
  
  // Validation & Optimization
  const [healthScore, setHealthScore] = useState(100);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const [validationReport, setValidationReport] = useState<ValidationResult | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [dbSchema, setDbSchema] = useState<any[]>([]);

  // Advanced workflow meta
  const [isFavorite, setIsFavorite] = useState(false);
  const [workflowTags, setWorkflowTags] = useState<string[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'active' | 'archived' | 'needs_configuration'>('draft');
  const [recentWorkflows, setRecentWorkflows] = useState(getRecent());
  const [tagInput, setTagInput] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  // Execution tracking
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStepName, setCurrentStepName] = useState('');
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedNodesRef = useRef<string>('');

  const { confirmLeave } = useUnsavedChanges(isDirty);

  // ── Load workflow ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Load schema
    getDatabaseSchema().then(setDbSchema).catch(console.error);
    
    if (id && id !== 'new') {
      loadWorkflow(id);
    } else if (location.state?.template) {
      const t = location.state.template;
      setName(`${t.name} (Copy)`);
      setDescription(t.description);
      const loadedNodes = t.nodes.map((n: any) => ({
        id: n.id, type: 'custom', position: n.position, data: n.data
      })) as Node[];
      setNodes(loadedNodes);
      setEdges(t.edges as Edge[]);
      setIsDirty(true); // they need to save it to persist
    }
  }, [id]);

  const loadWorkflow = async (wfId: string) => {
    console.log('[loadWorkflow] Starting load for ID:', wfId);
    try {
      const workflow = await getWorkflow(wfId);
      console.log('[loadWorkflow] getWorkflow result:', workflow ? 'found' : 'not found');
      if (workflow) {
        setName(workflow.name);
        setDescription(workflow.description || '');
        setCreatedAt(new Date(workflow.created_at));
        setLastSavedAt(new Date(workflow.updated_at));
        
        console.log('[loadWorkflow] parsing nodes...');
        const rawNodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
        const loadedNodes = rawNodes.map((n: any) => ({
          id: n.id, type: 'custom', position: n.position, data: n.data
        })) as Node[];
        setNodes(loadedNodes);
        
        console.log('[loadWorkflow] parsing edges...');
        const rawEdges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : (workflow.edges || []);
        setEdges(rawEdges as Edge[]);
        setWorkflowId(wfId);
        
        const vars = (workflow.variables as any) || {};
        setIsFavorite(vars.is_favorite || false);
        setWorkflowTags(vars.tags || []);
        setWorkflowStatus((workflow.status as 'draft' | 'active' | 'archived' | 'needs_configuration') || 'draft');
        setIsDirty(false);
        savedNodesRef.current = JSON.stringify(loadedNodes);
        
        console.log('[loadWorkflow] updating recents...');
        addToRecent({ id: wfId, name: workflow.name });
        setRecentWorkflows(getRecent());
        console.log('[loadWorkflow] finished successfully.');
      }
    } catch (error: any) {
      console.error('[loadWorkflow] Failed to load workflow:', error);
      let msg = 'Failed to load workflow';
      if (error?.message) {
        msg = error.message;
      } else if (typeof error === 'string') {
        msg = error;
      }
      toast({ title: 'Error loading workflow', description: msg, variant: 'destructive' });
    }
  };

  // ── Load workflow list ─────────────────────────────────────────────────────
  const loadMyWorkflows = async () => {
    if (!user?.id) return;
    setLoadingWorkflows(true);
    try {
      const list = await getWorkflows(user.id);
      setMyWorkflows(list);
    } catch { /* noop */ }
    setLoadingWorkflows(false);
  };

  useEffect(() => {
    if (showWorkflowList) loadMyWorkflows();
  }, [showWorkflowList, user?.id]);

  // ── Mark dirty when canvas changes ────────────────────────────────────────
  useEffect(() => {
    if (savedNodesRef.current && JSON.stringify(nodes) !== savedNodesRef.current) {
      setIsDirty(true);
    }
  }, [nodes]);

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Duplicate Node: Ctrl + D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNode) {
        e.preventDefault();
        handleDuplicateNode(selectedNode);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, nodes, edges, name, description]); // Dependencies needed for handleSave to have fresh state

  // ── Advanced Handlers ───────────────────────────────────────────────────────
  const handleExport = () => {
    const data = {
      name, description, tags: workflowTags, status: workflowStatus,
      nodes, edges
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Workflow exported successfully' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        if (data.nodes && data.edges) {
          setName(data.name || 'Imported Workflow');
          setDescription(data.description || '');
          setWorkflowTags(data.tags || []);
          setWorkflowStatus(data.status || 'draft');
          setNodes(data.nodes);
          setEdges(data.edges);
          setIsDirty(true);
          toast({ title: 'Workflow imported successfully' });
        } else {
          throw new Error('Invalid format');
        }
      } catch (err) {
        toast({ title: 'Failed to import', description: 'Invalid workflow file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const toggleFavorite = async () => {
    const newValue = !isFavorite;
    setIsFavorite(newValue);
    if (workflowId) {
      try {
        await updateWorkflow(workflowId, { variables: { tags: workflowTags, is_favorite: newValue } });
        toast({ title: newValue ? 'Added to favorites' : 'Removed from favorites' });
      } catch {
        setIsFavorite(!newValue);
        toast({ title: 'Failed to update', variant: 'destructive' });
      }
    }
  };

  const toggleStatus = async () => {
    const newStatus = workflowStatus === 'active' ? 'draft' : 'active';
    setWorkflowStatus(newStatus);
    if (workflowId) {
      try {
        await updateWorkflow(workflowId, { status: newStatus });
        toast({ title: `Workflow marked as ${newStatus}` });
      } catch {
        setWorkflowStatus(workflowStatus);
        toast({ title: 'Failed to update status', variant: 'destructive' });
      }
    }
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      if (!workflowTags.includes(tagInput.trim())) {
        const newTags = [...workflowTags, tagInput.trim()];
        setWorkflowTags(newTags);
        setIsDirty(true);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setWorkflowTags(workflowTags.filter(t => t !== tagToRemove));
    setIsDirty(true);
  };

  const handleDuplicateNode = (node: Node) => {
    const newNode: Node = {
      ...node,
      id: `node-${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data, label: `${node.data.label} (Copy)` }
    };
    setNodes(nds => [...nds, newNode]);
    setIsDirty(true);
    toast({ title: 'Node duplicated' });
  };

  // ── Validation Engine ───────────────────────────────────────────────────────
  useEffect(() => {

    // Check configs using central validation engine
    const result = validateWorkflow(nodes as any, edges as any);
    
    setValidationErrors(result.errors);
    const calculatedScore = 100 - (result.errors.length * 15) - (result.warnings.length * 5);
    setHealthScore(Math.max(0, calculatedScore));
  }, [nodes, edges]);

  // ── Optimize Workflow ───────────────────────────────────────────────────────
  const handleOptimizeWorkflow = async () => {
    setIsOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-api', {
        body: {
          action: 'optimize',
          payload: {
            workflow: { nodes, edges }
          }
        }
      });
      if (error) throw error;

      if (data && data.text) {
        const jsonMatch = data.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const optimized = JSON.parse(jsonMatch[0]);
          if (optimized.nodes && optimized.edges) {
            setNodes(optimized.nodes);
            setEdges(optimized.edges);
            setIsDirty(true);
            toast({ title: '✨ Workflow optimized successfully!' });
          }
        } else {
           // Basic Layout fallback if AI fails
           setNodes(nds => nds.map((n, i) => ({ ...n, position: { x: 250, y: 150 * i + 100 } })));
           toast({ title: '✨ Auto-layout applied' });
        }
      }
    } catch (err) {
      // Basic layout fallback
      setNodes(nds => nds.map((n, i) => ({ ...n, position: { x: 250, y: 150 * i + 100 } })));
      setIsDirty(true);
      toast({ title: '✨ Auto-layout applied (Fallback)' });
    }
    setIsOptimizing(false);
  };

  // ── Autosave every 30s if dirty and saved before ──────────────────────────
  useEffect(() => {
    autosaveRef.current = setInterval(() => {
      if (isDirty && workflowId && !saving) {
        performSave(true);
      }
    }, 30_000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
  }, [isDirty, workflowId, saving, nodes, edges, name, description]);

  // ── Execution elapsed timer ────────────────────────────────────────────────
  useEffect(() => {
    if (executing) {
      setElapsedSeconds(0);
      elapsedRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [executing]);

  // ── Real-time execution updates via Polling (Fallback for disabled Realtime) ───
  useEffect(() => {
    if (!executionId || !executing) return;

    let mounted = true;
    let lastLogCount = 0;

    const poll = async () => {
      try {
        const [exec, logs] = await Promise.all([
          getExecution(executionId),
          getLogs(executionId)
        ]);
        
        if (!mounted || !exec) return;

        setExecutionStatus(exec.status);

        // Process new logs
        if (logs && logs.length > lastLogCount) {
          const newLogs = logs.slice(lastLogCount);
          lastLogCount = logs.length;
          
          let updatedNodes = false;
          const nodeUpdatesByLabel: Record<string, { status: NodeStatus, errorData?: any }> = {};
          
          for (const log of newLogs) {
            const runMatch = log.message.match(/Running node: (.+?) \(/);
            const doneMatch = log.message.match(/✓ (.+?) completed/);
            const failMatch = log.message.match(/✗ (.+?) failed/);
            
            if (runMatch) { 
              nodeUpdatesByLabel[runMatch[1]] = { status: 'running' }; 
              updatedNodes = true; 
              setCurrentStepName(runMatch[1]);
            }
            else if (doneMatch) { nodeUpdatesByLabel[doneMatch[1]] = { status: 'success' }; updatedNodes = true; }
            else if (failMatch) { nodeUpdatesByLabel[failMatch[1]] = { status: 'error', errorData: log.metadata?.issue || log.metadata }; updatedNodes = true; }
          }
          
          if (updatedNodes) {
            setNodes(nds => {
              const nodeUpdatesById: Record<string, { status: NodeStatus, errorData?: any }> = {};
              
              const nextNodes = nds.map(n => {
                const label = n.data.label as string;
                if (nodeUpdatesByLabel[label]) {
                  const update = nodeUpdatesByLabel[label];
                  nodeUpdatesById[n.id] = update;
                  
                  if (update.status === 'success') {
                    setTimeout(() => {
                      setNodes(currentNodes => currentNodes.map(cn => cn.id === n.id && cn.data._status === 'success' ? { ...cn, data: { ...cn.data, _status: 'idle' } } : cn));
                    }, 2000);
                  }
                  
                  return { ...n, data: { ...n.data, _status: update.status, _errorData: update.errorData || undefined } };
                }
                return n;
              });

              setEdges(eds => eds.map(e => {
                if (nodeUpdatesById[e.target]) {
                  const targetStatus = nodeUpdatesById[e.target].status;
                  if (targetStatus === 'running') return { ...e, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } };
                  if (targetStatus === 'success' || targetStatus === 'error') return { ...e, animated: false, style: {} };
                }
                return e;
              }));

              return nextNodes;
            });
          }
        }

        if (exec.status === 'completed' || exec.status === 'failed' || exec.status === 'cancelled') {
          setExecuting(false);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          setNodeStatuses({});
          
          // Reset all transient running edges and nodes (except failed nodes which remain red)
          setCurrentStepName('');
          setEdges(eds => eds.map(e => ({ ...e, animated: false, style: {} })));
          setNodes(nds => nds.map(n => {
            if (n.data._status === 'running') {
              return { ...n, data: { ...n.data, _status: 'idle' } };
            }
            return n;
          }));          
          if (exec.status === 'completed') {
            toast({ title: '✓ Workflow completed successfully!' });
            // Success Confetti!
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']
            });
          } else if (exec.status === 'failed') {
            let errorMsg = exec.error_message || undefined;
            try {
              if (errorMsg) {
                const parsed = JSON.parse(errorMsg);
                if (parsed?.message) errorMsg = parsed.message;
              }
            } catch (e) {
              // Ignore
            }
            toast({ title: '❌ Workflow execution failed', description: errorMsg, variant: 'destructive' });
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const intervalId = setInterval(poll, 1000);
    poll(); // Initial fetch

    return () => { 
      mounted = false;
      clearInterval(intervalId); 
    };
  }, [executionId, executing, setNodes, toast]);

  // ── Connection ────────────────────────────────────────────────────────────
    const onConnect: OnConnect = useCallback(params =>
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: 'hsl(var(--primary))' } }, eds)),
    [setEdges]
  );

  // Apply edge executing class dynamically based on execution state
  useEffect(() => {
    if (executing) {
      setEdges(eds => eds.map(e => ({ ...e, className: 'edge-executing' })));
    } else {
      setEdges(eds => eds.map(e => ({ ...e, className: '' })));
    }
  }, [executing, setEdges]);

  // ── Add node ──────────────────────────────────────────────────────────────
  const addNode = useCallback((nodeInfo: { type: string; label: string; icon: typeof MessageSquare; color: string }) => {
    setNodes(nds => {
      const offset = (nds.length % 10) * 20;
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'custom',
        position: { x: 100 + offset, y: 150 + offset },
        data: { label: nodeInfo.label, icon: nodeInfo.icon, color: nodeInfo.color, node_type: nodeInfo.type, description: '', config: {} }
      };
      return [...nds, newNode];
    });
    setIsDirty(true);
  }, [setNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeEditor(true);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const performSave = async (isAutosave = false) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      let currentStatus = workflowStatus;
      if (currentStatus === 'needs_configuration') {
        const valReport = validateWorkflow(nodes as any, edges as any);
        if (!valReport.needsConfiguration) {
          currentStatus = 'draft';
          setWorkflowStatus('draft');
        }
      }

      const workflowData = {
        user_id: user.id,
        agent_id: null as null,
        name,
        description,
        prompt: null as null,
        nodes: nodes.map(n => ({ id: n.id, type: 'custom', position: n.position, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined })),
        variables: { tags: workflowTags, is_favorite: isFavorite },
        status: currentStatus as 'draft' | 'active' | 'archived' | 'needs_configuration',
        is_template: false
      };

      let currentId = workflowId;
      if (currentId === 'new') currentId = null;

      if (currentId) {
        await updateWorkflow(currentId, { name, description, nodes: workflowData.nodes, edges: workflowData.edges, variables: workflowData.variables, status: workflowData.status });
      } else {
        const created = await createWorkflow(workflowData);
        currentId = created.id;
        setWorkflowId(created.id);
        setCreatedAt(new Date(created.created_at));
        navigate(`/workflows/${created.id}`, { replace: true });
      }

      const now = new Date();
      setLastSavedAt(now);
      savedNodesRef.current = JSON.stringify(nodes);
      setIsDirty(false);

      if (!isAutosave) {
        toast({ title: '✓ Workflow saved', description: name });
        if (showWorkflowList) loadMyWorkflows();
      }
    } catch (error: any) {
      console.error('Workflow save error:', error);
      let msg = 'Unknown error';
      if (error?.message) {
        msg = error.message;
      } else if (typeof error === 'string') {
        msg = error;
      } else if (error && typeof error === 'object') {
        msg = JSON.stringify(error);
      }
      toast({ title: 'Failed to save', description: msg, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSave = () => performSave(false);

  // ── Validate ────────────────────────────────────────────────────────────────
  const handleValidate = (skipDialogIfValid = false) => {
    const report = validateWorkflow(nodes as any, edges as any);
    setValidationReport(report);
    if (!report.valid || !skipDialogIfValid || report.warnings.length > 0) {
      setShowValidationDialog(true);
    }
    return report;
  };

  // ── Execute ───────────────────────────────────────────────────────────────
  const proceedWithExecution = async () => {
    if (!user?.id || !workflowId) return;
    
    if (isDirty) {
      toast({ title: 'Saving before execution…' });
      await performSave(true);
    }
    setExecuting(true);
    setNodeStatuses({});
    // Reset all node statuses
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, _status: 'idle' as NodeStatus } })));
    try {
      const workflow = await getWorkflow(workflowId);
      if (!workflow) throw new Error('Workflow not found');
      const execution = await startExecution(user.id, workflow);
      setExecutionId(execution.id);
      setExecutionStatus('running');
      toast({ title: '▶ Execution started', description: 'Check the node status indicators.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Failed to start execution', description: msg, variant: 'destructive' });
      setExecuting(false);
    }
  };

  const handleExecute = () => {
    if (!user?.id) return;
    if (!workflowId) {
      toast({ title: 'Save the workflow first before running it', variant: 'destructive' });
      return;
    }
    
    const report = handleValidate(true);
    if (report.needsConfiguration) {
      toast({ 
        title: 'Configuration Needed', 
        description: 'This workflow has unconfigured settings that need your input before it can run.', 
        variant: 'destructive' 
      });
      return;
    }
    if (!report.valid) {
      toast({ title: 'Validation failed', description: 'Please fix the errors before executing.', variant: 'destructive' });
      return;
    }
    
    // If valid but has warnings, handleValidate already opened the dialog, so we stop here.
    // The user can click "Execute Anyway" in the dialog to call proceedWithExecution.
    if (report.warnings.length > 0) {
      return;
    }

    // No errors, no warnings -> run immediately
    proceedWithExecution();
  };

  // ── Delete selected nodes ─────────────────────────────────────────────────
  const deleteSelectedNodes = () => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    setSelectedNode(null);
    setShowNodeEditor(false);
    setIsDirty(true);
  };

  // ── Duplicate workflow ────────────────────────────────────────────────────
  const handleCancelExecution = async () => {
    if (!executionId) return;
    try {
      await cancelExecution(executionId);
      toast({ title: 'Execution cancelling...' });
    } catch (e: any) {
      toast({ title: 'Failed to cancel', description: e.message, variant: 'destructive' });
    }
  };

  const handleDuplicate = async () => {
    if (!user?.id) return;
    try {
      const copy = await createWorkflow({
        user_id: user.id, agent_id: null,
        name: `${name} (copy)`, description,
        prompt: null,
        nodes: nodes.map(n => ({ id: n.id, type: 'custom', position: n.position, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
        variables: {}, status: 'draft', is_template: false
      });
      toast({ title: 'Workflow duplicated', description: copy.name });
      navigate(`/workflows/${copy.id}`);
    } catch {
      toast({ title: 'Failed to duplicate', variant: 'destructive' });
    }
  };

  // ── Delete workflow ───────────────────────────────────────────────────────
  const handleDeleteWorkflow = async () => {
    if (!workflowId) return;
    try {
      await deleteWorkflow(workflowId);
      toast({ title: 'Workflow deleted' });
      navigate('/');
    } catch {
      toast({ title: 'Failed to delete workflow', variant: 'destructive' });
    }
    setShowDeleteConfirm(false);
  };

  // ── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!renameDraft.trim()) return;
    setName(renameDraft.trim());
    setIsDirty(true);
    setShowRenameDialog(false);
    if (workflowId) {
      try {
        await updateWorkflow(workflowId, { name: renameDraft.trim() });
        toast({ title: 'Workflow renamed' });
      } catch {
        toast({ title: 'Failed to rename', variant: 'destructive' });
      }
    }
  };

  // ── Node updates ──────────────────────────────────────────────────────────
  const updateNodeConfig = useCallback((cfg: Record<string, unknown>) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, config: cfg } } : n));
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, config: cfg } } : prev);
    setIsDirty(true);
  }, [selectedNode, setNodes]);

  const updateNodeField = useCallback((field: string, value: string) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, [field]: value } } : n));
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [field]: value } } : prev);
    setIsDirty(true);
  }, [selectedNode, setNodes]);

  const selectedNodeType = selectedNode
    ? ((selectedNode.data.node_type as string) || (selectedNode.data.type as string) || '')
    : '';

  const formatElapsed = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-8rem)] flex flex-col">

        {/* Top Bar */}
        <div className="flex items-center gap-3 px-4 py-2 glass-panel border-b-0 z-20 shadow-sm relative">
          {/* Workflow name + save status */}
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={toggleFavorite} className="text-muted-foreground hover:text-yellow-500 transition-colors shrink-0">
              <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            </button>
            <h2 className="text-base font-semibold truncate max-w-[200px]" title={name}>{name}</h2>
            <button
              onClick={() => { setRenameDraft(name); setShowRenameDialog(true); }}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Rename workflow"
            >
              <Edit2 className="h-3 w-3" />
            </button>
          </div>

          <Badge variant={isDirty ? 'destructive' : 'secondary'} className="text-xs shrink-0">
            {saving ? (
              <><Loader2 className="h-2 w-2 mr-1 animate-spin" />Saving…</>
            ) : isDirty ? (
              <><AlertCircle className="h-2 w-2 mr-1" />Unsaved changes</>
            ) : lastSavedAt ? (
              <><CheckCircle className="h-2 w-2 mr-1" />Saved {formatRelativeTime(lastSavedAt)}</>
            ) : (
              'Not saved'
            )}
          </Badge>

          {lastSavedAt && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              Last edited: {format(lastSavedAt, 'MMM d, h:mm a')}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => { setShowWorkflowList(true); }}>
                  <List className="h-4 w-4 mr-1" />My Workflows
                </Button>
              </TooltipTrigger>
              <TooltipContent>View all your workflows</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant={workflowStatus === 'active' ? 'default' : 'outline'} onClick={toggleStatus}>
                  {workflowStatus === 'active' ? <ToggleRight className="h-4 w-4 mr-1" /> : <ToggleLeft className="h-4 w-4 mr-1" />}
                  {workflowStatus === 'active' ? 'Active' : 'Inactive'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle workflow active status</TooltipContent>
            </Tooltip>

            <input type="file" ref={importInputRef} accept=".json" onChange={handleImport} className="hidden" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import workflow (JSON)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleExport} disabled={!workflowId && !isDirty}>
                  <FileJson className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export workflow (JSON)</TooltipContent>
            </Tooltip>

            {/* Validation & Optimize */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className={`gap-1 ${healthScore === 100 ? 'text-green-500' : healthScore > 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                   {healthScore === 100 ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                   {healthScore}%
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p className="font-semibold mb-1">Health Score</p>
                  {validationErrors.length === 0 ? 'All nodes configured properly.' : (
                    <ul className="list-disc pl-4 text-xs text-red-300">
                      {validationErrors.map((err, i) => <li key={i}>{err.nodeName}: {err.message}</li>)}
                    </ul>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleOptimizeWorkflow} disabled={isOptimizing}>
                  {isOptimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-purple-500" />}
                  <span className="ml-1 hidden md:inline">Optimize</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Auto-layout & Validation</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={!workflowId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate workflow</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setShowDeleteConfirm(true)} disabled={!workflowId}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete workflow</TooltipContent>
            </Tooltip>

            <Button size="sm" variant="secondary" onClick={() => handleValidate()}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Validate
            </Button>

            <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>

            <Button size="sm" variant="default" onClick={handleExecute} disabled={executing}>
              {executing
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{formatElapsed(elapsedSeconds)}</>
                : <><Play className="h-4 w-4 mr-1" />Run</>}
            </Button>
          </div>
        </div>

        {/* Execution Banner */}
        <AnimatePresence>
          {executing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-2 flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="font-medium text-blue-600 dark:text-blue-400">Execution running</span>
                {currentStepName && (
                  <span className="text-muted-foreground border-l border-white/20 pl-3">
                    Current: <strong className="text-foreground">{currentStepName}</strong>
                  </span>
                )}
                <span className="text-muted-foreground border-l border-white/20 pl-3">Elapsed: {formatElapsed(elapsedSeconds)}</span>
              </div>
              <Button size="sm" variant="destructive" onClick={handleCancelExecution} className="h-7 text-xs">
                Cancel
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main canvas area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Node sidebar */}
          <div className="w-56 glass-panel border-r-0 p-3 flex flex-col overflow-y-auto shrink-0 z-10 shadow-xl">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Add Nodes</h3>
            {NODE_CATEGORIES.map(category => (
              <div key={category.name} className="mb-3">
                <p className="text-xs text-muted-foreground uppercase mb-1">{category.name}</p>
                <div className="space-y-0.5">
                  {category.nodes.map(nodeInfo => (
                    <button
                      key={nodeInfo.type}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors text-sm text-left"
                      onClick={() => addNode(nodeInfo)}
                    >
                      <div className={`${nodeInfo.color} p-1 rounded`}>
                        <nodeInfo.icon className="h-3 w-3 text-white" />
                      </div>
                      {nodeInfo.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ReactFlow canvas */}
          <div className="flex-1 relative w-full h-full min-h-[400px]">
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="text-center opacity-40">
                  <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium">Your canvas is empty</p>
                  <p className="text-sm text-muted-foreground">Add nodes from the left panel to build your workflow</p>
                </div>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={changes => { onNodesChange(changes); }}
              onEdgesChange={changes => { onEdgesChange(changes); setIsDirty(true); }}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode="Delete"
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              <Controls />
              <MiniMap />
              <Panel position="top-right" className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Workflow settings</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={deleteSelectedNodes} disabled={!nodes.some(n => n.selected)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete selected nodes (Del)</TooltipContent>
                </Tooltip>
              </Panel>
            </ReactFlow>
            <SimulationOverlay executing={executing} />
          </div>

          {/* Node config panel */}
          <AnimatePresence>
            {showNodeEditor && selectedNode && (
              <motion.div
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-80 glass-panel border-l-0 flex flex-col overflow-hidden shrink-0 z-10 shadow-2xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div>
                    <h3 className="font-semibold text-sm">Configure Node</h3>
                    <p className="text-xs text-muted-foreground capitalize">{selectedNodeType.replace(/_/g, ' ')}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setShowNodeEditor(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Node Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={(selectedNode.data.label as string) || ''}
                        onChange={e => updateNodeField('label', e.target.value)}
                        placeholder="Give this node a name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description <span className="text-muted-foreground text-xs">(shown on canvas)</span></Label>
                      <Textarea
                        value={(selectedNode.data.description as string) || ''}
                        onChange={e => updateNodeField('description', e.target.value)}
                        placeholder="What does this node do?"
                        rows={2}
                      />
                    </div>
                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      {selectedNodeType.replace(/_/g, ' ')} Settings
                    </p>
                    <NodeConfigFields
                      nodeType={selectedNodeType}
                      config={(selectedNode.data.config as Record<string, unknown>) || {}}
                      onChange={updateNodeConfig}
                      dbSchema={dbSchema}
                    />
                    <Separator />
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="continueOnFail"
                        checked={!!((selectedNode.data.config as any)?.continueOnFail)}
                        onChange={(e) => updateNodeConfig({ ...((selectedNode.data.config as any) || {}), continueOnFail: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="continueOnFail" className="text-sm cursor-pointer">
                        Continue on fail
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      If enabled, execution will proceed even if this node fails.
                    </p>
                    <Separator />
                    <Button variant="destructive" size="sm" className="w-full"
                      onClick={() => { deleteSelectedNodes(); }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Node
                    </Button>
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Dialogs ─────────────────────────────────────────────────────── */}

        {/* Workflow Settings */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Workflow Settings</DialogTitle>
              <DialogDescription>Configure workflow metadata</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input value={name} onChange={e => { setName(e.target.value); setIsDirty(true); }} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => { setDescription(e.target.value); setIsDirty(true); }} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {workflowTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 px-2">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder="Type a tag and press Enter"
                />
              </div>
              {createdAt && (
                <p className="text-xs text-muted-foreground">Created: {format(createdAt, 'PPP p')}</p>
              )}
              {lastSavedAt && (
                <p className="text-xs text-muted-foreground">Last saved: {format(lastSavedAt, 'PPP p')}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => { setShowSettings(false); }}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Workflow</DialogTitle>
            </DialogHeader>
            <Input
              value={renameDraft}
              onChange={e => setRenameDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
              <Button onClick={handleRename} disabled={!renameDraft.trim()}>Rename</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the workflow and all its execution history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteWorkflow}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* My Workflows Panel */}
        <Dialog open={showWorkflowList} onOpenChange={setShowWorkflowList}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>My Workflows</DialogTitle>
              <DialogDescription>Click to open a workflow in the builder</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <Button size="sm" variant="outline" onClick={() => { navigate('/workflows/builder'); setShowWorkflowList(false); }}>
                <Plus className="h-4 w-4 mr-1" /> New Workflow
              </Button>
              <Button size="sm" variant="ghost" onClick={loadMyWorkflows}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="h-80">
              {loadingWorkflows ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : myWorkflows.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No workflows yet</p>
                  <p className="text-sm">Create your first workflow above.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {myWorkflows.map(wf => (
                    <button
                      key={wf.id}
                      onClick={() => { navigate(`/workflows/${wf.id}`); setShowWorkflowList(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left group ${wf.id === workflowId ? 'bg-muted' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{wf.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Edited {formatRelativeTime(wf.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={`text-xs ${wf.status === 'needs_configuration' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : ''}`}>
                          {wf.status === 'needs_configuration' ? 'Needs Setup' : wf.status}
                        </Badge>
                        {wf.nodes?.length > 0 && (
                          <span className="text-xs text-muted-foreground">{wf.nodes.length} nodes</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
        {/* Validation Dialog */}
        <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {validationReport?.valid ? (
                  <><CheckCircle className="h-5 w-5 text-green-500" /> Workflow is Valid</>
                ) : (
                  <><AlertCircle className="h-5 w-5 text-red-500" /> EXECUTION BLOCKED</>
                )}
              </DialogTitle>
              <DialogDescription>
                Review the validation report before executing this workflow.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-2">
                {validationReport?.errors && validationReport.errors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-500 mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" /> Errors ({validationReport.errors.length})
                    </h3>
                    <div className="space-y-2">
                      {validationReport.errors.map((err, i) => (
                        <div key={i} 
                             className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm cursor-pointer hover:bg-red-500/20 transition-colors"
                             onClick={() => {
                               setShowValidationDialog(false);
                               const n = nodes.find(node => node.id === err.nodeId);
                               if (n) { setSelectedNode(n); setShowNodeEditor(true); }
                             }}>
                          <div className="font-medium text-red-600 dark:text-red-400">{err.nodeName}</div>
                          <div>{err.message}</div>
                          {err.suggestion && <div className="mt-1 text-red-500 font-medium">💡 Suggestion: {err.suggestion}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {validationReport?.warnings && validationReport.warnings.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-500 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Warnings ({validationReport.warnings.length})
                    </h3>
                    <div className="space-y-2">
                      {validationReport.warnings.map((warn, i) => (
                        <div key={i} 
                             className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm cursor-pointer hover:bg-yellow-500/20 transition-colors"
                             onClick={() => {
                               setShowValidationDialog(false);
                               const n = nodes.find(node => node.id === warn.nodeId);
                               if (n) { setSelectedNode(n); setShowNodeEditor(true); }
                             }}>
                          <div className="font-medium text-yellow-600 dark:text-yellow-400">{warn.nodeName}</div>
                          <div>{warn.message}</div>
                          {warn.suggestion && <div className="mt-1 text-yellow-600 font-medium">💡 Suggestion: {warn.suggestion}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validationReport?.valid && validationReport.warnings.length === 0 && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md text-green-600 dark:text-green-400 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5" />
                    <div>
                      <div className="font-medium">READY TO EXECUTE</div>
                      <div className="text-sm opacity-90">All checks passed! The workflow is ready for execution.</div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowValidationDialog(false)}>
                Close
              </Button>
              {validationReport?.valid && (
                <Button onClick={() => {
                  setShowValidationDialog(false);
                  proceedWithExecution();
                }}>
                  {validationReport.warnings.length > 0 ? "Run Anyway" : "Run"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
