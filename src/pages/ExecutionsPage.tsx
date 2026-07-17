import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, CheckCircle, XCircle, Clock, RotateCcw, StopCircle, Search, ChevronRight, Activity, Loader2, RefreshCw, Plus, Trash2, Stethoscope, FileOutput } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteExecution, deleteExecutions, getLogs, updateExecution, getWorkflow } from '@/services/database';
import { cancelExecution, startExecution } from '@/services/executionEngine';
import { cn } from '@/lib/utils';
import type { Execution, Log } from '@/types';
import { formatRelativeTime } from '@/lib/time';
import { format } from 'date-fns';
import { useExecutionsQuery } from '@/hooks/useExecutionsQuery';
import { queryClient } from '@/lib/queryClient';
import { WorkflowOutputViewer } from '@/components/WorkflowOutputViewer';

type ExecutionWithWorkflow = Execution & { workflows?: { name: string; variables?: Record<string, unknown> } | null };

function SimpleOutput({ data }: { data: any }) {
  if (Array.isArray(data)) {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground">Array ({data.length} items)</p>
        <div className="pl-2 border-l-2">
           {data.slice(0, 10).map((val, i) => (
             <div key={i} className="mb-1"><span className="opacity-50">[{i}]</span> {typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
           ))}
           {data.length > 10 && <div className="text-muted-foreground">... {data.length - 10} more</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-1">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex flex-col sm:flex-row sm:gap-2 border-b last:border-0 pb-1">
          <span className="font-semibold text-muted-foreground min-w-[120px]">{key}</span>
          <span className="font-mono break-all">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
        </div>
      ))}
    </div>
  );
}

