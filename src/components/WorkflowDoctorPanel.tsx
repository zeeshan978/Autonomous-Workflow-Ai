import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope, X, ChevronRight, ChevronDown, AlertCircle, CheckCircle,
  Zap, Wrench, Eye, Play, Loader2, ArrowRight, ShieldAlert, Info,
  Sparkles, Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { WorkflowNode, WorkflowEdge, Execution } from '@/types';
import { diagnoseExecution, type DiagnosisResult, type NodePatch } from '@/services/workflowDoctor';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface WorkflowDoctorPanelProps {
  open: boolean;
  onClose: () => void;
  execution: Execution | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onApplyFix: (patchedNodes: WorkflowNode[]) => void;
  onRunAgain: () => void;
}

// ─── Diagnosis Step States ────────────────────────────────────────────────────

type StepStatus = 'waiting' | 'running' | 'done' | 'error';

interface DiagStep {
  id: string;
  label: string;
  detail: string;
}

const DIAG_STEPS: DiagStep[] = [
  { id: 'graph', label: 'Analyzing graph topology', detail: 'Checking connections, execution order, and isolated nodes…' },
  { id: 'config', label: 'Validating node configurations', detail: 'Inspecting required fields, types, and schemas…' },
  { id: 'refs', label: 'Resolving variable references', detail: 'Tracing canonical references and upstream outputs…' },
  { id: 'runtime', label: 'Parsing runtime error', detail: 'Reading execution logs and error context…' },
  { id: 'fix', label: 'Synthesizing fix', detail: 'Generating deterministic repair recommendation…' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkflowDoctorPanel({
  open,
  onClose,
  execution,
  nodes,
  edges,
  onApplyFix,
  onRunAgain,
}: WorkflowDoctorPanelProps) {
  const [phase, setPhase] = useState<'diagnosing' | 'done' | 'error'>('diagnosing');
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    Object.fromEntries(DIAG_STEPS.map(s => [s.id, 'waiting']))
  );
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // ── Run diagnosis whenever the panel opens with a new execution ─────────
  useEffect(() => {
    if (!open || !execution) return;

    setPhase('diagnosing');
    setDiagnosis(null);
    setShowPreview(false);
    setFixApplied(false);
    setDiagError(null);
    setCurrentStepIdx(0);
    setStepStatuses(Object.fromEntries(DIAG_STEPS.map(s => [s.id, 'waiting'])));

    runDiagnosis();
  }, [open, execution?.id]);

  async function runDiagnosis() {
    if (!execution) return;

    const markStep = (id: string, status: StepStatus) =>
      setStepStatuses(prev => ({ ...prev, [id]: status }));

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // Animate steps with slight delays for UX
      for (let i = 0; i < DIAG_STEPS.length; i++) {
        const step = DIAG_STEPS[i];
        setCurrentStepIdx(i);
        markStep(step.id, 'running');
        await delay(340 + i * 80);
        markStep(step.id, 'done');
      }

      // Actually run diagnosis
      const result = await diagnoseExecution(execution, nodes, edges, true);
      setDiagnosis(result);
      setPhase('done');
    } catch (err) {
      console.error('[WorkflowDoctor] Diagnosis failed:', err);
      setDiagError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  function handleApplyFix(patch: NodePatch) {
    const patched = nodes.map(n => {
      if (n.id !== patch.nodeId) return n;
      const config = { ...((n.data?.config as Record<string, unknown>) || {}), [patch.field]: patch.newValue };
      return { ...n, data: { ...n.data, config } };
    });
    onApplyFix(patched);
    setFixApplied(true);
    setShowPreview(false);
  }

  const confidence = diagnosis?.confidence;
  const confColor =
    confidence === 'high' ? 'text-green-500' :
    confidence === 'medium' ? 'text-yellow-500' : 'text-orange-500';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="doctor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="doctor-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-[420px] max-w-full z-50 flex flex-col"
            style={{ background: 'hsl(var(--background))', borderLeft: '1px solid hsl(var(--border))' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
                  <Stethoscope className="h-5 w-5 text-white" />
                </div>
                {phase === 'diagnosing' && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full animate-pulse border-2 border-background" />
                )}
                {phase === 'done' && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">AI Workflow Doctor</h2>
                  {diagnosis?.aiEnhanced && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 border-violet-500/40 text-violet-500">
                      <Sparkles className="h-2.5 w-2.5" />AI
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {phase === 'diagnosing' ? 'Analyzing your workflow…' :
                   phase === 'done' ? `Diagnosis complete` :
                   'Diagnosis encountered an error'}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable content */}
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">

                {/* ── DIAGNOSING PHASE ──────────────────────────────────────── */}
                {phase === 'diagnosing' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Running diagnostic checks…
                    </p>
                    {DIAG_STEPS.map((step, i) => {
                      const status = stepStatuses[step.id];
                      return (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border transition-all duration-300',
                            status === 'running' && 'bg-blue-500/8 border-blue-500/30',
                            status === 'done' && 'bg-green-500/5 border-green-500/20',
                            status === 'waiting' && 'border-border/50 opacity-50',
                          )}
                        >
                          <div className="mt-0.5 shrink-0">
                            {status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {status === 'running' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                            {status === 'waiting' && <div className="h-4 w-4 rounded-full border-2 border-border" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{step.label}</p>
                            {status === 'running' && (
                              <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}

                {/* ── ERROR PHASE ───────────────────────────────────────────── */}
                {phase === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-lg bg-destructive/10 border border-destructive/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-semibold text-destructive">Diagnosis Failed</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{diagError}</p>
                  </motion.div>
                )}

                {/* ── DONE PHASE ────────────────────────────────────────────── */}
                {phase === 'done' && diagnosis && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Fix applied banner */}
                    <AnimatePresence>
                      {fixApplied && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">Fix applied — review changes and run again.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Category + Confidence */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs border-destructive/40 text-destructive bg-destructive/5">
                        {diagnosis.category}
                      </Badge>
                      {diagnosis.affectedNodeType && (
                        <Badge variant="secondary" className="text-xs">
                          {diagnosis.affectedNodeType.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('text-xs ml-auto', confColor)}>
                        {confidence?.toUpperCase()} confidence
                      </Badge>
                    </div>

                    {/* PROBLEM */}
                    <DiagSection
                      icon={<AlertCircle className="h-4 w-4 text-destructive" />}
                      title="Problem"
                      color="destructive"
                    >
                      <p className="text-sm leading-relaxed">{diagnosis.problem}</p>
                    </DiagSection>

                    {/* ROOT CAUSE */}
                    <DiagSection
                      icon={<Brain className="h-4 w-4 text-amber-500" />}
                      title="Root Cause"
                      color="amber"
                    >
                      <p className="text-sm leading-relaxed">{diagnosis.rootCause}</p>
                    </DiagSection>

                    {/* AFFECTED NODE */}
                    {diagnosis.affectedNodeName && (
                      <DiagSection
                        icon={<Zap className="h-4 w-4 text-blue-500" />}
                        title="Affected Node"
                        color="blue"
                      >
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                            {diagnosis.affectedNodeName}
                          </code>
                          {diagnosis.affectedNodeType && (
                            <span className="text-xs text-muted-foreground">
                              ({diagnosis.affectedNodeType.replace(/_/g, ' ')})
                            </span>
                          )}
                        </div>
                      </DiagSection>
                    )}

                    {/* SUGGESTED FIX */}
                    <DiagSection
                      icon={<Wrench className="h-4 w-4 text-violet-500" />}
                      title="Suggested Fix"
                      color="violet"
                    >
                      <p className="text-sm leading-relaxed">{diagnosis.suggestedFix}</p>
                    </DiagSection>

                    {/* PROPOSED PATCH */}
                    {diagnosis.proposedPatch && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" /> Auto-Repair Available
                            </p>
                            {diagnosis.proposedPatch.isSafe ? (
                              <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 border">Safe</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Review Required</Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground">{diagnosis.proposedPatch.description}</p>

                          {/* Preview toggle */}
                          <button
                            onClick={() => setShowPreview(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                          >
                            <span className="font-medium flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" /> Preview Changes
                            </span>
                            {showPreview ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>

                          {/* Diff view */}
                          <AnimatePresence>
                            {showPreview && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2"
                              >
                                <div className="rounded-lg border overflow-hidden text-xs font-mono">
                                  <div className="px-3 py-1.5 bg-muted/40 text-muted-foreground font-sans text-[10px] font-medium uppercase tracking-wide border-b">
                                    {diagnosis.affectedNodeName} — {diagnosis.proposedPatch.field}
                                  </div>
                                  <div className="p-3 space-y-1.5">
                                    <div className="flex items-start gap-2">
                                      <span className="text-red-500 font-bold mt-0.5 shrink-0">−</span>
                                      <div className="flex-1 bg-red-500/10 rounded px-2 py-1 text-red-500 break-all">
                                        {String(diagnosis.proposedPatch.oldValue || '(empty)')}
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-green-500 font-bold mt-0.5 shrink-0">+</span>
                                      <div className="flex-1 bg-green-500/10 rounded px-2 py-1 text-green-500 break-all">
                                        {String(diagnosis.proposedPatch.newValue || '(user must fill in)')}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {!diagnosis.proposedPatch.isSafe && diagnosis.proposedPatch.unsafeReason && (
                                  <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                      {diagnosis.proposedPatch.unsafeReason}
                                    </p>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Apply fix — only if safe and has a real new value */}
                          {diagnosis.proposedPatch.isSafe && diagnosis.proposedPatch.newValue !== '' && !fixApplied && (
                            <Button
                              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white"
                              onClick={() => handleApplyFix(diagnosis.proposedPatch!)}
                            >
                              <Wrench className="h-4 w-4" />
                              Apply Fix
                            </Button>
                          )}

                          {!diagnosis.proposedPatch.isSafe && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <p className="text-xs text-muted-foreground">
                                This fix requires manual configuration. Open the <strong>{diagnosis.affectedNodeName}</strong> node and apply the change shown above.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Validation issues summary */}
                    {diagnosis.validationIssues.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Additional Issues ({diagnosis.validationIssues.length})
                          </p>
                          <div className="space-y-1.5">
                            {diagnosis.validationIssues.slice(0, 4).map((issue, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={cn(
                                  'flex items-start gap-2 p-2 rounded-lg text-xs',
                                  issue.severity === 'error'
                                    ? 'bg-destructive/8 border border-destructive/20'
                                    : 'bg-amber-500/8 border border-amber-500/20'
                                )}
                              >
                                <AlertCircle className={cn('h-3.5 w-3.5 shrink-0 mt-0.5',
                                  issue.severity === 'error' ? 'text-destructive' : 'text-amber-500'
                                )} />
                                <div>
                                  <span className="font-medium">{issue.nodeName}:</span>{' '}
                                  {issue.message}
                                </div>
                              </motion.div>
                            ))}
                            {diagnosis.validationIssues.length > 4 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{diagnosis.validationIssues.length - 4} more issues
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* ── Fixed footer ──────────────────────────────────────────────── */}
            {(phase === 'done' || phase === 'error') && (
              <div className="border-t border-border p-4 space-y-2">
                {fixApplied && (
                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white"
                    onClick={() => { onRunAgain(); onClose(); }}
                  >
                    <Play className="h-4 w-4" />
                    Run Again
                    <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                )}
                {!fixApplied && phase === 'done' && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => { onRunAgain(); onClose(); }}
                  >
                    <Play className="h-4 w-4" />
                    Run Again (without fix)
                  </Button>
                )}
                <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={onClose}>
                  Close
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Section Helper ───────────────────────────────────────────────────────────

function DiagSection({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  const bg = {
    destructive: 'bg-destructive/5 border-destructive/20',
    amber: 'bg-amber-500/5 border-amber-500/20',
    blue: 'bg-blue-500/5 border-blue-500/20',
    violet: 'bg-violet-500/5 border-violet-500/20',
  }[color] ?? 'bg-muted/30 border-border';

  const titleColor = {
    destructive: 'text-destructive',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    violet: 'text-violet-600 dark:text-violet-400',
  }[color] ?? 'text-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-lg border p-3 space-y-1.5', bg)}
    >
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', titleColor)}>
        {icon}
        {title}
      </div>
      <div className="text-foreground/90">{children}</div>
    </motion.div>
  );
}
