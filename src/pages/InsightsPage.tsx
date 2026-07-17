import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, BarChart2, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function InsightsPage() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['insights', user?.id],
    queryFn: async () => {
      // In a real scenario, this would be a custom RPC or complex edge function
      // For now we aggregate client-side from the last 100 executions
      const { data: executions } = await supabase
        .from('executions')
        .select('*, workflows(name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
        
      const execs = executions || [];
      const total = execs.length;
      const completed = execs.filter(e => e.status === 'completed').length;
      const failed = execs.filter(e => e.status === 'failed').length;
      const running = execs.filter(e => e.status === 'running').length;
      
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      let totalTime = 0;
      let timeCount = 0;
      execs.forEach(e => {
        if (e.started_at && e.completed_at) {
          totalTime += (new Date(e.completed_at).getTime() - new Date(e.started_at).getTime());
          timeCount++;
        }
      });
      const avgRuntime = timeCount > 0 ? (totalTime / timeCount / 1000).toFixed(1) : 0;

      // Group by date
      const trendMap: Record<string, { date: string, executions: number, successes: number }> = {};
      execs.forEach(e => {
        const date = new Date(e.created_at).toLocaleDateString();
        if (!trendMap[date]) trendMap[date] = { date, executions: 0, successes: 0 };
        trendMap[date].executions++;
        if (e.status === 'completed') trendMap[date].successes++;
      });
      const trendData = Object.values(trendMap).reverse();

      // Status dist
      const statusData = [
        { name: 'Completed', value: completed, color: '#10b981' },
        { name: 'Failed', value: failed, color: '#ef4444' },
        { name: 'Running', value: running, color: '#3b82f6' },
      ];

      return { total, completed, failed, running, successRate, avgRuntime, trendData, statusData };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Workflow Insights</h1>
          <p className="text-muted-foreground">Live analytics and performance metrics for your automations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total}</div>
            <p className="text-xs text-muted-foreground">Last 100 runs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data?.successRate}%</div>
            <p className="text-xs text-muted-foreground">{data?.completed} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data?.failed}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Runtime</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.avgRuntime}s</div>
            <p className="text-xs text-muted-foreground">Per execution</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Execution Trend</CardTitle>
            <CardDescription>Daily executions over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" opacity={0.5} />
                <YAxis opacity={0.5} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff' }} 
                />
                <Line type="monotone" dataKey="executions" stroke="hsl(var(--primary))" strokeWidth={3} />
                <Line type="monotone" dataKey="successes" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Breakdown by execution status</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data?.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
