import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, CheckCircle, XCircle, Clock, RotateCcw, StopCircle, Search, ChevronRight, Activity, Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react';
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
import { deleteExecution, deleteExecutions, getLogs, updateExecution } from '@/services/database';
import { cn } from '@/lib/utils';
import type { Execution, Log } from '@/types';
import { formatRelativeTime } from '@/lib/time';
import { format } from 'date-fns';
import { useExecutionsQuery } from '@/hooks/useExecutionsQuery';
import { queryClient } from '@/lib/queryClient';

type ExecutionWithWorkflow = Execution & { workflows?: { name: string; variables?: Record<string, unknown> } | null };

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
      await updateExecution(execution.id, { status: 'cancelled', completed_at: new Date().toISOString() });
      toast({ title: 'Execution cancelled' });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    } catch (error: any) { toast({ title: 'Failed to cancel', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleRetry = async (execution: Execution) => {
    try {
      await updateExecution(execution.id, { status: 'queued', progress: 0, error_message: null });
      toast({ title: 'Execution queued for retry' });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    } catch (error: any) { toast({ title: 'Failed to retry', description: error?.message || String(error), variant: 'destructive' });
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Executions</h1>
            <p className="text-muted-foreground">Monitor and manage workflow executions</p>
          </div>
          <Link to="/command-center"><Button><Play className="h-4 w-4 mr-2" />New Execution</Button></Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statusCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>Daily workflow executions over the past week</CardDescription>
          </CardHeader>
          <CardContent>
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
          <Card>
            <CardHeader>
              <CardTitle>All Executions</CardTitle>
              <CardDescription>Click to view details</CardDescription>
            </CardHeader>
            <CardContent>
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

          <Card>
            <CardHeader>
              <CardTitle>Execution Details</CardTitle>
              {selectedExecution && <CardDescription>{selectedExecution.workflows?.name || 'Unknown Workflow'} - {selectedExecution.id.substring(0, 8)}...</CardDescription>}
            </CardHeader>
            <CardContent>
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
                    <div className="p-3 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                      <p className="text-xs font-medium mb-1">Error Message</p>
                      <p className="text-sm font-mono break-words">{selectedExecution.error_message}</p>
                    </div>
                  )}

                  {/* Node Timeline */}
                  {logs.length > 0 && (
                    <div className="border rounded-lg p-3 bg-card mt-4">
                      <p className="text-sm font-medium mb-3">Execution Timeline</p>
                      <div className="relative border-l-2 border-muted ml-3 pl-4 space-y-4">
                        {logs.map((log) => {
                          const runMatch = log.message.match(/Running node: (.+?) \(/);
                          const doneMatch = log.message.match(/✓ (.+?) completed/);
                          const skipMatch = log.message.match(/Skipping node: (.+?) \(/);
                          const failMatch = log.message.match(/✗ (.+?) failed/);
                          
                          let nodeName = '';
                          let statusColor = 'bg-muted-foreground';
                          let icon = <Clock className="h-3 w-3 text-white" />;
                          
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
                    {selectedExecution.status === 'failed' && <Button variant="outline" size="sm" onClick={() => handleRetry(selectedExecution)}><RotateCcw className="h-4 w-4 mr-1" />Retry</Button>}
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
    </div>
  );
}
