import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle, XCircle, AlertTriangle, Clock, Copy, Check,
  ChevronRight, Activity, Minus, SkipForward, ExternalLink, FileOutput
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { Execution } from '@/types';

// ─── Types matching execution engine report contract ──────────────────────────

interface NodeResult {
  id: string;
  name: string;
  type: string;
  status: 'success' | 'failed' | 'skipped' | 'cancelled';
  startTime?: string;
  endTime?: string;
  inputs?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  ignored?: boolean;
}

interface ExecutionReport {
  nodes: NodeResult[];
  startTime?: string;
  endTime?: string;
  totalNodes?: number;
  executedNodes?: number;
  failedNodes?: number;
  finalOutput?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNodeOutputLabel(nodeType: string): string {
  switch (nodeType) {
    case 'ai_prompt':
    case 'ai':
      return 'AI RESULT';
    case 'api_call':
    case 'api':
    case 'webhook':
      return 'RESPONSE BODY';
    case 'email':
      return 'EMAIL RESULT';
    case 'notification':
      return 'NOTIFICATION RESULT';
    case 'database':
    case 'db':
      return 'DATABASE RESULT';
    case 'condition':
    case 'decision':
      return 'BRANCH DECISION';
    case 'loop':
      return 'LOOP RESULT';
    case 'export':
      return 'EXPORT RESULT';
    case 'delay':
      return 'DELAY RESULT';
    default:
      return 'OUTPUT DATA';
  }
}

function durationMs(start?: string, end?: string): string {
  if (!start || !end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/60"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-green-500">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ─── ReadableObject ───────────────────────────────────────────────────────────

function ReadableObject({ data }: { data: Record<string, unknown> | unknown[] }) {
  if (Array.isArray(data)) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground mb-1">Array ({data.length} items)</p>
        {data.slice(0, 20).map((item, i) => (
          <div key={i} className="flex gap-2 text-xs border-b last:border-0 pb-1">
            <span className="text-muted-foreground/60 shrink-0 w-6 text-right">[{i}]</span>
            <span className="font-mono break-all">{typeof item === 'object' ? JSON.stringify(item) : String(item)}</span>
          </div>
        ))}
        {data.length > 20 && <p className="text-xs text-muted-foreground">… {data.length - 20} more items</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex flex-col sm:flex-row sm:gap-3 border-b last:border-0 pb-1 text-xs">
          <span className="font-semibold text-muted-foreground min-w-[120px] shrink-0">{key}</span>
          <span className="font-mono break-all">
            {val === null
              ? <span className="italic opacity-50">null</span>
              : val === undefined
              ? <span className="italic opacity-50">undefined</span>
              : typeof val === 'object'
              ? JSON.stringify(val)
              : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── OutputBlock ──────────────────────────────────────────────────────────────

function OutputBlock({ label, data, showCopy = true }: { label: string; data: unknown; showCopy?: boolean }) {
  const [view, setView] = useState<'readable' | 'json'>('readable');

  if (data === null || data === undefined) {
    return (
      <div className="mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xs text-muted-foreground italic px-2 py-1.5 bg-muted/20 rounded border border-dashed">
          No output produced.
        </p>
      </div>
    );
  }

  const isText = typeof data === 'string';
  const isObject = typeof data === 'object' && !isText;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1">
          {isObject && (
            <>
              <button
                onClick={() => setView('readable')}
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded transition-colors',
                  view === 'readable' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Readable
              </button>
              <button
                onClick={() => setView('json')}
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded transition-colors',
                  view === 'json' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                JSON
              </button>
            </>
          )}
          {showCopy && <CopyButton value={data} />}
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 overflow-hidden">
        <ScrollArea className="max-h-[280px] w-full">
          <div className="p-3">
            {isText ? (
              <p className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">{data as string}</p>
            ) : view === 'json' || !isObject ? (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
            ) : (
              <ReadableObject data={data as Record<string, unknown>} />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── NodeOutputRow ────────────────────────────────────────────────────────────

function NodeOutputRow({ node, index }: { node: NodeResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const isFailed = node.status === 'failed';
  const isSkipped = node.status === 'skipped' || node.status === 'cancelled';
  const isWarning = isFailed && node.ignored;
  const isSuccess = node.status === 'success';

  let borderClass = 'border-green-500/40';
  let bgClass = 'bg-green-500/5';
  let badgeVariant: 'default' | 'destructive' | 'secondary' | 'outline' = 'default';
  let statusLabel: string = node.status;

  if (isWarning) {
    borderClass = 'border-yellow-500/40';
    bgClass = 'bg-yellow-500/5';
    badgeVariant = 'outline';
    statusLabel = 'failed (continued)';
  } else if (isFailed) {
    borderClass = 'border-red-500/40';
    bgClass = 'bg-red-500/5';
    badgeVariant = 'destructive';
  } else if (isSkipped) {
    borderClass = 'border-muted/60 border-dashed';
    bgClass = 'bg-muted/10';
    badgeVariant = 'secondary';
  }

  const outputLabel = getNodeOutputLabel(node.type);

  return (
    <div className={cn('rounded-lg border overflow-hidden', borderClass)} id={`node-output-${node.id}`}>
      <button
        className={cn(
          'w-full p-3 flex items-center justify-between text-left transition-colors hover:bg-muted/20',
          bgClass
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0 w-5 text-right">{index + 1}.</span>
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground', expanded && 'rotate-90')} />
          <span className="font-medium text-sm truncate">{node.name}</span>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">({node.type})</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{durationMs(node.startTime, node.endTime)}</span>
          <Badge
            variant={badgeVariant}
            className={cn(
              'text-xs capitalize',
              isWarning && 'border-yellow-500 text-yellow-600 bg-yellow-500/10'
            )}
          >
            {isWarning ? 'warned' : statusLabel}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t bg-card/60 space-y-3 text-sm">
          {/* Duration on mobile */}
          <p className="text-xs text-muted-foreground sm:hidden">
            Duration: {durationMs(node.startTime, node.endTime)}
          </p>

          {/* Error display */}
          {isFailed && node.error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs font-semibold text-red-500 mb-1 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Error
              </p>
              <p className="text-xs font-mono text-red-500/90 break-words whitespace-pre-wrap">{node.error}</p>
              {isWarning && (
                <p className="text-xs text-yellow-600 mt-2 italic">
                  ⚠ Execution continued past this failure (continue-on-fail is enabled).
                </p>
              )}
            </div>
          )}

          {/* Skipped message */}
          {isSkipped && (
            <div className="rounded-md border border-dashed border-muted/60 bg-muted/10 p-3 text-xs text-muted-foreground italic flex items-center gap-2">
              <SkipForward className="h-3.5 w-3.5 shrink-0" />
              Node was skipped.
            </div>
          )}

          {/* Output section */}
          {!isSkipped && (
            (isSuccess || isWarning || (isFailed && node.output !== null && node.output !== undefined))
              ? <OutputBlock label={outputLabel} data={node.output ?? null} />
              : !isFailed && <OutputBlock label={outputLabel} data={null} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── WorkflowOutputViewer ─────────────────────────────────────────────────────

interface WorkflowOutputViewerProps {
  execution: Execution;
  workflowName?: string;
  onClose: () => void;
}

export function WorkflowOutputViewer({ execution, workflowName, onClose }: WorkflowOutputViewerProps) {
  const report = (execution.result?.report as ExecutionReport) ?? null;

  // Overall status
  const overallStatus = execution.status;
  const failedNodes = report?.nodes?.filter(n => n.status === 'failed' && !n.ignored).length ?? 0;
  const warnedNodes = report?.nodes?.filter(n => n.status === 'failed' && n.ignored).length ?? 0;

  let StatusIcon = CheckCircle;
  let statusColor = 'text-green-500';
  let statusLabel = 'Success';
  let headerBg = 'from-green-500/10 to-transparent border-green-500/20';

  if (overallStatus === 'failed') {
    StatusIcon = XCircle;
    statusColor = 'text-red-500';
    statusLabel = 'Failed';
    headerBg = 'from-red-500/10 to-transparent border-red-500/20';
  } else if (overallStatus === 'cancelled') {
    StatusIcon = Minus;
    statusColor = 'text-gray-400';
    statusLabel = 'Cancelled';
    headerBg = 'from-gray-500/10 to-transparent border-gray-500/20';
  } else if (warnedNodes > 0 || failedNodes > 0) {
    StatusIcon = AlertTriangle;
    statusColor = 'text-yellow-500';
    statusLabel = 'Completed with warnings';
    headerBg = 'from-yellow-500/10 to-transparent border-yellow-500/20';
  }

  const totalDuration = durationMs(report?.startTime, report?.endTime);
  const executedCount = report?.nodes?.filter(n => n.status === 'success' || (n.status === 'failed' && n.ignored)).length ?? 0;
  const totalCount = report?.totalNodes ?? report?.nodes?.length ?? 0;
  const hasFinalOutput = report?.finalOutput && Object.keys(report.finalOutput).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="relative z-10 w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-card border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn('bg-gradient-to-r border-b px-5 py-4', headerBg)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-background/60 border backdrop-blur-sm shrink-0">
                <FileOutput className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">
                  {workflowName ? `${workflowName} — Outputs` : 'Workflow Outputs'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                  {execution.id.substring(0, 16)}…
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className={cn('flex items-center gap-1.5 font-semibold text-sm', statusColor)}>
              <StatusIcon className="h-4 w-4" />
              <span>{statusLabel}</span>
            </div>
            {report && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> {executedCount}/{totalCount} nodes executed
                </span>
                {failedNodes > 0 && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-red-500">{failedNodes} failed</span>
                  </>
                )}
                {warnedNodes > 0 && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-yellow-500">{warnedNodes} ignored</span>
                  </>
                )}
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {totalDuration}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-6">

            {/* Final Workflow Output */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Final Workflow Output
                </h3>
                {hasFinalOutput && <CopyButton value={report!.finalOutput} />}
              </div>

              {hasFinalOutput ? (
                <div className="rounded-xl border bg-gradient-to-br from-green-500/5 to-transparent p-4">
                  <OutputBlock label="FINAL OUTPUT" data={report!.finalOutput} showCopy={false} />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-5 text-center">
                  <p className="text-sm text-muted-foreground italic">
                    No final workflow output was produced.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Terminal nodes (those with no outgoing connections) produce the final output.
                  </p>
                </div>
              )}
            </section>

            {/* Node Outputs */}
            {report?.nodes && report.nodes.length > 0 && (
              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Node Outputs
                  <span className="text-xs text-muted-foreground font-normal">
                    ({report.nodes.length} node{report.nodes.length !== 1 ? 's' : ''}, in execution order)
                  </span>
                </h3>
                <div className="space-y-2">
                  {report.nodes.map((node, i) => (
                    <NodeOutputRow key={`${node.id}-${i}`} node={node} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* No report */}
            {!report && (
              <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-center">
                <FileOutput className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No output report available for this execution.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Sensitive values are automatically redacted.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/executions" onClick={onClose}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Full Timeline
              </Link>
            </Button>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
