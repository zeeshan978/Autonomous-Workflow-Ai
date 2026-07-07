import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Toaster } from '@/components/ui/toaster';
import { SplashScreen } from '@/components/SplashScreen';
import { useState, useEffect, Suspense, lazy } from 'react';
import { useAccent } from '@/hooks/useAccent';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Lazy loaded Pages
const AuthPage = lazy(() => import('@/pages/AuthPage').then(module => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const CommandCenterPage = lazy(() => import('@/pages/CommandCenterPage').then(module => ({ default: module.CommandCenterPage })));
const AgentsPage = lazy(() => import('@/pages/AgentsPage').then(module => ({ default: module.AgentsPage })));
const WorkflowBuilderPage = lazy(() => import('@/pages/WorkflowBuilderPage').then(module => ({ default: module.WorkflowBuilderPage })));
const ExecutionsPage = lazy(() => import('@/pages/ExecutionsPage').then(module => ({ default: module.ExecutionsPage })));
const SchedulerPage = lazy(() => import('@/pages/SchedulerPage').then(module => ({ default: module.SchedulerPage })));
const InsightsPage = lazy(() => import('@/pages/InsightsPage').then(module => ({ default: module.InsightsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage').then(module => ({ default: module.TemplatesPage })));
const FilesPage = lazy(() => import('@/pages/FilesPage').then(module => ({ default: module.FilesPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then(module => ({ default: module.AdminPage })));

import { PageLoader } from '@/components/PageLoader';

function ProtectedRoutesLayout() {
  const { user, session, loading, startupError, retryInit } = useAuth();

  if (startupError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-muted-foreground max-w-md mb-6">{startupError.message}</p>
        <Button onClick={retryInit} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Allow access if we have either user data or a valid session
  if (!user && !session) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading, startupError, retryInit } = useAuth();

  if (startupError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-muted-foreground max-w-md mb-6">{startupError.message}</p>
        <Button onClick={retryInit} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect to dashboard if we have a valid session
  if (user || session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={
        <PublicRoute>
          <Suspense fallback={<PageLoader />}>
            <AuthPage />
          </Suspense>
        </PublicRoute>
      } />

      <Route element={<ProtectedRoutesLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/command-center" element={<CommandCenterPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/workflows/builder" element={<WorkflowBuilderPage />} />
        <Route path="/workflows/:id" element={<WorkflowBuilderPage />} />
        <Route path="/executions" element={<ExecutionsPage />} />
        <Route path="/scheduler" element={<SchedulerPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('splashShown');
  });

  useAccent(); // Initialize global accent colors

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <BrowserRouter>
            {showSplash ? (
              <SplashScreen onComplete={handleSplashComplete} />
            ) : (
              <AppRoutes />
            )}
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
