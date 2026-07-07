import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp, resetPassword, user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if ((user || session) && !authLoading) {
      navigate('/');
    }
  }, [user, session, authLoading, navigate]);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'reset') {
      setActiveTab('reset');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      toast({ title: 'Welcome back!', description: 'You have been signed in successfully.' });
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const result = await signUp(email, password, fullName);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      toast({
        title: 'Account created',
        description: 'Please check your email to verify your account.'
      });
      navigate('/');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const result = await resetPassword(email);

    if (result.error) {
      setError(result.error);
    } else {
      toast({
        title: 'Password reset email sent',
        description: 'Check your inbox for the reset link.'
      });
      setActiveTab('login');
    }
    setLoading(false);
  };

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Cinematic animated background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] animate-blob" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-purple-500/20 blur-[100px] animate-blob" style={{ animationDelay: '4s' }} />
      
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-2xl">
            <Bot className="h-10 w-10 text-primary" />
            <span>Autonomous Workflow AI</span>
          </Link>
          <p className="text-muted-foreground mt-2">Automate your business workflows with AI</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup' | 'reset')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="glass-panel border-white/10 shadow-2xl">
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Enter your credentials to access your account</CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-email" name="email" type="email" placeholder="you@example.com" className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" name="password" type="password" placeholder="••••••••" className="pl-10" required />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                  </Button>
                  <Button type="button" variant="link" onClick={() => setActiveTab('reset')}>
                    Forgot password?
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="glass-panel border-white/10 shadow-2xl">
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Enter your information to get started</CardDescription>
              </CardHeader>
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-name" name="fullName" type="text" placeholder="John Doe" className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-email" name="email" type="email" placeholder="you@example.com" className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-password" name="password" type="password" placeholder="••••••••" className="pl-10" required minLength={6} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-confirm" name="confirmPassword" type="password" placeholder="••••••••" className="pl-10" required />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="reset">
            <Card className="glass-panel border-white/10 shadow-2xl">
              <CardHeader>
                <CardTitle>Reset Password</CardTitle>
                <CardDescription>Enter your email to receive a reset link</CardDescription>
              </CardHeader>
              <form onSubmit={handleResetPassword}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="reset-email" name="email" type="email" placeholder="you@example.com" className="pl-10" required />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setActiveTab('login')}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
