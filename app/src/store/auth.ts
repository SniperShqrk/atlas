import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
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
  /** true while a sign-in/sign-up/username-save/verify request is in flight */
  busy: boolean;
  /** Set the moment signUp comes back with no session (email confirmation
   *  required) or signIn fails because the account was never confirmed.
   *  While this is set, AuthScreen shows the 6-digit code entry step
   *  instead of the sign-in/sign-up form. */
  pendingEmail: string | null;

  init: () => void;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** iOS only. Apple's own dialog handles everything; a session lands the
   *  same way as email/password (via onAuthStateChange), then the usual
   *  "pick a username" step in AuthScreen takes over from there. */
  signInWithApple: () => Promise<{ error: string | null }>;
  verifyEmail: (code: string) => Promise<{ error: string | null }>;
  resendCode: () => Promise<{ error: string | null }>;
  cancelVerification: () => void;
  signOut: () => Promise<void>;
  setUsername: (username: string) => Promise<{ error: string | null }>;
}

let initialized = false;

export const useAuth = create<AuthState>()((set, get) => ({
  hydrated: false,
  session: null,
  profile: null,
  busy: false,
  pendingEmail: null,

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
        // A session just landed (fresh sign-in, or the code in
        // verifyEmail just confirmed the account) — the pending-code
        // screen is done regardless of how we got here.
        set({ pendingEmail: null });
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
    const { data, error } = await supabase.auth.signUp({ email, password });
    set({ busy: false });
    if (error) return { error: error.message };
    // With "Confirm email" on (see supabase/SETUP.md), signUp succeeds but
    // comes back with no session until the 6-digit code is verified. With
    // it off, a session lands immediately and there's nothing to verify.
    if (!data.session) set({ pendingEmail: email });
    return { error: null };
  },

  signIn: async (email, password) => {
    set({ busy: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ busy: false });
    if (error) {
      // Supabase's exact message for an account that signed up but never
      // verified — route straight to the code screen instead of just
      // showing an error the person can't act on.
      if (/email not confirmed/i.test(error.message)) {
        set({ pendingEmail: email });
        return { error: null };
      }
      return { error: error.message };
    }
    return { error: null };
  },

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') return { error: 'Sign in with Apple is only available on iOS.' };
    set({ busy: true });
    try {
      // Supabase verifies the raw nonce against the hash Apple embeds in the
      // identity token, so it has to see the raw value while Apple only ever
      // sees the SHA-256 hash of it.
      const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        set({ busy: false });
        return { error: "Apple didn't return an identity token — try again." };
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      set({ busy: false });
      return { error: error?.message ?? null };
    } catch (e: any) {
      set({ busy: false });
      // The system Apple sign-in sheet was dismissed/cancelled — not a real
      // error, nothing for the UI to alert about.
      if (e?.code === 'ERR_REQUEST_CANCELED') return { error: null };
      return { error: e?.message ?? 'Apple sign-in failed' };
    }
  },

  verifyEmail: async (code) => {
    const email = get().pendingEmail;
    if (!email) return { error: 'Nothing to verify' };
    set({ busy: true });
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' });
    set({ busy: false });
    if (error) return { error: error.message };
    // onAuthStateChange fires with the new session and clears pendingEmail.
    return { error: null };
  },

  resendCode: async () => {
    const email = get().pendingEmail;
    if (!email) return { error: 'Nothing to resend' };
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error?.message ?? null };
  },

  cancelVerification: () => set({ pendingEmail: null }),

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
