import { useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { User, Profile, Settings } from '@/types';
import { AuthContext, AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    settings: null,
    session: null,
    loading: true,
    error: null,
    startupError: null
  });

  const retryInit = () => {
    // With the new architecture, there is rarely a need to retry a complete init,
    // but we provide it for the UI if a manual refresh is desired.
    window.location.reload();
  };

  const ensureUserRecordsNonBlocking = async (userId: string, email: string, fullName?: string) => {
    try {
      const { data: existingUser } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
      if (!existingUser) {
        await supabase.from('users').insert({
          id: userId,
          email: email,
          full_name: fullName || email.split('@')[0],
          role: 'employee',
          status: 'active'
        });
      }

      const { data: existingProfile } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
      if (!existingProfile) {
        await supabase.from('profiles').insert({ user_id: userId });
      }

      const { data: existingSettings } = await supabase.from('settings').select('id').eq('user_id', userId).maybeSingle();
      if (!existingSettings) {
        await supabase.from('settings').insert({ user_id: userId });
      }
    } catch (e) {
      console.warn('Background record creation failed:', e);
    }
  };

  const fetchUserData = async (session: Session) => {
    try {
      const userId = session.user.id;
      const userEmail = session.user.email || '';
      const fullName = session.user.user_metadata?.full_name;

      // 1. Instantly map basic user data to unblock the UI.
      setState(prev => ({
        ...prev,
        session,
        user: {
          id: userId,
          email: userEmail,
          full_name: fullName || userEmail.split('@')[0] || 'User',
          role: 'employee',
          status: 'active',
          created_at: session.user.created_at || new Date().toISOString()
        } as User,
        loading: false, // UNBLOCK UI IMMEDIATELY
        startupError: null
      }));

      // 2. Fetch profiles and settings in the background.
      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle()
      ]);

      setState(prev => ({
        ...prev,
        profile: profileRes.data || prev.profile,
        settings: settingsRes.data || prev.settings,
      }));

      // 3. Ensure records exist asynchronously (non-blocking).
      ensureUserRecordsNonBlocking(userId, userEmail, fullName);

    } catch (error: any) {
      console.error('Non-critical fetch error:', error);
      // We do not freeze or show an error screen because session is valid and UI is unblocked.
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session && mounted) {
          await fetchUserData(session);
        } else if (mounted) {
          setState(prev => ({ ...prev, session: null, user: null, loading: false }));
        }
      } catch (error: any) {
        console.error('Session init error:', error);
        if (mounted) {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            session: null, 
            user: null,
            startupError: { message: 'Failed to connect to authentication server. Please check your connection.' }
          }));
        }
      }
    };

    // Execute exactly once on mount
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session) {
          fetchUserData(session);
        } else if (event !== 'INITIAL_SESSION') {
          setState(prev => ({ ...prev, session: null, user: null, loading: false }));
        }
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          profile: null,
          settings: null,
          session: null,
          loading: false,
          error: null,
          startupError: null
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // NO dependencies - it should run exactly once!

  const signUp = async (email: string, password: string, fullName: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error: error.message };
    }

    if (data.session) {
      await fetchUserData(data.session);
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error: error.message };
    }

    if (data.session) {
      await fetchUserData(data.session);
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error: error.message };
    }

    // Note: For OAuth, the redirect happens automatically.
    // We don't need to manually fetch data here because the redirect will reload the page,
    // and the useEffect will pick up the new session via getSession() or onAuthStateChange().
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message || null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message || null };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!state.profile) return { error: 'No profile found' };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', state.profile.user_id);

    if (!error && state.profile) {
      setState(prev => ({
        ...prev,
        profile: { ...prev.profile!, ...updates }
      }));
    }

    return { error: error?.message || null };
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    if (!state.settings) return { error: 'No settings found' };
    const { error } = await supabase
      .from('settings')
      .update(updates)
      .eq('user_id', state.settings.user_id);

    if (!error && state.settings) {
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings!, ...updates }
      }));
    }

    return { error: error?.message || null };
  };

  const refreshUser = async () => {
    if (state.session) {
      await fetchUserData(state.session);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        updateSettings,
        refreshUser,
        retryInit
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
