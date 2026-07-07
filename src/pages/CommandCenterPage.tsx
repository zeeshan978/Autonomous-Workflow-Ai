import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Play, Save, Trash2, Mic, Paperclip, Loader2, Bot,
  CheckCircle, XCircle, Clock, ArrowRight, Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { generateWorkflowFromPrompt } from '@/services/api';
import { createWorkflow, createExecution, updateExecution, createNotification, createLog } from '@/services/database';
import { startExecution } from '@/services/executionEngine';
import { supabase } from '@/lib/supabase';
import type { Log } from '@/types';

const EXAMPLE_PROMPTS = [
  "Generate monthly invoices for all unpaid users",
  "Send follow-up emails to leads from last week",
  "Create sales analysis report and email the team",
  "Analyze customer feedback and generate insights",
  "Update CRM records with new contact information",
  "Process HR onboarding tasks for new employees"
];

export function CommandCenterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [generatedWorkflow, setGeneratedWorkflow] = useState<{
    name: string;
    description: string;
    nodes: Array<{ id: string; type: string; name: string; config: Record<string, unknown>; position: { x: number, y: number } }>;
    edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
    variables: Record<string, unknown>;
  } | null>(null);
  const [logs, setLogs] = useState<Array<{ level: string; message: string; timestamp: Date }>>([]);

  const addLog = (level: string, message: string) => {
    setLogs(prev => [...prev, { level, message, timestamp: new Date() }]);
  };

  const handleExecute = async () => {
    if (!prompt.trim() || !user?.id) {
      toast({
        title: 'Please enter a prompt',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setLogs([]);
    setProgress(0);
    setStatus('Analyzing prompt...');
    addLog('info', 'Starting AI analysis...');

    try {
      // Generate workflow from prompt
      setStatus('Generating workflow...');
      addLog('info', 'Generating workflow from prompt...');
      setProgress(10);

      const workflow = await generateWorkflowFromPrompt(prompt);
      setGeneratedWorkflow(workflow);
      addLog('info', `Workflow "${workflow.name}" generated successfully`);
      setProgress(30);

      // Save workflow to database
      setStatus('Saving workflow...');
      addLog('info', 'Saving workflow to database...');
      setProgress(40);

      const savedWorkflow = await createWorkflow({
        user_id: user.id,
        agent_id: null,
        name: workflow.name,
        description: workflow.description,
        prompt: prompt,
        nodes: workflow.nodes.map((n, index) => ({
          id: n.id,
          type: n.type,
          position: n.position || { x: 100, y: 100 + (index * 150) },
          data: { label: n.name, ...n.config }
        })),
        edges: workflow.edges || workflow.nodes.slice(1).map((n, index) => ({
          id: `edge-${index}`,
          source: workflow.nodes[index].id,
          target: n.id
        })),
        variables: workflow.variables,
        status: 'active',
        is_template: false
      });

      addLog('info', `Workflow saved with ID: ${savedWorkflow.id}`);
      setProgress(50);

      // Start execution
      setStatus('Starting execution...');
      addLog('info', 'Initializing workflow execution...');
      setProgress(60);

      setExecuting(true);
      const execution = await startExecution(user.id, savedWorkflow);

      addLog('info', `Execution started: ${execution.id}`);
      setProgress(70);

      // Poll execution progress
      let currentProgress = 0;
      let executionStatus = 'queued';
      
      while (executionStatus === 'queued' || executionStatus === 'running') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: latestExec } = await supabase
          .from('executions')
          .select('status, progress, error_message')
          .eq('id', execution.id)
          .single();
          
        if (latestExec) {
          executionStatus = latestExec.status;
          currentProgress = latestExec.progress;
          setProgress(currentProgress);
          setStatus(`Executing... ${currentProgress}%`);
          addLog('info', `Execution status: ${executionStatus}`);
        }
      }

      if (executionStatus === 'completed') {
        setProgress(100);
        setStatus('Completed!');
        addLog('success', 'Workflow execution completed successfully!');
        
        // Create notification
        await createNotification({
        user_id: user.id,
        type: 'execution_complete',
        title: 'Workflow Completed',
        message: `Your workflow "${workflow.name}" has been executed successfully.`,
        data: { workflow_id: savedWorkflow.id, execution_id: execution.id },
        read: false
      });

        toast({
          title: 'Workflow executed successfully!',
          description: workflow.name
        });
      } else {
        setStatus('Failed!');
        addLog('error', 'Workflow execution failed.');
        toast({
          title: 'Execution Failed',
          description: 'The workflow execution encountered an error.',
          variant: 'destructive'
        });
      }

      setExecuting(false);
      setLoading(false);

    } catch (error) {
      console.error('Execution failed:', error);
      addLog('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus('Failed');
      setExecuting(false);
      setLoading(false);
      toast({
        title: 'Execution failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  };

  const handleSaveWorkflow = async () => {
    if (!generatedWorkflow || !user) return;

    try {
      const savedWorkflow = await createWorkflow({
        user_id: user.id,
        agent_id: null,
        name: generatedWorkflow.name,
        description: generatedWorkflow.description,
        prompt: prompt,
        nodes: generatedWorkflow.nodes.map((n, index) => ({
          id: n.id,
          type: n.type,
          position: n.position || { x: 100, y: 100 + (index * 150) },
          data: { label: n.name, ...n.config }
        })),
        edges: generatedWorkflow.edges || generatedWorkflow.nodes.slice(1).map((n, index) => ({
          id: `edge-${index}`,
          source: generatedWorkflow.nodes[index].id,
          target: n.id
        })),
        variables: generatedWorkflow.variables,
        status: 'draft',
        is_template: false
      });

      toast({
        title: 'Workflow saved',
        description: `Saved as "${savedWorkflow.name}"`
      });

      navigate(`/workflows/${savedWorkflow.id}`);
    } catch (error: any) { toast({ title: 'Failed to save workflow', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleClear = () => {
    setPrompt('');
    setGeneratedWorkflow(null);
    setLogs([]);
    setProgress(0);
    setStatus('');
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">AI Command Center</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Describe what you want to automate and let AI handle the rest
          </p>
        </div>

        {/* Main Command Input */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  placeholder="Type your workflow command... e.g., 'Generate invoices for unpaid users and email managers'"
                  className="min-h-[120px] text-lg pr-12 resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Voice input (coming soon)"
                    disabled
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Attach file"
                    disabled
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  onClick={handleExecute}
                  disabled={loading || !prompt.trim()}
                  className="flex-1 sm:flex-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {status}
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Execute
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleSaveWorkflow}
                  disabled={!generatedWorkflow || loading}
                >
                  <Save className="h-5 w-5 mr-2" />
                  Save Workflow
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleClear}
                  disabled={loading}
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Example Prompts */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick(example)}
                disabled={loading}
                className="text-xs"
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        {/* Progress Section */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <p className="font-medium">{status}</p>
                    <Progress value={progress} className="h-2 mt-2" />
                  </div>
                  <span className="text-2xl font-bold">{progress}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results */}
        {generatedWorkflow && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workflow Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Generated Workflow
                </CardTitle>
                <CardDescription>{generatedWorkflow.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {generatedWorkflow.nodes.map((n, index) => (
                    <div key={n.id} className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                        {index + 1}
                      </div>
                      <Badge variant="outline">{n.type}</Badge>
                      <span className="flex-1">{n.name}</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Execution Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Execution Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 font-mono text-sm">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 ${
                          log.level === 'error' ? 'text-red-500' :
                          log.level === 'success' ? 'text-green-500' :
                          'text-muted-foreground'
                        }`}
                      >
                        <span className="opacity-50">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
