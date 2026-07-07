import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Bot, GitBranch, Play, CheckSquare, FileText, LineChart,
  Copy, FolderOpen, Bell, Settings, User
} from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search... (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/workflows/builder'))}>
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Workflow Builder</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/agents'))}>
            <Bot className="mr-2 h-4 w-4" />
            <span>AI Agents</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/executions'))}>
            <Play className="mr-2 h-4 w-4" />
            <span>Executions</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/reports'))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Reports</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/templates'))}>
            <Copy className="mr-2 h-4 w-4" />
            <span>Templates</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/profile'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
