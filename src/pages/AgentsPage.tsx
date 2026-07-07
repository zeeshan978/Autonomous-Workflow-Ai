import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, Edit, Trash2, Play, Pause, Search, MoreVertical, Copy, Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getAgents, createAgent, updateAgent, deleteAgent as deleteAgentFromDb } from '@/services/database';
import type { Agent } from '@/types';

const MODELS = [
  { id: 'gemini-pro', name: 'Gemini Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
];

const AGENT_TEMPLATES = [
  { name: 'Sales Assistant', description: 'Helps with sales-related tasks', instructions: 'Assist with lead generation, follow-ups, and sales communications.' },
  { name: 'Data Analyst', description: 'Analyzes data and generates insights', instructions: 'Analyze data sets, identify trends, and create comprehensive reports.' },
  { name: 'Email Manager', description: 'Handles email automation', instructions: 'Draft, schedule, and manage email communications with templates.' },
  { name: 'Report Generator', description: 'Creates detailed reports', instructions: 'Generate structured reports from data with visualizations and summaries.' },
];

export function AgentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    system_prompt: '',
    temperature: 0.7,
    model: 'gemini-pro',
    status: 'active' as 'active' | 'paused' | 'archived'
  });

  useEffect(() => {
    if (user?.id) {
      loadAgents();
    }
  }, [user?.id]);

  const loadAgents = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getAgents(user.id);
      setAgents(data);
    } catch (error: any) { console.error(error); toast({ title: 'Failed to load agents', description: error?.message || String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, formData);
        toast({ title: 'Agent updated successfully' });
      } else {
        await createAgent({ ...formData, user_id: user.id, memory: {}, last_run: null });
        toast({ title: 'Agent created successfully' });
      }
      setShowForm(false);
      resetForm();
      loadAgents();
    } catch (error: any) { toast({ title: 'Failed to save agent', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      instructions: agent.instructions || '',
      system_prompt: agent.system_prompt || '',
      temperature: agent.temperature,
      model: agent.model,
      status: agent.status
    });
    setShowForm(true);
  };

  const handleDelete = async (agent: Agent) => {
    try {
      await deleteAgentFromDb(agent.id);
      toast({ title: 'Agent deleted' });
      setAgentToDelete(null);
      loadAgents();
    } catch (error: any) { toast({ title: 'Failed to delete agent', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    try {
      await updateAgent(agent.id, { status: newStatus });
      toast({ title: `Agent ${newStatus}` });
      loadAgents();
    } catch (error: any) { toast({ title: 'Failed to update status', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    if (!user?.id) return;
    try {
      await createAgent({
        user_id: user.id,
        name: `${agent.name} (Copy)`,
        description: agent.description,
        instructions: agent.instructions,
        system_prompt: agent.system_prompt,
        temperature: agent.temperature,
        model: agent.model,
        status: 'paused',
        memory: {},
        last_run: null
      });
      toast({ title: 'Agent duplicated' });
      loadAgents();
    } catch (error: any) { toast({ title: 'Failed to duplicate', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      instructions: '',
      system_prompt: '',
      temperature: 0.7,
      model: 'gemini-pro',
      status: 'active'
    });
    setEditingAgent(null);
  };

  const selectTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      instructions: template.instructions
    });
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Agents</h1>
            <p className="text-muted-foreground">Manage your AI automation agents</p>
          </div>
          <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAgent ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
                <DialogDescription>
                  {editingAgent ? 'Update agent configuration' : 'Configure your AI automation agent'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="My Agent"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select value={formData.model} onValueChange={(v) => setFormData({ ...formData, model: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What does this agent do?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Detailed instructions for the agent..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system_prompt">System Prompt (Optional)</Label>
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="Custom system prompt..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {formData.temperature.toFixed(2)}</Label>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={(v) => setFormData({ ...formData, temperature: v[0] })}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">Lower = more focused, Higher = more creative</p>
                </div>

                <div className="space-y-2">
                  <Label>Quick Templates</Label>
                  <div className="flex flex-wrap gap-2">
                    {AGENT_TEMPLATES.map((template) => (
                      <Button key={template.name} type="button" variant="outline" size="sm" onClick={() => selectTemplate(template)}>
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingAgent ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Agents Grid */}
        {filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No agents found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'Create your first AI agent to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredAgents.map((agent) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${agent.status === 'active' ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                            <Bot className={`h-5 w-5 ${agent.status === 'active' ? 'text-green-500' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{agent.name}</CardTitle>
                            <CardDescription className="line-clamp-1">{agent.description || 'No description'}</CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(agent)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(agent)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(agent)}>
                              {agent.status === 'active' ? (
                                <><Pause className="h-4 w-4 mr-2" /> Pause</>
                              ) : (
                                <><Play className="h-4 w-4 mr-2" /> Activate</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => setAgentToDelete(agent)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                        <span>{MODELS.find(m => m.id === agent.model)?.name || agent.model}</span>
                        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>Temp: {agent.temperature}</span>
                        {agent.last_run && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Last run: {new Date(agent.last_run).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t text-xs text-muted-foreground flex justify-between">
                        <span>Memory: {agent.memory ? Object.keys(agent.memory).length : 0} items</span>
                        <span className="text-primary cursor-pointer hover:underline" onClick={() => handleEdit(agent)}>View Settings</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => agentToDelete && handleDelete(agentToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
