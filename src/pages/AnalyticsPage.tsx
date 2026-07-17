import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, Clock, CheckCircle, XCircle, Activity, Bot, GitBranch, Download, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAgents, getWorkflows } from '@/services/database';
import type { Agent, Workflow } from '@/types';
import { useExecutionsQuery } from '@/hooks/useExecutionsQuery';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const { data: executions = [], isLoading: executionsLoading } = useExecutionsQuery();

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, timeRange]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [agentsData, workflowsData] = await Promise.all([
        getAgents(user.id),
        getWorkflows(user.id)
      ]);
      setAgents(agentsData);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error('Failed to load analytics base data:', error);
    }
    setLoading(false);
  };

  const days = parseInt(timeRange);

  const computedAnalytics = useMemo(() => {
    // Filter executions by time range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    
    const recentExecutions = executions.filter(e => {
      if (!e.created_at) return false;
      const execDate = new Date(e.created_at.includes('T') && !e.created_at.endsWith('Z') && !e.created_at.includes('+') ? e.created_at + 'Z' : e.created_at);
      return format(execDate, 'yyyy-MM-dd') >= startDateStr;
    });
    
    // Daily Usage
    const dailyUsage: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = recentExecutions.filter(e => {
        if (!e.created_at) return false;
        const execDate = new Date(e.created_at.includes('T') && !e.created_at.endsWith('Z') && !e.created_at.includes('+') ? e.created_at + 'Z' : e.created_at);
        return format(execDate, 'yyyy-MM-dd') === dateStr;
      }).length;
      dailyUsage.push({ date: dateStr, count });
    }

    // Success rate from real data
    const completed = recentExecutions.filter(e => e.status === 'completed').length;
    const failed = recentExecutions.filter(e => e.status === 'failed').length;
    const running = recentExecutions.filter(e => e.status === 'running').length;
    const queued = recentExecutions.filter(e => e.status === 'queued').length;
    
    const successRate = [
      { name: 'Completed', value: completed },
      { name: 'Failed', value: failed }
    ];

    const taskCompletion = [
      { status: 'Pending', count: queued },
      { status: 'Running', count: running },
      { status: 'Completed', count: completed },
      { status: 'Failed', count: failed }
    ];

    // Workflows stats
    const workflowExecutionCounts: Record<string, number> = {};
    recentExecutions.forEach(e => {
      if (e.workflow_id) workflowExecutionCounts[e.workflow_id] = (workflowExecutionCounts[e.workflow_id] || 0) + 1;
    });

    const topWorkflows = workflows
      .map(wf => ({ name: wf.name, executions: workflowExecutionCounts[wf.id] || 0 }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 5);

    const topAgents = agents
      .map(agent => ({ name: agent.name, executions: workflowExecutionCounts[agent.id] || 0 }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 5);

    const agentUsage = agents.map(agent => ({
      name: agent.name,
      count: recentExecutions.length > 0 ? Math.ceil(recentExecutions.length / Math.max(agents.length, 1)) : 0
    }));

    // Execution time
    const executionTime = dailyUsage.map(d => {
      const dayExecs = recentExecutions.filter(e => {
        if (!e.created_at || e.status !== 'completed' || !e.started_at || !e.completed_at) return false;
        const execDate = new Date(e.created_at.includes('T') && !e.created_at.endsWith('Z') && !e.created_at.includes('+') ? e.created_at + 'Z' : e.created_at);
        return format(execDate, 'yyyy-MM-dd') === d.date;
      });
      let avgTime = 0;
      if (dayExecs.length > 0) {
        const total = dayExecs.reduce((sum, e) => {
          return sum + (new Date(e.completed_at!).getTime() - new Date(e.started_at!).getTime());
        }, 0);
        avgTime = total / dayExecs.length;
      }
      return { date: d.date, avg_time: avgTime };
    });

    const stats = {
      totalWorkflows: workflows.length,
      runningExecutions: running,
      completedExecutions: completed,
      failedExecutions: failed,
      savedTemplates: workflows.filter(w => w.is_template).length,
      totalAgents: agents.length,
      successRate: recentExecutions.length > 0 ? Math.round((completed / recentExecutions.length) * 100) : 0,
      todayExecutions: dailyUsage[dailyUsage.length - 1]?.count || 0
    };

    return { dailyUsage, agentUsage, successRate, taskCompletion, topAgents, topWorkflows, executionTime, stats };
  }, [executions, agents, workflows, days]);

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Total Executions,Avg Execution Time(ms)\n"
      + computedAnalytics.dailyUsage.map((d: any, i: number) => `${d.date},${d.count},${computedAnalytics.executionTime[i]?.avg_time || 0}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || executionsLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Analytics</h1>
            <p className="text-muted-foreground">Insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><Activity className="mr-2 h-4 w-4" />Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{computedAnalytics.stats.successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Based on recent executions</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><CheckCircle className="mr-2 h-4 w-4" />Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{computedAnalytics.stats.completedExecutions}</div>
              <p className="text-xs text-muted-foreground mt-1">In selected period</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><XCircle className="mr-2 h-4 w-4" />Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{computedAnalytics.stats.failedExecutions}</div>
              <p className="text-xs text-muted-foreground mt-1">In selected period</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><Bot className="mr-2 h-4 w-4" />Active Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{computedAnalytics.stats.totalAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">Available for workflows</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="h-80">
              {computedAnalytics.dailyUsage.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={computedAnalytics.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="h-80">
              {computedAnalytics.successRate.every((s: any) => s.value === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">No executions found</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={computedAnalytics.successRate}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label
                    >
                      {[0, 1].map((i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>Most active agents and workflows</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computedAnalytics.topAgents} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="executions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Popularity</CardTitle>
              <CardDescription>Most used workflows</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computedAnalytics.topWorkflows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="executions" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Average Execution Time Trend</CardTitle>
            <CardDescription>Execution duration over time (ms)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={computedAnalytics.executionTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="avg_time" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
