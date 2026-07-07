import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Bot, GitBranch, Play, CheckSquare, FileText, LineChart,
  Copy, FolderOpen, Bell, Settings, User, Shield, Search, LogOut,
  Moon, Sun, Menu, X, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { globalSearch, getNotifications } from '@/services/database';
import { useToast } from '@/hooks/use-toast';
import { CommandPalette } from '@/components/CommandPalette';
import { AIAssistantFab } from '@/components/AIAssistantFab';
import { AuroraBackground } from '@/components/AuroraBackground';
import { CursorGlow } from '@/components/CursorGlow';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', hoverAnim: { y: [0, -4, 0], transition: { duration: 0.3 } } },
  { icon: Zap, label: 'AI Command Center', path: '/command-center', hoverAnim: { opacity: [1, 0.4, 1, 0.4, 1], scale: 1.1, transition: { duration: 0.4 } } },
  { icon: Bot, label: 'AI Agents', path: '/agents', hoverAnim: { scaleY: [1, 0.8, 1, 0.8, 1], transition: { duration: 0.3 } } },
  { icon: GitBranch, label: 'Workflow Builder', path: '/workflows/builder', hoverAnim: { rotate: 15, scale: 1.1, transition: { duration: 0.25 } } },
  { icon: Play, label: 'Executions', path: '/executions', hoverAnim: { x: 4, scale: 1.1, transition: { duration: 0.25 } } },
  { icon: CheckSquare, label: 'Scheduler', path: '/scheduler', hoverAnim: { scale: 1.1, rotate: -5, transition: { duration: 0.25 } } },
  { icon: LineChart, label: 'Insights', path: '/insights', hoverAnim: { y: -2, scale: 1.05, transition: { duration: 0.25 } } },
  { icon: LineChart, label: 'Analytics', path: '/analytics', hoverAnim: { y: [0, -3, 0], scale: 1.1, transition: { duration: 0.3 } } },
  { icon: Copy, label: 'Templates', path: '/templates', hoverAnim: { scale: 1.1, x: 2, y: -2, transition: { duration: 0.25 } } },
  { icon: FolderOpen, label: 'Files', path: '/files', hoverAnim: { rotate: -15, scale: 1.1, transition: { duration: 0.25 } } },
  { icon: Bell, label: 'Notifications', path: '/notifications', hoverAnim: { rotate: [0, 15, -10, 10, -5, 0], transition: { duration: 0.5, ease: "easeOut" } } },
  { icon: Settings, label: 'Settings', path: '/settings', hoverAnim: { rotate: 90, transition: { duration: 0.4, ease: "easeOut" } } },
  { icon: User, label: 'Profile', path: '/profile', hoverAnim: { scale: 1.2, transition: { duration: 0.25 } } },
];

const ADMIN_NAV_ITEMS = [
  { icon: Shield, label: 'Admin Panel', path: '/admin', hoverAnim: { scale: 1.1, y: -2 } },
];

