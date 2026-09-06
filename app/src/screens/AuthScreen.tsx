import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Button } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/store/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useWorkoutStore } from '@/store/workoutStore';
import { syncStatsToSupabase } from '@/lib/socialSync';

/**
 * Entirely separate from the rest of ATLAS: nothing else in the app requires
 * an account, and skipping this screen entirely still leaves a fully working
 * solo training log. This is only the gate in front of Friends & Groups.
 */
export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const busy = useAuth((s) => s.busy);
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const setUsername = useAuth((s) => s.setUsername);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsernameInput] = useState('');
  const [claimingHistory, setClaimingHistory] = useState(false);

  // Already signed in with a username picked — nothing for this screen to
  // do. A separate effect (not a render-time call) so React never sees a
  // navigation action fire while this component is still rendering.
  useEffect(() => {
    if (session && profile?.username) navigation.replace('Social');
  }, [session, profile?.username, navigation]);

  if (!isSupabaseConfigured) {
    return (
      <Screen>
        <ModalHeader title="Friends & Groups" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Icon name="friends" size={30} color={colors.textDim} strokeWidth={1.6} />
          </View>
          <Text style={styles.notConfiguredTitle}>Not set up yet</Text>
          <Text style={styles.notConfiguredBody}>
            Friends, groups and shared leaderboards need a small one-time setup that hasn't been
            done on this build yet. Nothing else in ATLAS depends on it.
          </Text>
        </View>
      </Screen>
    );
  }

  // Signed in but hasn't picked a username yet — every account needs one
  // before it can be found by friends or shown on a leaderboard.
  if (session && !profile?.username) {
    const onSaveUsername = async () => {
      const { error } = await setUsername(username);
      if (error) {
        Alert.alert('Try another username', error);
        return;
      }
      // This is the one moment an account goes from "just created" to
      // "has a username" — exactly the accounts that could have local
      // history with nothing in Supabase yet. Push everything logged
      // before this account existed (PRs, totals, streak) in one shot, so
      // Friends & Groups isn't starting from zero for someone who's been
      // training in ATLAS for months without ever signing in.
      setClaimingHistory(true);
      const { records, sessions } = useWorkoutStore.getState();
      await syncStatsToSupabase(records, sessions);
      setClaimingHistory(false);
      navigation.replace('Social');
    };

    return (
      <Screen>
        <ModalHeader title="Choose a username" onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsernameInput}
              placeholder="e.g. mario_it"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <Text style={styles.hint}>3–20 characters. Letters, numbers and underscore only — this is what friends search for.</Text>
            <Button
              label="Continue"
              size="lg"
              loading={busy || claimingHistory}
              disabled={busy || claimingHistory || username.trim().length < 3}
              onPress={onSaveUsername}
              style={{ marginTop: spacing.xl }}
            />
            {claimingHistory && (
              <Text style={styles.claimingText}>Bringing in your training history…</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  if (session) {
    // Signed in with a username already — the effect above is navigating
    // away this frame; render nothing in the meantime.
    return null;
  }

  const onSubmit = async () => {
    if (!email.includes('@') || password.length < 6) {
      Alert.alert('Check your details', 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    const { error } = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    if (error) {
      Alert.alert(mode === 'signup' ? "Couldn't sign up" : "Couldn't sign in", error);
      return;
    }
    if (mode === 'signup') {
      Alert.alert('Almost there', "Check your email to confirm your account, then sign in.");
      setMode('signin');
    }
  };

  return (
    <Screen>
      <ModalHeader title="Friends & Groups" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Icon name="friends" size={30} color={colors.accent} strokeWidth={1.6} />
          </View>
          <Text style={styles.tagline}>
            Add friends, build a group, and compare lifts on a shared leaderboard.
          </Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
          />

          <Button
            label={mode === 'signup' ? 'Create Account' : 'Sign In'}
            size="lg"
            loading={busy}
            onPress={onSubmit}
            style={{ marginTop: spacing.xl }}
          />

          <Button
            label={mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
            variant="ghost"
            onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  tagline: { ...typography.body, color: c.textSecondary, textAlign: 'center', lineHeight: 21 },
  label: { ...typography.micro, color: c.textFaint, marginBottom: spacing.sm },
  input: {
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...typography.bodyMedium,
  },
  hint: { ...typography.caption, color: c.textDim, marginTop: spacing.sm, lineHeight: 18 },
  claimingText: { ...typography.caption, color: c.textDim, textAlign: 'center', marginTop: spacing.md },
  notConfiguredTitle: { ...typography.h2, color: c.text, textAlign: 'center', marginBottom: spacing.sm },
  notConfiguredBody: { ...typography.body, color: c.textDim, textAlign: 'center', lineHeight: 21 },
}));
