import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface SocialProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_emoji: string;
}

interface AuthState {
  /** false until the first getSession() call resolves — avoids flashing the
   *  sign-in screen for a split second on cold start while a session is
   *  actually being restored from AsyncStorage */
  hydrated: boolean;
  session: Session | null;
  profile: SocialProfile | null;
  /** true while a sign-in/sign-up/username-save request is in flight */
  busy: boolean;

  init: () => void;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setUsername: (username: string) => Promise<{ error: string | null }>;
}

let initialized = false;

export const useAuth = create<AuthState>()((set, get) => ({
  hydrated: false,
  session: null,
  profile: null,
  busy: false,

  init: () => {
    if (initialized || !isSupabaseConfigured) {
      if (!isSupabaseConfigured) set({ hydrated: true });
      return;
    }
    initialized = true;

    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, hydrated: true });
      if (data.session) get().refreshProfile();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_emoji')
      .eq('id', userId)
      .maybeSingle();
    if (data) set({ profile: data });
  },

  signUp: async (email, password) => {
    set({ busy: true });
    const { error } = await supabase.auth.signUp({ email, password });
    set({ busy: false });
    return { error: error?.message ?? null };
  },

  signIn: async (email, password) => {
    set({ busy: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ busy: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null });
  },

  setUsername: async (username) => {
    const userId = get().session?.user.id;
    if (!userId) return { error: 'Not signed in' };
    const trimmed = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      return { error: '3-20 characters: letters, numbers, underscore only' };
    }
    set({ busy: true });
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed, display_name: trimmed })
      .eq('id', userId);
    set({ busy: false });
    if (error) {
      // unique_violation
      if (error.code === '23505') return { error: 'That username is taken' };
      return { error: error.message };
    }
    await get().refreshProfile();
    return { error: null };
  },
}));
