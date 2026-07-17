import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CalendarClock, Plus, Play, Pause, Clock, RefreshCw, 
  Trash2, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getSchedules, updateSchedule, deleteSchedule, createSchedule, getWorkflows } from '@/services/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SchedulerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [intervalType, setIntervalType] = useState('daily');
  const [cronExpr, setCronExpr] = useState('');

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules', user?.id],
    queryFn: () => getSchedules(user!.id),
    enabled: !!user?.id,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', user?.id],
    queryFn: () => getWorkflows(user!.id),
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: (newSchedule: any) => createSchedule(newSchedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsDialogOpen(false);
      setName('');
      setWorkflowId('');
      toast({ title: 'Schedule created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create schedule', description: error.message, variant: 'destructive' });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: 'active' | 'paused' | 'disabled' }) => updateSchedule(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: 'Schedule status updated' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: 'Schedule deleted' });
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !workflowId || !user?.id) return;
    createMutation.mutate({
      user_id: user.id,
      workflow_id: workflowId,
      name,
      interval_type: intervalType,
      cron_expression: intervalType === 'custom' ? cronExpr : null,
      status: 'active'
    });
  };

  const filteredSchedules = schedules.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s as any).workflows?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Scheduler</h1>
          <p className="text-muted-foreground">Automate your workflows on a recurring schedule</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Schedule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Schedule Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Daily Marketing Email" required />
              </div>
              <div className="space-y-2">
                <Label>Target Workflow</Label>
                <Select value={workflowId} onValueChange={setWorkflowId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select value={intervalType} onValueChange={setIntervalType} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Run Once</SelectItem>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom (Cron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {intervalType === 'custom' && (
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="0 0 * * *" required />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                Create Schedule
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search schedules..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 backdrop-blur-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No schedules found</h3>
            <p className="text-muted-foreground mb-4">Create your first schedule to automate a workflow.</p>
            <Button onClick={() => setIsDialogOpen(true)}>Create Schedule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchedules.map((schedule, i) => (
            <motion.div
              key={schedule.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-card hover:border-primary/50 transition-premium h-full flex flex-col">
                <CardHeader className="p-5 border-b border-border/50 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{schedule.name}</CardTitle>
                      <CardDescription className="line-clamp-1 mt-1">
                        Workflow: {(schedule as any).workflows?.name || 'Unknown'}
                      </CardDescription>
                    </div>
                    <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'} className={schedule.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/30' : ''}>
                      {schedule.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="capitalize">{schedule.interval_type}</span>
                      {schedule.cron_expression && <span className="font-mono bg-muted px-1 rounded text-xs">{schedule.cron_expression}</span>}
                    </div>
                    <div className="flex justify-between border-t border-border pt-4 mt-4">
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => toggleStatusMutation.mutate({ 
                            id: schedule.id, 
                            status: schedule.status === 'active' ? 'paused' : 'active' 
                          })}
                        >
                          {schedule.status === 'active' ? <Pause className="h-4 w-4 text-amber-500" /> : <Play className="h-4 w-4 text-green-500" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:text-destructive"
                          onClick={() => deleteMutation.mutate(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-right">
                        <div>Last: {schedule.last_run ? new Date(schedule.last_run).toLocaleString() : 'Never'}</div>
                        <div>Next: {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'Pending'}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
