import { createContext } from 'react';
import { Session } from '@supabase/supabase-js';
import type { User, Profile, Settings } from '@/types';

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  settings: Settings | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  startupError: { message: string } | null;
}

export interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  updateSettings: (updates: Partial<Settings>) => Promise<{ error: string | null }>;
  refreshUser: () => Promise<void>;
  retryInit: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
