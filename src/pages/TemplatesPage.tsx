import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Trash2, GitBranch, Search, Eye, Star, Users, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getWorkflows, createWorkflow, deleteWorkflow } from '@/services/database';
import type { Workflow } from '@/types';
import { DEFAULT_TEMPLATES, COMMUNITY_TEMPLATES, type TemplateDefinition } from '@/data/templates';

export function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTemplate, setDeleteTemplate] = useState<Workflow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDefinition | null>(null);

  const categories = Array.from(new Set(DEFAULT_TEMPLATES.map(t => t.category)));

  useEffect(() => {
    if (user?.id) {
      loadTemplates();
    }
  }, [user?.id]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getWorkflows(user.id);
      setTemplates(data.filter(w => w.is_template));
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
    setLoading(false);
  };

  const handleUseTemplate = async (template: TemplateDefinition) => {
    toast({ title: 'Template loaded', description: 'Configure your new workflow' });
    navigate('/workflows/new', { state: { template } });
  };

  const handleDuplicate = async (template: Workflow) => {
    if (!user?.id) return;
    try {
      await createWorkflow({
        user_id: user.id,
        agent_id: template.agent_id,
        name: `${template.name} (Copy)`,
        description: template.description,
        prompt: template.prompt,
        nodes: template.nodes,
        edges: template.edges,
        variables: template.variables,
        status: 'draft',
        is_template: false
      });
      toast({ title: 'Template duplicated' });
      loadTemplates();
    } catch (error: any) { toast({ title: 'Failed to duplicate', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleDelete = async (template: Workflow) => {
    try {
      await deleteWorkflow(template.id);
      toast({ title: 'Template deleted' });
      setDeleteTemplate(null);
      loadTemplates();
    } catch (error: any) { toast({ title: 'Failed to delete', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const filterTemplates = (list: any[]) => list.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
    (categoryFilter === 'all' || t.category === categoryFilter)
  );

  const renderTemplateCard = (template: any, isCommunity = false) => (
    <motion.div key={template.name || template.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="hover:shadow-lg transition-shadow h-full flex flex-col group">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              {template.featured ? <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" /> : 
               isCommunity ? <Users className="h-5 w-5 text-purple-500" /> : 
               <GitBranch className="h-5 w-5 text-primary" />}
            </div>
            <Badge variant="outline">{template.category || 'Custom'}</Badge>
          </div>
          <CardTitle className="text-lg">{template.name}</CardTitle>
          <CardDescription className="line-clamp-2 min-h-[40px]">{template.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 mt-auto">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground mb-4">
            <div className="flex items-center justify-between">
              <span>{template.nodes?.length || 0} nodes</span>
              {template.difficulty && (
                <Badge variant="secondary" className="text-xs">
                  {template.difficulty}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>{template.estimated_time ? `~${template.estimated_time}` : ''}</span>
              {isCommunity && <span>by @{template.author}</span>}
            </div>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {template.id ? (
              <>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDuplicate(template)}>
                  <Copy className="h-4 w-4 mr-1" />Duplicate
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTemplate(template)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button className="flex-1" size="sm" onClick={() => handleUseTemplate(template)}>
                  <Copy className="h-4 w-4 mr-1" /> Use
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPreviewTemplate(template)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {/* Fallback for touch devices where hover isn't present */}
          <div className="flex gap-2 md:hidden">
            {template.id ? (
              <>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDuplicate(template)}>Dup</Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTemplate(template)}><Trash2 className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <Button className="flex-1" size="sm" onClick={() => handleUseTemplate(template)}>Use</Button>
                <Button variant="outline" size="sm" onClick={() => setPreviewTemplate(template)}><Eye className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workflow Templates</h1>
          <p className="text-muted-foreground">Pre-built workflows ready to use</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Featured Templates */}
        {categoryFilter === 'all' && !searchQuery && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500 fill-yellow-500" /> Featured Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEFAULT_TEMPLATES.filter(t => t.featured).map(t => renderTemplateCard(t))}
            </div>
          </div>
        )}

        {/* All Available Templates */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><GitBranch className="h-5 w-5" /> Official Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filterTemplates(DEFAULT_TEMPLATES.filter(t => !t.featured)).map(t => renderTemplateCard(t))}
          </div>
        </div>

        {/* Community Templates */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-purple-500" /> Community Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filterTemplates(COMMUNITY_TEMPLATES).map(t => renderTemplateCard(t, true))}
          </div>
        </div>

        {/* User Templates */}
        {filterTemplates(templates).length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Custom Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filterTemplates(templates).map(t => renderTemplateCard(t))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge>{previewTemplate?.category}</Badge>
              {previewTemplate?.featured && <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600"><Star className="h-3 w-3 mr-1 fill-yellow-500" /> Featured</Badge>}
            </div>
            <DialogTitle className="text-2xl">{previewTemplate?.name}</DialogTitle>
            <DialogDescription className="text-base pt-2">{previewTemplate?.description}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">Workflow Specs</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Nodes</p>
                  <p className="font-medium text-lg">{previewTemplate?.nodes?.length || 0}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Est. Time</p>
                  <p className="font-medium text-lg">{previewTemplate?.estimated_time || '2 mins'}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Difficulty</p>
                  <p className="font-medium text-lg">{previewTemplate?.difficulty || 'Beginner'}</p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">Included Capabilities</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> AI Processing ready</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Error handling built-in</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Pre-configured variables</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Close</Button>
            <Button onClick={() => { if (previewTemplate) { handleUseTemplate(previewTemplate); setPreviewTemplate(null); } }}>
              <Copy className="h-4 w-4 mr-2" /> Use This Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteTemplate?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTemplate && handleDelete(deleteTemplate)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
