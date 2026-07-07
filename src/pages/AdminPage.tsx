import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Users, UserCheck, UserX, Database, Activity, RefreshCw,
  Search, MoreVertical, Edit, Trash2, Ban, Key, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getAllUsers, updateUserStatus, updateUserRole } from '@/services/database';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'delete' | 'role'>('activate');
  const [systemData, setSystemData] = useState<{ date: string; queries: number; latency: number }[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
      loadSystemAnalytics();
    } else if (user) {
      navigate('/');
    }
  }, [user]);

  const loadSystemAnalytics = async () => {
    try {
      const { data } = await supabase.from('executions').select('started_at, completed_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (!data) return;
      
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const statsMap = new Map<string, { queries: number; totalLatency: number }>();
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        statsMap.set(days[d.getDay()], { queries: 0, totalLatency: 0 });
      }

      data.forEach((exec: any) => {
        if (!exec.started_at) return;
        const d = new Date(exec.started_at);
        const dayName = days[d.getDay()];
        if (statsMap.has(dayName)) {
          const stats = statsMap.get(dayName)!;
          stats.queries++;
          if (exec.completed_at) {
            stats.totalLatency += (new Date(exec.completed_at).getTime() - d.getTime());
          }
        }
      });

      const chartData = Array.from(statsMap.entries()).map(([date, stats]) => ({
        date,
        queries: stats.queries,
        latency: stats.queries > 0 ? Math.round(stats.totalLatency / stats.queries) : 0
      }));
      
      setSystemData(chartData);
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { users: data, total } = await getAllUsers(1, 100);
      setUsers(data);
      setTotalUsers(total);
    } catch (error: any) { console.error(error); toast({ title: 'Failed to load users', description: error?.message || String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleStatusUpdate = async (targetUser: User, status: 'active' | 'suspended' | 'inactive') => {
    try {
      await updateUserStatus(targetUser.id, status);
      toast({ title: `User ${status}` });
      loadUsers();
    } catch (error: any) { toast({ title: 'Failed to update status', description: error?.message || String(error), variant: 'destructive' });
    }
    setSelectedUser(null);
  };

  const handleRoleUpdate = async (targetUser: User, role: 'admin' | 'manager' | 'employee') => {
    try {
      await updateUserRole(targetUser.id, role);
      toast({ title: 'Role updated' });
      loadUsers();
    } catch (error: any) { toast({ title: 'Failed to update role', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    admins: users.filter(u => u.role === 'admin').length,
    managers: users.filter(u => u.role === 'manager').length,
    employees: users.filter(u => u.role === 'employee').length
  };

  // System analytics is now fetched dynamically
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (user?.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Panel
            </h1>
            <p className="text-muted-foreground">Manage users, roles, and system settings</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { icon: Users, label: 'Total Users', value: stats.total, color: 'text-blue-500' },
            { icon: UserCheck, label: 'Active', value: stats.active, color: 'text-green-500' },
            { icon: UserX, label: 'Suspended', value: stats.suspended, color: 'text-red-500' },
            { icon: Key, label: 'Admins', value: stats.admins, color: 'text-purple-500' },
            { icon: UserCheck, label: 'Managers', value: stats.managers, color: 'text-amber-500' },
            { icon: Users, label: 'Employees', value: stats.employees, color: 'text-cyan-500' }
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <div>
                    <p className="text-xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />User Management</TabsTrigger>
            <TabsTrigger value="system"><Database className="h-4 w-4 mr-2" />System Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>Manage user accounts and permissions</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search users..." className="pl-10 w-48" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((tableUser) => (
                      <TableRow key={tableUser.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {tableUser.full_name?.charAt(0).toUpperCase() || tableUser.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{tableUser.full_name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{tableUser.email}</TableCell>
                        <TableCell>
                          <Select value={tableUser.role} onValueChange={(v) => handleRoleUpdate(tableUser, v as typeof tableUser.role)}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tableUser.status === 'active' ? 'default' : tableUser.status === 'suspended' ? 'destructive' : 'secondary'}>
                            {tableUser.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(tableUser.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedUser(tableUser); setActionType('activate'); }}>
                                <UserCheck className="h-4 w-4 mr-2" />Activate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedUser(tableUser); setActionType('suspend'); }}>
                                <Ban className="h-4 w-4 mr-2" />Suspend
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => { setSelectedUser(tableUser); setActionType('delete'); }}>
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Database Queries</CardTitle>
                  <CardDescription>Database activity over the past week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={systemData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="queries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Latency (ms)</CardTitle>
                  <CardDescription>Average API response time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={systemData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="latency" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
                <CardDescription>Users by role</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Admins', value: stats.admins || 1 },
                        { name: 'Managers', value: stats.managers || 1 },
                        { name: 'Employees', value: stats.employees || 1 }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label
                    >
                      {[0, 1, 2].map((i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'activate' ? 'Activate User' : actionType === 'suspend' ? 'Suspend User' : 'Delete User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'delete'
                ? `Are you sure you want to delete "${selectedUser?.email}"? This cannot be undone.`
                : `Are you sure you want to ${actionType} "${selectedUser?.email}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => selectedUser && handleStatusUpdate(selectedUser, actionType === 'activate' ? 'active' : 'suspended')}
            >
              {actionType === 'activate' ? 'Activate' : actionType === 'suspend' ? 'Suspend' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
