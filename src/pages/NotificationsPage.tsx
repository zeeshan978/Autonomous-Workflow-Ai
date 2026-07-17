import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2, AlertCircle, Info, AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '@/services/database';
import type { Notification } from '@/types';

export function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
    }
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
    setLoading(false);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error: any) { toast({ title: 'Failed to update', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsRead(user.id);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      toast({ title: 'All notifications marked as read' });
    } catch (error: any) { toast({ title: 'Failed to update', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error: any) { toast({ title: 'Failed to delete', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const filteredNotifications = notifications.filter(n => typeFilter === 'all' || n.type === typeFilter);
  const unreadNotifications = filteredNotifications.filter(n => !n.read);
  const readNotifications = filteredNotifications.filter(n => n.read);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return AlertCircle;
      case 'warning': return AlertTriangle;
      case 'success': return CheckCircle;
      default: return Info;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'success': return 'text-green-500';
      default: return 'text-blue-500';
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const Icon = getIcon(notification.type);
    const iconColor = getIconColor(notification.type);

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-start gap-4 p-4 border-b ${!notification.read ? 'bg-muted/50' : ''}`}
      >
        <div className={`p-2 rounded-full bg-muted ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{notification.title}</p>
          {notification.message && (
            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(notification.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {!notification.read && (
            <Button variant="ghost" size="sm" onClick={() => handleMarkRead(notification.id)}>
              <CheckCheck className="h-4 w-4 mr-1" />Mark Read
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleDelete(notification.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Notifications</h1>
            <p className="text-muted-foreground">Stay updated with alerts</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            {unreadNotifications.length > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read ({unreadNotifications.length})
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="glass-card transition-premium hover:border-primary/50">
            <CardContent className="p-5 text-center">
              <div className="p-3 bg-blue-500/10 rounded-full inline-block mb-3">
                <Bell className="h-6 w-6 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{notifications.length}</p>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="glass-card transition-premium hover:border-primary/50">
            <CardContent className="p-5 text-center">
              <div className="p-3 bg-amber-500/10 rounded-full inline-block mb-3">
                <Mail className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-2xl font-bold">{unreadNotifications.length}</p>
              <p className="text-sm font-medium text-muted-foreground">Unread</p>
            </CardContent>
          </Card>
          <Card className="glass-card transition-premium hover:border-primary/50">
            <CardContent className="p-5 text-center">
              <div className="p-3 bg-red-500/10 rounded-full inline-block mb-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-2xl font-bold">{notifications.filter(n => n.type === 'error').length}</p>
              <p className="text-sm font-medium text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <Tabs defaultValue="unread">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="unread">Unread ({unreadNotifications.length})</TabsTrigger>
                <TabsTrigger value="all">All ({filteredNotifications.length})</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-0">
              <TabsContent value="unread">
                <ScrollArea className="h-[500px]">
                  {unreadNotifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No unread notifications</p>
                    </div>
                  ) : (
                    unreadNotifications.map(n => <NotificationItem key={n.id} notification={n} />)
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="all">
                <ScrollArea className="h-[500px]">
                  {filteredNotifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications match filter</p>
                    </div>
                  ) : (
                    filteredNotifications.map(n => <NotificationItem key={n.id} notification={n} />)
                  )}
                </ScrollArea>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </motion.div>
    </div>
  );
}
