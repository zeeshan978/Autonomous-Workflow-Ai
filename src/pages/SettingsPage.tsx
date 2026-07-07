import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Settings, User, Lock, Bell, Palette, Shield, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import { updateSettings, updateProfile } from '@/services/database';
import { Key } from 'lucide-react';
import { useAccent } from '@/hooks/useAccent';

export function SettingsPage() {
  const { user, profile, settings, updatePassword, updateProfile: updateProfileAuth, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({ company_name: '', phone: '', address: '', timezone: 'UTC', language: 'en' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notificationSettings, setNotificationSettings] = useState({ notifications_enabled: true, email_notifications: true });
  const [apiKeys, setApiKeys] = useState({ openai: '', anthropic: '', google: '' });

  useEffect(() => {
    if (profile) {
      setProfileData({ 
        company_name: profile.company_name || '', 
        phone: profile.phone || '', 
        address: profile.address || '',
        timezone: profile.timezone || 'UTC',
        language: profile.language || 'en'
      });
    }
    if (settings) {
      setNotificationSettings({
        notifications_enabled: settings.notifications_enabled,
        email_notifications: settings.email_notifications
      });
      setApiKeys({
        openai: settings.api_keys?.openai || '',
        anthropic: settings.api_keys?.anthropic || '',
        google: settings.api_keys?.google || ''
      });
    }
  }, [profile, settings]);

  const handleProfileSave = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await updateProfile(user.id, profileData);
      await refreshUser();
      toast({ title: 'Profile updated' });
    } catch (error: any) { toast({ title: 'Failed to update profile', description: error?.message || String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await updatePassword(passwordData.newPassword);
    if (result.error) {
      toast({ title: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Password changed successfully' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
    setLoading(false);
  };

  const handleNotificationSave = async () => {
    if (!user || !settings) return;
    setLoading(true);
    try {
      await updateSettings(settings.user_id, { ...notificationSettings, api_keys: apiKeys });
      toast({ title: 'Settings updated' });
    } catch (error: any) { toast({ title: 'Failed to update', description: error?.message || String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 max-w-3xl bg-muted/30 p-1 rounded-xl glass-panel">
            {[
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'providers', icon: Key, label: 'AI Providers' },
              { id: 'security', icon: Lock, label: 'Security' },
              { id: 'appearance', icon: Palette, label: 'Theme' },
              { id: 'notifications', icon: Bell, label: 'Alerts' }
            ].map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="relative py-2.5 px-4 rounded-lg transition-colors data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="settings-active-tab" 
                    className="absolute inset-0 bg-primary rounded-lg shadow-lg"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center font-medium tracking-wide">
                  <tab.icon className="h-4 w-4 mr-2" />{tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={user?.full_name || ''} disabled />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" value={profileData.company_name} onChange={(e) => setProfileData({ ...profileData, company_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={profileData.timezone} onValueChange={(v) => setProfileData({ ...profileData, timezone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (US)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (US)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={profileData.language} onValueChange={(v) => setProfileData({ ...profileData, language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleProfileSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Providers Tab */}
          <TabsContent value="providers">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>AI Provider API Keys</CardTitle>
                <CardDescription>Configure keys for LLM execution nodes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai">OpenAI API Key</Label>
                  <Input id="openai" type="password" placeholder="sk-..." value={apiKeys.openai} onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anthropic">Anthropic API Key</Label>
                  <Input id="anthropic" type="password" placeholder="sk-ant-..." value={apiKeys.anthropic} onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google">Google Gemini API Key</Label>
                  <Input id="google" type="password" placeholder="AIza..." value={apiKeys.google} onChange={(e) => setApiKeys({ ...apiKeys, google: e.target.value })} />
                </div>
                <Button onClick={handleNotificationSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />Save API Keys
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
                </div>
                <Button onClick={handlePasswordChange} disabled={loading}>
                  <Lock className="h-4 w-4 mr-2" />Change Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Theme Preferences</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                  </div>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Accent Color</p>
                    <p className="text-sm text-muted-foreground">Select your primary accent color</p>
                  </div>
                  <Select value={accent} onValueChange={(v) => setAccent(v as any)}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="emerald">Emerald</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="rose">Rose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure how you receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive in-app notifications</p>
                  </div>
                  <Switch
                    checked={notificationSettings.notifications_enabled}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, notifications_enabled: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive email alerts</p>
                  </div>
                  <Switch
                    checked={notificationSettings.email_notifications}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, email_notifications: checked })}
                  />
                </div>
                <Button onClick={handleNotificationSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