function OutputViewer({ data }: { data: any }) {
  const [view, setView] = useState<'simple' | 'json'>('simple');
  if (data === null || data === undefined) return <p className="text-muted-foreground text-xs italic">No output</p>;
  
  const isObject = typeof data === 'object';
  
  return (
    <div className="mt-2 bg-background border rounded overflow-hidden text-xs">
      <div className="flex border-b bg-muted/20">
        <button className={cn("px-3 py-1 font-medium", view === 'simple' && "bg-muted")} onClick={(e) => { e.preventDefault(); setView('simple'); }}>Simple</button>
        {isObject && <button className={cn("px-3 py-1 font-medium", view === 'json' && "bg-muted")} onClick={(e) => { e.preventDefault(); setView('json'); }}>JSON</button>}
      </div>
      <div className="p-2 overflow-x-auto max-h-[300px]">
        {view === 'json' || !isObject ? (
          <pre className="text-xs font-mono">{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <SimpleOutput data={data} />
        )}
      </div>
    </div>
  );
}

function NodeDetailsRow({ node }: { node: any }) {
  const [expanded, setExpanded] = useState(false);
  const isFailed = node.status === 'failed';
  const isSkipped = node.status === 'skipped';
  const isCancelled = node.status === 'cancelled';
  
  let borderColor = 'border-green-500/50';
  let bgColor = 'bg-green-500/10';
  let badgeVariant: any = 'default';
  
  if (isFailed) {
    if (node.ignored) {
      borderColor = 'border-yellow-500/50';
      bgColor = 'bg-yellow-500/10';
      badgeVariant = 'outline';
    } else {
      borderColor = 'border-red-500/50';
      bgColor = 'bg-red-500/10';
      badgeVariant = 'destructive';
    }
  } else if (isSkipped) {
    borderColor = 'border-gray-400/50 border-dashed';
    bgColor = 'bg-gray-400/10';
    badgeVariant = 'secondary';
  } else if (isCancelled) {
    borderColor = 'border-gray-500/50';
    bgColor = 'bg-gray-500/10';
    badgeVariant = 'secondary';
  }

  return (
    <div className={`rounded-md border overflow-hidden ${borderColor}`}>
       <div 
         className={`p-3 flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors ${bgColor}`}
         onClick={() => setExpanded(!expanded)}
       >
         <div>
           <span className="font-medium text-sm flex items-center gap-2">
             <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
             {node.name} <span className="text-xs text-muted-foreground">({node.type})</span>
           </span>
         </div>
         <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{node.startTime && node.endTime ? `${Math.round((new Date(node.endTime).getTime() - new Date(node.startTime).getTime()))}ms` : '-'}</span>
            <Badge variant={badgeVariant} className={node.ignored ? 'text-yellow-600 border-yellow-500 bg-yellow-500/20' : ''}>
              {isFailed && node.ignored ? 'Ignored Failure' : node.status}
            </Badge>
         </div>
       </div>
       {expanded && (
         <div className="p-3 border-t bg-card text-sm space-y-4">
           {node.error && (
             <div>
               <p className="font-semibold text-red-500 mb-1">Error</p>
               <p className="text-xs font-mono text-red-500 break-words bg-red-500/10 p-2 rounded border border-red-500/20">{node.error}</p>
             </div>
           )}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <div>
               <p className="font-semibold text-muted-foreground mb-1">INPUT</p>
               {node.inputs ? (
                 <ScrollArea className="h-[250px] w-full rounded border bg-muted/30 p-2">
                   <pre className="text-xs font-mono">{JSON.stringify(node.inputs, null, 2)}</pre>
                 </ScrollArea>
               ) : (
                 <p className="text-xs text-muted-foreground italic">No input data available</p>
               )}
             </div>
             <div>
               <p className="font-semibold text-muted-foreground mb-1">OUTPUT</p>
               {node.output !== undefined ? (
                 <OutputViewer data={node.output} />
               ) : (
                 <p className="text-xs text-muted-foreground italic">No output data available</p>
               )}
             </div>
           </div>
         </div>
       )}
    </div>
  );
}

export function ExecutionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: executionsData = [], isLoading: loading } = useExecutionsQuery();
  const executions = executionsData as ExecutionWithWorkflow[];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const selectedExecution = useMemo(() => executions.find(e => e.id === selectedExecutionId) || null, [executions, selectedExecutionId]);
  
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedExecutions, setSelectedExecutions] = useState<string[]>([]);
  const [executionToDelete, setExecutionToDelete] = useState<string | null>(null);
  const [bulkDeleteType, setBulkDeleteType] = useState<'selected' | 'failed' | 'completed' | 'all' | null>(null);
  const [viewerExecution, setViewerExecution] = useState<ExecutionWithWorkflow | null>(null);


  useEffect(() => {
    async function loadLogs() {
      if (selectedExecutionId) {
        setLoadingLogs(true);
        try {
          const data = await getLogs(selectedExecutionId);
          setLogs(data);
        } catch (error) {
          console.error('Failed to load logs:', error);
        } finally {
          setLoadingLogs(false);
        }
      }
    }
    loadLogs();
  }, [selectedExecutionId]);

  const handleCancel = async (execution: Execution) => {
    try {
      await cancelExecution(execution.id);
      toast({ title: 'Execution cancelled' });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    } catch (error: any) { 
      toast({ title: 'Failed to cancel', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleRetry = async (execution: Execution) => {
    try {
      toast({ title: 'Starting retry...' });
      const workflow = await getWorkflow(execution.workflow_id);
      if (!workflow) throw new Error('Workflow definition could not be found.');
      
      const newExecution = await startExecution(user!.id, workflow);
      setSelectedExecutionId(newExecution.id);
      toast({ title: 'Execution started successfully' });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    } catch (error: any) { 
      toast({ title: 'Failed to retry', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleDeleteExecution = async () => {
    if (!executionToDelete) return;
    try {
      await deleteExecution(executionToDelete);
      
      if (selectedExecutionId === executionToDelete) {
        setSelectedExecutionId(null);
        setLogs([]);
      }
      
      setSelectedExecutions(prev => prev.filter(id => id !== executionToDelete));
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      
      toast({ title: 'Execution deleted successfully.' });
    } catch (error: any) {
      toast({ title: 'Unable to delete execution.', description: error?.message || String(error), variant: 'destructive' });
    } finally {
      setExecutionToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteType) return;
    
    let idsToDelete: string[] = [];
    if (bulkDeleteType === 'selected') {
      idsToDelete = selectedExecutions;
    } else if (bulkDeleteType === 'failed') {
      idsToDelete = executions.filter(e => e.status === 'failed').map(e => e.id);
    } else if (bulkDeleteType === 'completed') {
      idsToDelete = executions.filter(e => e.status === 'completed').map(e => e.id);
    } else if (bulkDeleteType === 'all') {
      idsToDelete = executions.map(e => e.id);
    }

    if (idsToDelete.length === 0) {
      setBulkDeleteType(null);
      return;
    }

    try {
      await deleteExecutions(idsToDelete);
      
      if (selectedExecutionId && idsToDelete.includes(selectedExecutionId)) {
        setSelectedExecutionId(null);
        setLogs([]);
      }
      
      setSelectedExecutions([]);
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      
      toast({ title: `${idsToDelete.length} executions deleted successfully.` });
    } catch (error: any) {
      toast({ title: 'Unable to delete executions.', description: error?.message || String(error), variant: 'destructive' });
    } finally {
      setBulkDeleteType(null);
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedExecutions(prev => 
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };

  const filteredExecutions = executions.filter(e => {
    const matchesSearch = (e.workflows?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || e.id.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = useMemo(() => {
    const total = executions.length;
    const running = executions.filter(e => e.status === 'running').length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const queued = executions.filter(e => e.status === 'queued').length;
    
    const totalCompletedAndFailed = completed + failed;
    const successRate = totalCompletedAndFailed > 0 ? (completed / totalCompletedAndFailed) * 100 : 0;
    const failureRate = totalCompletedAndFailed > 0 ? (failed / totalCompletedAndFailed) * 100 : 0;

    return { total, running, completed, failed, queued, successRate, failureRate };
  }, [executions]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      data.push({
        date: format(date, 'EEE, MMM d'),
        executions: executions.filter(e => {
          if (!e.created_at) return false;
          const execDate = new Date(e.created_at.includes('T') && !e.created_at.endsWith('Z') && !e.created_at.includes('+') ? e.created_at + 'Z' : e.created_at);
          return format(execDate, 'yyyy-MM-dd') === dateStr;
        }).length
      });
    }
    return data;
  }, [executions]);

  const statusCards = useMemo(() => [
    { icon: Activity, label: 'Total', value: statusCounts.total, color: 'text-blue-500' },
    { icon: Play, label: 'Running', value: statusCounts.running, color: 'text-yellow-500' },
    { icon: CheckCircle, label: 'Completed', value: statusCounts.completed, color: 'text-green-500' },
    { icon: XCircle, label: 'Failed', value: statusCounts.failed, color: 'text-red-500' },
    { icon: Activity, label: 'Success Rate', value: `${statusCounts.successRate.toFixed(2)}%`, color: 'text-emerald-500' },
  ], [statusCounts]);



  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Executions</h1>
            <p className="text-muted-foreground">Monitor and manage workflow executions</p>
          </div>
          <Link to="/command-center"><Button><Play className="h-4 w-4 mr-2" />New Execution</Button></Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statusCards.map((stat) => (
            <Card key={stat.label} className="glass-card hover:border-primary/50 transition-premium">
              <CardContent className="p-5 flex flex-col justify-between h-full gap-2">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="p-6 border-b border-border/50">
            <CardTitle>Execution History</CardTitle>
            <CardDescription>Daily workflow executions over the past week</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="executions" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader className="p-6 border-b border-border/50">
              <CardTitle>All Executions</CardTitle>
              <CardDescription>Click to view details</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search executions..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedExecutions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} 
                  className="bg-muted/50 border rounded-lg p-2 flex flex-wrap items-center gap-2"
                >
                  <span className="text-sm font-medium px-2">{selectedExecutions.length} selected</span>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setBulkDeleteType('selected')}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete Selected
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setBulkDeleteType('failed')}>
                    Delete Failed
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setBulkDeleteType('completed')}>
                    Delete Completed
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setBulkDeleteType('all')}>
                    Clear All
                  </Button>
                </motion.div>
              )}
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredExecutions.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">{searchQuery || statusFilter !== 'all' ? 'No executions match your filters' : 'No workflow executions yet.'}</p>
                      <p className="text-sm mb-4">{searchQuery || statusFilter !== 'all' ? 'Try clearing your search or filter' : 'Run your first workflow to start tracking executions.'}</p>
                      {!searchQuery && statusFilter === 'all' && (
                        <Button size="sm" onClick={() => navigate('/workflows/builder')}>
                          <Play className="h-4 w-4 mr-2" />Run Workflow
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredExecutions.map((execution) => (
                      <div
                        key={execution.id}
                        className={`group p-3 border rounded-lg cursor-pointer transition-colors relative flex gap-3 ${selectedExecution?.id === execution.id ? 'bg-muted border-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedExecutionId(execution.id)}
                      >
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedExecutions.includes(execution.id)} onCheckedChange={() => toggleSelection(execution.id, { stopPropagation: () => {} } as any)} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate mr-2">{execution.workflows?.name || 'Workflow Run'}</span>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={execution.status === 'completed' ? 'default' : execution.status === 'running' ? 'secondary' : execution.status === 'failed' ? 'destructive' : 'outline'}
                                className={cn(
                                  execution.status === 'completed' && "shadow-[0_0_10px_rgba(var(--success),0.5)] border-success text-white",
                                  execution.status === 'failed' && "shadow-[0_0_10px_rgba(var(--destructive),0.5)] border-destructive text-white",
                                  execution.status === 'running' && "shadow-[0_0_10px_rgba(var(--warning),0.5)] border-warning text-white animate-pulse"
                                )}
                              >
                                {execution.status === 'running' && <Loader2 className="h-2 w-2 mr-1 animate-spin" />}
                                {execution.status}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-500 hover:scale-105"
                                onClick={(e) => { e.stopPropagation(); setExecutionToDelete(execution.id); }}
                                title="Delete Execution"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pr-8">
                            <span>{formatRelativeTime(execution.created_at)}</span>
                            {execution.status === 'running' && <Progress value={execution.progress} className="w-20 h-1.5" />}
                            {execution.status === 'completed' && execution.started_at && execution.completed_at && (
                              <span>{Math.round((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 1000)}s</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="p-6 border-b border-border/50">
              <CardTitle>Execution Details</CardTitle>
              {selectedExecution && <CardDescription>{selectedExecution.workflows?.name || 'Unknown Workflow'} - {selectedExecution.id.substring(0, 8)}...</CardDescription>}
            </CardHeader>
            <CardContent className="p-6">
              {selectedExecution ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Workflow</p>
                      <p className="text-sm font-medium">{selectedExecution.workflows?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground break-all">{selectedExecution.workflow_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Execution ID</p>
                      <p className="text-sm font-mono break-all">{selectedExecution.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge variant={selectedExecution.status === 'completed' ? 'default' : selectedExecution.status === 'running' ? 'secondary' : selectedExecution.status === 'failed' ? 'destructive' : 'outline'}>{selectedExecution.status}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Progress</p>
                      <div className="flex items-center gap-2">
                        <Progress value={selectedExecution.progress} className="h-2 w-full" />
                        <span className="text-xs font-medium">{selectedExecution.progress}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Started</p>
                      <p className="text-sm font-medium">{selectedExecution.started_at ? formatRelativeTime(selectedExecution.started_at) : 'Not started'}</p>
                      {selectedExecution.started_at && <p className="text-xs text-muted-foreground">{new Date(selectedExecution.started_at).toLocaleString()}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Completed</p>
                      <p className="text-sm font-medium">{selectedExecution.completed_at ? formatRelativeTime(selectedExecution.completed_at) : '-'}</p>
                      {selectedExecution.completed_at && <p className="text-xs text-muted-foreground">{new Date(selectedExecution.completed_at).toLocaleString()}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Duration</p>
                      <p className="text-sm font-medium">
                        {selectedExecution.started_at && selectedExecution.completed_at 
                          ? `${Math.round((new Date(selectedExecution.completed_at).getTime() - new Date(selectedExecution.started_at).getTime()) / 1000)}s` 
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Trigger Type</p>
                      <p className="text-sm font-medium">Manual</p>
                    </div>
                  </div>

                  {selectedExecution.workflows?.variables && Object.keys(selectedExecution.workflows.variables).length > 0 && (
                    <div className="border rounded-lg p-3 bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Variables</p>
                      <div className="space-y-1">
                        {Object.entries(selectedExecution.workflows.variables).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="font-mono text-muted-foreground">{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedExecution.error_message && (
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                      <p className="text-sm font-semibold mb-2 flex items-center gap-2"><XCircle className="h-4 w-4" /> Error Details</p>
                      {(() => {
                        let parsed = null;
                        try {
                          parsed = JSON.parse(selectedExecution.error_message);
                          if (!parsed?.message) parsed = null;
                        } catch (e) {
                          // Ignore parsing error, fallback to plain text
                        }

                        if (parsed) {
                          return (
                            <div className="space-y-3">
                              <p className="text-sm font-bold">{parsed.message}</p>
                              {parsed.reason && <p className="text-sm opacity-90">{parsed.reason}</p>}
                              {parsed.suggestion && (
                                <div className="mt-2 p-3 bg-red-500/20 rounded-md border border-red-500/30">
                                  <p className="text-sm font-medium">💡 Suggestion: {parsed.suggestion}</p>
                                </div>
                              )}
                              {parsed.rawError && (
                                <details className="mt-2 text-xs opacity-70">
                                  <summary className="cursor-pointer font-medium hover:opacity-100">Raw Error</summary>
                                  <pre className="mt-1 p-2 bg-black/10 rounded font-mono break-words whitespace-pre-wrap">{parsed.rawError}</pre>
                                </details>
                              )}
                            </div>
                          );
                        } else {
                          return <p className="text-sm font-mono break-words">{selectedExecution.error_message}</p>;
                        }
                      })()}
                    </div>
                  )}

                  {/* Node Timeline */}
                  {logs.length > 0 && (
                    <div className="border rounded-lg p-3 bg-card mt-4">
                      <p className="text-sm font-medium mb-3">Execution Timeline</p>
                      <div className="relative border-l-2 border-muted ml-3 pl-4 space-y-4">
                        {logs.map((log): React.ReactNode => {
                          const runMatch = log.message.match(/Running node: (.+?) \(/);
                          const doneMatch = log.message.match(/✓ (.+?) completed/);
                          const skipMatch = log.message.match(/Skipping node: (.+?) \(/);
                          const failMatch = log.message.match(/✗ (.+?) failed/);
                          
                          let nodeName = '';
                          let statusColor = 'bg-muted-foreground';
                          let icon: any = <Clock className="h-3 w-3 text-white" />;
                          
                          if (runMatch) { nodeName = runMatch[1]; statusColor = 'bg-blue-500'; icon = <Activity className="h-3 w-3 text-white" />; }
                          else if (doneMatch) { nodeName = doneMatch[1]; statusColor = 'bg-green-500'; icon = <CheckCircle className="h-3 w-3 text-white" />; }
                          else if (failMatch) { nodeName = failMatch[1]; statusColor = 'bg-red-500'; icon = <XCircle className="h-3 w-3 text-white" />; }
                          else if (skipMatch) { nodeName = skipMatch[1]; statusColor = 'bg-gray-400'; icon = <StopCircle className="h-3 w-3 text-white" />; }
                          
                          if (!nodeName) return null;

                          return (
                            <div key={log.id} className="relative">
                              <div className={`absolute -left-[25px] mt-1 h-5 w-5 rounded-full ${statusColor} flex items-center justify-center ring-4 ring-background`}>
                                {icon}
                              </div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium">{nodeName}</p>
                                  <p className="text-xs text-muted-foreground">{log.message}</p>
                                  {log.metadata && (log.metadata as any).issue && (
                                    <div className="mt-2 p-3 bg-red-500/10 text-red-500 rounded-md border border-red-500/20">
                                      <p className="text-sm font-bold">{((log.metadata as any).issue as any).message}</p>
                                      {((log.metadata as any).issue as any).reason && <p className="text-sm opacity-90">{((log.metadata as any).issue as any).reason}</p>}
                                      {((log.metadata as any).issue as any).suggestion && (
                                        <div className="mt-2 p-2 bg-red-500/20 rounded border border-red-500/30">
                                          <p className="text-sm font-medium">💡 Suggestion: {((log.metadata as any).issue as any).suggestion}</p>
                                        </div>
                                      )}
                                      {((log.metadata as any).issue as any).rawError && (
                                        <details className="mt-2 text-xs opacity-70">
                                          <summary className="cursor-pointer font-medium hover:opacity-100">Raw Error</summary>
                                          <pre className="mt-1 p-2 bg-black/10 rounded font-mono break-words whitespace-pre-wrap">{((log.metadata as any).issue as any).rawError}</pre>
                                        </details>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                  {new Date(log.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const report = selectedExecution.result?.report as any;
                    if (!report) return null;
                    return (
                      <div className="border rounded-lg p-3 bg-card mt-4 mb-4 shadow-sm">
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Execution Report
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="p-3 bg-muted/30 rounded-md border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Total Nodes</p>
                            <p className="text-lg font-semibold">{report.totalNodes}</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-md border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Executed</p>
                            <p className="text-lg font-semibold text-green-500">{report.executedNodes}</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-md border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Failed</p>
                            <p className="text-lg font-semibold text-red-500">{report.failedNodes}</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-md border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Duration</p>
                            <p className="text-lg font-semibold">
                              {report.startTime && report.endTime
                                ? `${Math.round((new Date(report.endTime).getTime() - new Date(report.startTime).getTime()) / 100) / 10}s`
                                : '-'}
                            </p>
                          </div>
                        </div>
                        
                        {report.finalOutput && Object.keys(report.finalOutput).length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" /> Final Workflow Output
                            </p>
                            <div className="p-3 bg-muted/20 border rounded-lg shadow-sm">
                               <OutputViewer data={report.finalOutput} />
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Node Details</p>
                          {report.nodes.map((n: any, idx: number) => (
                            <NodeDetailsRow key={n.id + idx} node={n} />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {selectedExecution.result && (
                    <div className="border rounded-lg p-3 bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Result JSON</p>
                      <ScrollArea className="h-[150px] w-full rounded-md bg-muted/50 p-2">
                        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
                          {JSON.stringify(selectedExecution.result, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="flex gap-2 border-b pb-4">
                    {selectedExecution.status === 'running' && <Button variant="outline" size="sm" onClick={() => handleCancel(selectedExecution)}><StopCircle className="h-4 w-4 mr-1" />Cancel</Button>}
                    {(selectedExecution.status === 'completed' || selectedExecution.status === 'failed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => setViewerExecution(selectedExecution)}
                      >
                        <FileOutput className="h-4 w-4" />
                        View Outputs
                      </Button>
                    )}
                    {selectedExecution.status === 'failed' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleRetry(selectedExecution)}><RotateCcw className="h-4 w-4 mr-1" />Retry</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-violet-500/40 text-violet-500 hover:bg-violet-500/10"
                          onClick={() => navigate(`/workflows/${selectedExecution.workflow_id}?doctor=${selectedExecution.id}`)}
                        >
                          <Stethoscope className="h-4 w-4" />
                          Diagnose
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Execution Logs</h4>
                      <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['executions'] })} disabled={loading}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                      </Button>
                    </div>
                    <ScrollArea className="h-[200px] bg-muted/30 rounded-md p-2">
                      <div className="font-mono text-xs space-y-0.5">
                        {loadingLogs ? (
                          <div className="flex items-center gap-2 text-muted-foreground p-2">
                            <Loader2 className="h-3 w-3 animate-spin" />Loading logs...
                          </div>
                        ) : logs.length === 0 ? (
                          <p className="text-muted-foreground p-2">No logs available for this execution.</p>
                        ) : (
                          logs.map((log, index) => (
                            <motion.div 
                              key={log.id} 
                              initial={{ opacity: 0, x: -10 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              transition={{ delay: index * 0.05, duration: 0.2 }}
                              className={`flex gap-2 p-0.5 ${
                              log.level === 'error' ? 'text-red-500' :
                              log.level === 'warn'  ? 'text-yellow-500' :
                              log.level === 'debug' ? 'text-muted-foreground/60' :
                              'text-foreground/80'
                            }`}>
                              <span className="text-muted-foreground/50 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                              <span>{log.message}</span>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground"><ChevronRight className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>Select an execution to view details</p></div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Individual Delete Alert */}
      <AlertDialog open={!!executionToDelete} onOpenChange={(open) => !open && setExecutionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Execution</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this execution? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExecution} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Alert */}
      <AlertDialog open={!!bulkDeleteType} onOpenChange={(open) => !open && setBulkDeleteType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Executions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {bulkDeleteType === 'selected' ? selectedExecutions.length : bulkDeleteType === 'failed' ? 'all failed' : bulkDeleteType === 'completed' ? 'all completed' : 'all'} executions? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workflow Output Viewer */}
      {viewerExecution && (
        <WorkflowOutputViewer
          execution={viewerExecution}
          workflowName={viewerExecution.workflows?.name}
          onClose={() => setViewerExecution(null)}
        />
      )}
    </div>
  );
}
