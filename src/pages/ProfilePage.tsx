import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Calendar, Edit, Camera } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { updateProfile, updateUser, uploadFile, getDashboardStats } from '@/services/database';
import { Activity, Bot, GitBranch } from 'lucide-react';

export function ProfilePage() {
  const { user, profile, refreshUser } = useAuth();
  const { toast } = useToast();
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: profile?.company_name || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    full_name: user?.full_name || ''
  });
  const [stats, setStats] = useState({
    totalWorkflows: 0,
    completedExecutions: 0,
    totalAgents: 0
  });

  useState(() => {
    if (user?.id) {
      getDashboardStats(user.id).then(data => setStats(data)).catch(console.error);
    }
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      toast({ title: 'Uploading avatar...' });
      const uploaded = await uploadFile(user.id, file);
      await updateUser(user.id, { avatar_url: uploaded.storage_path });
      await refreshUser();
      toast({ title: 'Avatar updated successfully' });
    } catch (error: any) { toast({ title: 'Failed to upload avatar', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await updateProfile(user.id, {
        company_name: formData.company_name,
        phone: formData.phone,
        address: formData.address
      });
      await updateUser(user.id, {
        full_name: formData.full_name
      });
      await refreshUser();
      toast({ title: 'Profile updated successfully' });
      setShowEdit(false);
    } catch (error: any) { toast({ title: 'Failed to update profile', description: error?.message || String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Profile</h1>
            <p className="text-muted-foreground">Your account information</p>
          </div>
        </div>

        {/* Profile Header */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar_url || ''} />
                  <AvatarFallback className="text-2xl">
                    {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button variant="outline" size="icon" className="absolute bottom-0 right-0 rounded-full h-6 w-6" onClick={() => document.getElementById('avatar-upload')?.click()}>
                  <Camera className="h-3 w-3" />
                </Button>
                <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{user.full_name || 'User'}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                  <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>{user.status}</Badge>
                </div>
              </div>
              <Button onClick={() => setShowEdit(true)}>
                <Edit className="h-4 w-4 mr-2" />Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{user.role}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <User className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{user.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="mx-auto p-3 rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <GitBranch className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">{stats.totalWorkflows}</h3>
              <p className="text-muted-foreground text-sm">Workflows Built</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="mx-auto p-3 rounded-full bg-green-500/10 w-12 h-12 flex items-center justify-center mb-4">
                <Activity className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold">{stats.completedExecutions}</h3>
              <p className="text-muted-foreground text-sm">Successful Executions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="mx-auto p-3 rounded-full bg-purple-500/10 w-12 h-12 flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-2xl font-bold">{stats.totalAgents}</h3>
              <p className="text-muted-foreground text-sm">Active Agents</p>
            </CardContent>
          </Card>
        </div>

        {/* Company Info */}
        {profile && (
          <Card className="glass-card">
            <CardHeader className="p-6 border-b border-border/50">
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{profile.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{profile.address || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timezone</p>
                  <p className="font-medium">{profile.timezone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Language</p>
                  <p className="font-medium">{profile.language}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
