import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
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
  const { colors, isLight } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const busy = useAuth((s) => s.busy);
  const pendingEmail = useAuth((s) => s.pendingEmail);
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const signInWithApple = useAuth((s) => s.signInWithApple);
  const verifyEmail = useAuth((s) => s.verifyEmail);
  const resendCode = useAuth((s) => s.resendCode);
  const cancelVerification = useAuth((s) => s.cancelVerification);
  const resetEmail = useAuth((s) => s.resetEmail);
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const verifyResetCode = useAuth((s) => s.verifyResetCode);
  const updatePassword = useAuth((s) => s.updatePassword);
  const cancelPasswordReset = useAuth((s) => s.cancelPasswordReset);
  const setUsername = useAuth((s) => s.setUsername);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const onApplePress = async () => {
    const { error } = await signInWithApple();
    if (error) Alert.alert("Couldn't sign in with Apple", error);
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [username, setUsernameInput] = useState('');
  const [claimingHistory, setClaimingHistory] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resendingReset, setResendingReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Already signed in with a username picked — nothing for this screen to
  // do. A separate effect (not a render-time call) so React never sees a
  // navigation action fire while this component is still rendering.
  // Skipped mid password-reset: verifying the reset code lands a real
  // session too, and this would otherwise bounce straight past the
  // new-password step before it ever renders.
  useEffect(() => {
    if (session && profile?.username && !resetEmail) navigation.replace('Social');
  }, [session, profile?.username, resetEmail, navigation]);

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

  // signUp came back with no session (needs confirming), or signIn hit an
  // unconfirmed account — either way, we're waiting on the 6-digit code
  // Supabase emailed to pendingEmail before a session can exist.
  if (pendingEmail) {
    const onVerify = async () => {
      if (code.trim().length < 4) {
        Alert.alert('Enter the code', 'Check the email you were sent for the code.');
        return;
      }
      const { error } = await verifyEmail(code);
      if (error) {
        Alert.alert("Couldn't verify", error);
        return;
      }
      // onAuthStateChange picks up the new session and clears pendingEmail;
      // the effects above take it from here.
      setCode('');
    };

    const onResend = async () => {
      setResending(true);
      const { error } = await resendCode();
      setResending(false);
      if (error) {
        Alert.alert("Couldn't resend", error);
        return;
      }
      Alert.alert('Code sent', `Check ${pendingEmail} for a new code.`);
    };

    return (
      <Screen>
        <ModalHeader
          title="Verify your email"
          onBack={() => {
            cancelVerification();
            setCode('');
          }}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Icon name="friends" size={30} color={colors.accent} strokeWidth={1.6} />
            </View>
            <Text style={styles.tagline}>
              We sent a code to {pendingEmail}. Enter it below to confirm it's really you.
            </Text>

            <Text style={[styles.label, { marginTop: spacing.xl }]}>CODE</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="000000"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              autoFocus
              maxLength={10}
            />

            <Button
              label="Verify"
              size="lg"
              loading={busy}
              disabled={busy || code.trim().length < 4}
              onPress={onVerify}
              style={{ marginTop: spacing.xl }}
            />
            <Button
              label="Resend code"
              variant="ghost"
              loading={resending}
              disabled={resending}
              onPress={onResend}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // "Forgot password": resetPasswordForEmail sent a code to resetEmail, and
  // no session exists yet — show the code entry step.
  if (resetEmail && !session) {
    const onVerifyReset = async () => {
      if (resetCode.trim().length < 4) {
        Alert.alert('Enter the code', 'Check the email you were sent for the code.');
        return;
      }
      const { error } = await verifyResetCode(resetCode);
      if (error) {
        Alert.alert("Couldn't verify", error);
        return;
      }
      // onAuthStateChange lands a temporary session; the branch below takes
      // over on the next render to collect the new password.
      setResetCode('');
    };

    const onResendReset = async () => {
      setResendingReset(true);
      const { error } = await requestPasswordReset(resetEmail);
      setResendingReset(false);
      if (error) {
        Alert.alert("Couldn't resend", error);
        return;
      }
      Alert.alert('Code sent', `Check ${resetEmail} for a new code.`);
    };

    return (
      <Screen>
        <ModalHeader
          title="Reset your password"
          onBack={() => {
            cancelPasswordReset();
            setResetCode('');
          }}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Icon name="friends" size={30} color={colors.accent} strokeWidth={1.6} />
            </View>
            <Text style={styles.tagline}>
              We sent a code to {resetEmail}. Enter it below to continue.
            </Text>

            <Text style={[styles.label, { marginTop: spacing.xl }]}>CODE</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={resetCode}
              onChangeText={(t) => setResetCode(t.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="000000"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              autoFocus
              maxLength={10}
            />

            <Button
              label="Verify"
              size="lg"
              loading={busy}
              disabled={busy || resetCode.trim().length < 4}
              onPress={onVerifyReset}
              style={{ marginTop: spacing.xl }}
            />
            <Button
              label="Resend code"
              variant="ghost"
              loading={resendingReset}
              disabled={resendingReset}
              onPress={onResendReset}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // Code verified — a temporary recovery session now exists. Collect and
  // save a new password before this behaves like a normal signed-in session.
  if (resetEmail && session) {
    const onSaveNewPassword = async () => {
      if (newPassword.length < 6) {
        Alert.alert('Too short', 'Use at least 6 characters.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        Alert.alert("Passwords don't match", 'Enter the same password in both fields.');
        return;
      }
      const { error } = await updatePassword(newPassword);
      if (error) {
        Alert.alert("Couldn't update password", error);
        return;
      }
      setNewPassword('');
      setConfirmNewPassword('');
      // resetEmail is cleared now — the effect above takes it from here
      // (straight to Social, since this account already has a username).
    };

    return (
      <Screen>
        <ModalHeader title="Set a new password" onBack={() => cancelPasswordReset()} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={styles.label}>NEW PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <Text style={[styles.label, { marginTop: spacing.lg }]}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>At least 6 characters.</Text>

            <Button
              label="Save password"
              size="lg"
              loading={busy}
              disabled={busy || newPassword.length < 6}
              onPress={onSaveNewPassword}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        </KeyboardAvoidingView>
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
    // If a code is needed, pendingEmail is now set and the branch above
    // takes over on the next render. Otherwise a session landed already
    // (confirmation disabled) and the effects above move things along.
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

          {appleAvailable && (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  isLight
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={radius.md}
                style={styles.appleButton}
                onPress={onApplePress}
              />
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

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
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              style={styles.passwordEyeBtn}
              hitSlop={10}
            >
              <Icon
                name={showPassword ? 'eyeOff' : 'eyeOpen'}
                size={19}
                color={colors.textFaint}
                strokeWidth={1.7}
              />
            </Pressable>
          </View>
          {mode === 'signup' && <Text style={styles.hint}>At least 6 characters.</Text>}
          {mode === 'signin' && (
            <Pressable
              onPress={async () => {
                if (!email.includes('@')) {
                  Alert.alert('Enter your email', 'Type your email above first, then tap this again.');
                  return;
                }
                const { error } = await requestPasswordReset(email.trim());
                if (error) Alert.alert("Couldn't send reset code", error);
              }}
              style={{ marginTop: spacing.sm }}
            >
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </Pressable>
          )}

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
  appleButton: { height: 48, width: '100%', marginTop: spacing.xl },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { ...typography.caption, color: c.textFaint },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  passwordEyeBtn: {
    position: 'absolute',
    right: spacing.md,
    height: '100%',
    justifyContent: 'center',
  },
  codeInput: {
    ...typography.h2,
    textAlign: 'center',
    letterSpacing: 8,
  },
  hint: { ...typography.caption, color: c.textDim, marginTop: spacing.sm, lineHeight: 18 },
  forgotPassword: { ...typography.caption, color: c.bronze, textAlign: 'right' },
  claimingText: { ...typography.caption, color: c.textDim, textAlign: 'center', marginTop: spacing.md },
  notConfiguredTitle: { ...typography.h2, color: c.text, textAlign: 'center', marginBottom: spacing.sm },
  notConfiguredBody: { ...typography.body, color: c.textDim, textAlign: 'center', lineHeight: 21 },
}));
