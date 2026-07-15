import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GitBranch, Play, CheckCircle, XCircle, Bot, TrendingUp, Zap,
  Plus, ArrowRight, Clock, Bell, RefreshCw, Loader2, Sparkles, AlertCircle, ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { ActivityCalendar } from 'react-activity-calendar';
import { getAgents, getWorkflows, getNotifications } from '@/services/database';
import type { Execution, Agent, Workflow, Notification } from '@/types';
import { formatRelativeTime } from '@/lib/time';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { useExecutionsQuery } from '@/hooks/useExecutionsQuery';
import { format } from 'date-fns';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

function StatCardSkeleton() {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="space-y-1">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalWorkflows: 0, runningExecutions: 0, completedExecutions: 0,
    failedExecutions: 0, savedTemplates: 0, totalAgents: 0,
    successRate: 0, todayExecutions: 0
  });
  const [recentExecutions, setRecentExecutions] = useState<Execution[]>([]);
  const [recentAgents, setRecentAgents] = useState<Agent[]>([]);
  const [recentWorkflows, setRecentWorkflows] = useState<Workflow[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalWorkflowsCount, setTotalWorkflowsCount] = useState(0);
  const [totalAgentsCount, setTotalAgentsCount] = useState(0);
  const [totalTemplatesCount, setTotalTemplatesCount] = useState(0);

  const { data: executions = [], isLoading: executionsLoading } = useExecutionsQuery();

  // Calculate greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [agentsData, workflowsData, notificationsData] = await Promise.all([
        getAgents(user.id),
        getWorkflows(user.id),
        getNotifications(user.id)
      ]);

      setRecentAgents(agentsData.slice(0, 5));
      setRecentWorkflows(workflowsData.slice(0, 5));
      setNotifications(notificationsData.slice(0, 5));
      
      setTotalWorkflowsCount(workflowsData.length);
      setTotalAgentsCount(agentsData.length);
      setTotalTemplatesCount(workflowsData.filter(w => w.is_template).length);

    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived state from the single source of truth (executions)
  const computedStats = useMemo(() => {
    const running = executions.filter(e => e.status === 'running').length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const queued = executions.filter(e => e.status === 'queued').length;
    const total = executions.length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Charts logic
    const usage: { date: string; count: number }[] = [];
    const hmData: { date: string; count: number; level: number }[] = [];
    
    for (let i = 180; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Parse execution UTC timestamps properly into local dates, then check format
      const count = executions.filter(e => {
        if (!e.created_at) return false;
        const execDate = new Date(e.created_at.includes('T') && !e.created_at.endsWith('Z') && !e.created_at.includes('+') ? e.created_at + 'Z' : e.created_at);
        return format(execDate, 'yyyy-MM-dd') === dateStr;
      }).length;
      
      let level = 0;
      if (count > 0) level = 1;
      if (count > 2) level = 2;
      if (count > 5) level = 3;
      if (count > 10) level = 4;
      
      hmData.push({ date: dateStr, count, level });
      
      if (i < 7) {
        const dayLabel = format(date, 'EEE, MMM d');
        usage.push({ date: dayLabel, count });
      }
    }
    
    const statuses = [
      { name: 'Completed', value: completed },
      { name: 'Running', value: running },
      { name: 'Failed', value: failed },
      { name: 'Queued', value: queued }
    ].filter(d => d.value > 0);

    return {
      running, completed, failed, successRate, total,
      dailyUsage: usage,
      heatmapData: hmData,
      statusData: statuses,
      recent: executions.slice(0, 8)
    };
  }, [executions]);

  const statCards = useMemo(() => [
    { icon: GitBranch, label: 'Total Workflows', value: totalWorkflowsCount, color: 'text-blue-500', bg: 'bg-blue-500/10', path: '/workflows/builder' },
    { icon: Play, label: 'Running', value: computedStats.running, color: 'text-yellow-500', bg: 'bg-yellow-500/10', path: '/executions' },
    { icon: CheckCircle, label: 'Completed', value: computedStats.completed, color: 'text-green-500', bg: 'bg-green-500/10', path: '/executions' },
    { icon: XCircle, label: 'Failed', value: computedStats.failed, color: 'text-red-500', bg: 'bg-red-500/10', path: '/executions' },
    { icon: Bot, label: 'AI Agents', value: totalAgentsCount, color: 'text-cyan-500', bg: 'bg-cyan-500/10', path: '/agents' },
    { icon: TrendingUp, label: 'Success Rate', value: computedStats.successRate, suffix: '%', color: 'text-indigo-500', bg: 'bg-indigo-500/10', path: '/analytics' },
  ], [computedStats, totalWorkflowsCount, totalAgentsCount]);

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' =>
    status === 'completed' ? 'default' :
    status === 'running'   ? 'secondary' :
    status === 'failed'    ? 'destructive' : 'outline';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="text-4xl font-extrabold tracking-tight mb-2"
            >
              {greeting}, {user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} <span className="inline-block animate-wave">👋</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="text-muted-foreground flex items-center gap-2"
            >
              <Clock className="h-4 w-4" /> {currentDate} — Let's automate something amazing today.
            </motion.p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            {/* Performance Indicator */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-full glass-panel border-white/10 text-xs font-medium"
            >
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-500">System Healthy</span>
              </div>
              <span className="text-border">|</span>
              <span className="text-muted-foreground">98ms</span>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5 text-primary">
                <ShieldCheck className="h-3 w-3" /> Gemini Connected
              </div>
            </motion.div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => loadData()} disabled={refreshing} className="glass-panel hover:bg-white/10">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={() => navigate('/workflows/builder')} className="shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all ripple">
                <Sparkles className="h-4 w-4 mr-1.5" />New Workflow
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {loading || executionsLoading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map((stat, index) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                  <Link to={stat.path}>
                    <Card className="glass-card cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">
                              <AnimatedCounter value={stat.value} suffix={stat.suffix || ''} />
                            </p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))
          }
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Daily Executions</CardTitle>
              <CardDescription>Workflow runs over the past 8 days</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[250px] w-full" /> : (
                  <div className="h-[250px] mt-4">
                  {computedStats.dailyUsage.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={computedStats.dailyUsage}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 10px 40px -10px rgba(var(--primary),0.2)' }} />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Play className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No executions in the last 8 days.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Execution Status</CardTitle>
              <CardDescription>Distribution of all execution outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[250px] w-full" /> : (
                  <div className="h-[250px] flex flex-col items-center justify-center">
                  {computedStats.statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={computedStats.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {computedStats.statusData.map((entry, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <TrendingUp className="h-8 w-8 mb-2 mx-auto opacity-40" />
                      <p className="text-sm">No execution data yet.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Heatmap Row */}
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle>Workflow Activity</CardTitle>
            <CardDescription>Executions over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-4">
            {loading ? <Skeleton className="h-32 w-full" /> : (
                <div className="w-full overflow-hidden flex justify-center mt-6">
                  {computedStats.heatmapData.length > 0 ? (
                    <ActivityCalendar
                      data={computedStats.heatmapData}
                      theme={{
                    light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
                    dark: ['hsl(var(--muted)/0.3)', 'hsl(var(--primary)/0.4)', 'hsl(var(--primary)/0.6)', 'hsl(var(--primary)/0.8)', 'hsl(var(--primary))'],
                  }}
                  colorScheme="dark"
                  showTotalCount={false}
                  showColorLegend={false}
                />
              ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Executions */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Executions</CardTitle>
                  <CardDescription>Latest workflow runs</CardDescription>
                </div>
                <Link to="/executions">
                  <Button variant="ghost" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <ListSkeleton /> : computedStats.recent.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-24 h-24 mx-auto mb-4 relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <img src="https://illustrations.popsy.co/amber/freelancer.svg" alt="No workflows" className="w-full h-full relative z-10 opacity-80" />
                  </div>
                  <p className="font-medium text-lg mb-1">No executions yet</p>
                  <p className="text-sm mb-6 max-w-sm mx-auto">Build and run your first AI workflow to automate tasks and see the results here.</p>
                  <Button onClick={() => navigate('/workflows/builder')} className="shadow-[0_0_20px_rgba(var(--primary),0.3)] ripple">
                    <Sparkles className="h-4 w-4 mr-2" />Create Your First AI Workflow
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {computedStats.recent.map(execution => (
                    <Link key={execution.id} to="/executions">
                      <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className={`p-1.5 rounded-full ${
                          execution.status === 'completed' ? 'bg-green-500/10' :
                          execution.status === 'running'   ? 'bg-yellow-500/10' :
                          execution.status === 'failed'    ? 'bg-red-500/10' : 'bg-gray-500/10'
                        }`}>
                          {execution.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {execution.status === 'running'   && <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />}
                          {execution.status === 'failed'    && <XCircle className="h-4 w-4 text-red-500" />}
                          {(execution.status === 'queued' || execution.status === 'cancelled') && <Clock className="h-4 w-4 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {(execution as Execution & { workflows?: { name: string } }).workflows?.name || 'Workflow Run'}
                          </p>
                          <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                          {formatRelativeTime(execution.created_at)}
                        </div>
                        </div>
                        {execution.status === 'running' && (
                          <Progress value={execution.progress} className="w-20 h-1.5" />
                        )}
                        <Badge variant={getStatusBadgeVariant(execution.status)}>{execution.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right panel: Quick Actions + Recent Workflows */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {[
                  { icon: Plus, label: 'New Workflow', path: '/workflows/builder', color: 'bg-blue-500' },
                  { icon: Bot, label: 'New Agent', path: '/agents', color: 'bg-green-500' },
                  { icon: Play, label: 'Executions', path: '/executions', color: 'bg-yellow-500' },
                  { icon: Bell, label: 'Alerts', path: '/notifications', color: 'bg-pink-500' },
                ].map(a => (
                  <Link key={a.path} to={a.path}>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
                        <div className={`p-1.5 rounded ${a.color} text-white`}><a.icon className="h-4 w-4" /></div>
                        <span className="text-xs">{a.label}</span>
                      </Button>
                    </motion.div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent Workflows</CardTitle>
                  <Link to="/workflows/builder"><Button variant="ghost" size="sm" className="text-xs h-7">View All</Button></Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <ListSkeleton rows={3} /> : recentWorkflows.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No workflows yet</p>
                    <p className="text-xs">Create your first workflow to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentWorkflows.map(wf => (
                      <Link key={wf.id} to={`/workflows/${wf.id}`}>
                        <div className="flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors">
                          <div className="p-1.5 rounded bg-blue-500/10"><GitBranch className="h-3 w-3 text-blue-500" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{wf.name}</p>
                            <p className="text-xs text-muted-foreground">{wf.nodes?.length || 0} nodes</p>
                          </div>
                          <Badge variant="outline" className={`text-xs ${wf.status === 'needs_configuration' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : ''}`}>
                            {wf.status === 'needs_configuration' ? 'Needs Setup' : wf.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card className="glass-card mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Notifications</CardTitle>
                  <CardDescription>Alerts and system updates</CardDescription>
                </div>
                <Link to="/notifications">
                  <Button variant="ghost" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border ${n.read ? 'opacity-60' : 'bg-muted/30'}`}>
                    <div className={`p-1.5 rounded ${n.read ? 'bg-gray-500/10' : 'bg-blue-500/10'}`}>
                      <Bell className={`h-3 w-3 ${n.read ? 'text-gray-400' : 'text-blue-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatRelativeTime(n.created_at)}
                      </div>
                    </div>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </motion.div>
    </div>
  );
}