export function Layout({ children }: LayoutProps) {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown[]>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);

  const isAdmin = user?.role === 'admin';
  const [unreadCount, setUnreadCount] = useState(0);

  // Cursor glow moved to separate component to prevent Layout re-renders

  // Load unread notification count
  useEffect(() => {
    if (!user?.id) return;
    getNotifications(user.id)
      .then(notifs => setUnreadCount(notifs.filter(n => !n.read).length))
      .catch(() => {});
  }, [user?.id]);

  // If no session at all, redirect to auth
  if (!user && !session) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!user?.id || searchQuery.length < 2) {
        setSearchResults({});
        return;
      }

      setSearching(true);
      try {
        const results = await globalSearch(user.id, searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      }
      setSearching(false);
    };

    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, user?.id]);

  const handleSearchNavigate = (type: string, id: string) => {
    const paths: Record<string, string> = {
      workflows: '/workflows',
      tasks: '/tasks',
      agents: '/agents',
      reports: '/reports',
      files: '/files'
    };
    // For workflows, go directly to the workflow builder with the id
    if (type === 'workflows') {
      navigate(`/workflows/${id}`);
    } else {
      navigate(`${paths[type]}`);
    }
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out successfully', description: 'See you next time!' });
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <AuroraBackground />
      <CursorGlow />

      {/* Top Bar */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 h-16 glass-panel z-50 flex items-center px-4 gap-4 border-b-0 border-b border-primary/20 shadow-[0_4px_30px_rgba(var(--primary),0.1)]"
      >
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <Link to="/" className="flex items-center gap-2 font-bold text-xl overflow-hidden min-w-[240px]">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Animated SVG Robot Logo */}
            <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <motion.rect
                x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, ease: "easeInOut", delay: 0.2 }}
              />
              <motion.path
                d="M12 5V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut", delay: 1 }}
              />
              <motion.circle
                cx="12" cy="5" r="2" fill="currentColor"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: "backOut", delay: 1.3 }}
              />
              {/* Glowing Eyes */}
              <motion.circle
                cx="8" cy="16" r="1.5" fill="currentColor"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: [1, 1.5, 1], filter: ["blur(0px)", "blur(2px)", "blur(0px)"] }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 1.6 }}
              />
              <motion.circle
                cx="16" cy="16" r="1.5" fill="currentColor"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: [1, 1.5, 1], filter: ["blur(0px)", "blur(2px)", "blur(0px)"] }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 1.6 }}
              />
            </motion.svg>
          </div>
          <span className="hidden sm:inline flex-1 whitespace-nowrap">
            <motion.span
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 1 },
                visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 2 } }
              }}
            >
              {"Autonomous Workflow AI".split("").map((char, index) => (
                <motion.span 
                  key={index} 
                  variants={{ 
                    hidden: { opacity: 0, y: 5 }, 
                    visible: { opacity: 1, y: 0 } 
                  }}
                  className="inline-block transition-all duration-300 hover:text-primary hover:tracking-wide cursor-default"
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </motion.span>
          </span>
        </Link>

        <motion.div 
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "100%", opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
          className="flex-1 max-w-xl mx-4 relative hidden md:block overflow-hidden"
        >
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            placeholder="Search... (Ctrl+K)"
            className="pl-10 transition-all duration-300 w-64 focus:w-full bg-black/20 border-white/10 glass-panel"
            readOnly
            onClick={() => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
            }}
          />


        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="flex items-center gap-2 ml-auto"
        >
          <Link to="/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>

          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-2 ml-4 group cursor-pointer"
          >
            <div className="relative">
              <Avatar className="h-8 w-8 transition-premium group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.5)]">
                <AvatarImage src={user?.avatar_url || ''} />
                <AvatarFallback>
                  {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse -z-10 group-hover:scale-150 transition-all duration-500 opacity-0 group-hover:opacity-100" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role || 'employee'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </motion.header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 lg:top-16 bottom-0 lg:w-64 glass-panel transition-all duration-300 z-40",
          "lg:border-r-0 lg:rounded-none lg:shadow-2xl",
          "max-lg:w-20 max-lg:top-20 max-lg:left-4 max-lg:bottom-4 max-lg:rounded-2xl max-lg:border max-lg:shadow-[0_0_40px_rgba(var(--primary),0.15)]",
          !sidebarOpen && "-translate-x-full lg:translate-x-0 max-lg:opacity-0 pointer-events-none lg:pointer-events-auto"
        )}
      >
        <ScrollArea className="h-full">
          <nav className="p-4 space-y-1 lg:space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path.split('/')[1]));

              return (
                <motion.div
                  key={item.path}
                  initial="initial"
                  whileHover="hover"
                  variants={{
                    initial: { x: 0 },
                    hover: { x: 6, transition: { duration: 0.25, ease: "easeOut" } }
                  }}
                >
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative group overflow-hidden",
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      "max-lg:justify-center max-lg:px-0"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-primary/20 border border-primary/40 rounded-xl backdrop-blur-sm"
                        style={{ boxShadow: '0 0 20px var(--primary)' }}
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <motion.div
                      className="relative z-10 flex items-center justify-center"
                      variants={{
                        initial: { scale: 1, rotate: 0, x: 0, y: 0 },
                        hover: { ...item.hoverAnim, transition: ((item.hoverAnim as any)?.transition) || { duration: 0.25, ease: "easeOut" } }
                      }}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.8)]")} />
                    </motion.div>
                    <span className="relative z-10 font-medium tracking-wide hidden lg:block">{item.label}</span>
                  </Link>
                </motion.div>
              );
            })}

            {isAdmin && (
              <>
                <div className="my-4 border-t border-border" />
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:block">Admin</p>
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <motion.div
                      key={item.path}
                      initial="initial"
                      whileHover="hover"
                      variants={{
                        initial: { x: 0 },
                        hover: { x: 6, transition: { duration: 0.25, ease: "easeOut" } }
                      }}
                    >
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative group overflow-hidden",
                          isActive
                            ? "text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                          "max-lg:justify-center max-lg:px-0"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute inset-0 bg-primary/20 border border-primary/40 rounded-xl backdrop-blur-sm"
                            style={{ boxShadow: '0 0 20px var(--primary)' }}
                            initial={false}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <motion.div
                          className="relative z-10 flex items-center justify-center"
                          variants={{
                            initial: { scale: 1, rotate: 0, x: 0, y: 0 },
                            hover: { ...item.hoverAnim, transition: ((item.hoverAnim as any)?.transition) || { duration: 0.25, ease: "easeOut" } }
                          }}
                        >
                          <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.8)]")} />
                        </motion.div>
                        <span className="relative z-10 font-medium tracking-wide hidden lg:block">{item.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </>
            )}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "transition-all duration-300 pt-16 min-h-screen",
          sidebarOpen ? "lg:ml-64" : ""
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "p-6",
              !location.pathname.includes('/workflows/builder') && "max-w-7xl mx-auto"
            )}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Global Interactive Components */}
      <CommandPalette />
      <AIAssistantFab />
    </div>
  );
}
