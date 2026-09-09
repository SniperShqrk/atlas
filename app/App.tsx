import React, { useEffect } from 'react';
import { View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from '@/navigation/RootNavigator';
import { ThemeProvider, useTheme, useThemeStore } from '@/theme/ThemeProvider';
import { useOnboarding } from '@/store/onboarding';
import { getPalette } from '@/theme/palettes';
import { useEntitlements } from '@/store/entitlements';
import {
  configurePurchases,
  getCustomerInfo,
  subscribeToCustomerInfoUpdates,
} from '@/store/purchases';
import { useAuth } from '@/store/auth';

// No-op (and no network calls at all) when EXPO_PUBLIC_SENTRY_DSN isn't set,
// which is the normal state for local dev — nobody needs a Sentry project
// just to run the app. Module-level, not inside a component, so it runs
// once at import time and catches errors as early as possible.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    // Crash reports and errors always send; this only samples the separate,
    // more expensive performance-tracing spans (slow screens, slow
    // requests) — 100% in dev to see everything while testing, a light
    // sample in production so a busy app doesn't burn through Sentry quota.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

/**
 * No-op when EXPO_PUBLIC_REVENUECAT_*_API_KEY isn't set (see purchases.ts) —
 * that's the normal state for local dev, and `isPro` just stays whatever the
 * manual toggle in entitlements.ts last set it to. Once a key is configured,
 * this becomes the source of truth: it pulls the real entitlement once at
 * launch, then keeps listening so a renewal, cancellation, or refund that
 * happens while the app is open (or was backgrounded) still lands.
 */
function usePurchasesSync() {
  const syncFromRevenueCat = useEntitlements((s) => s.syncFromRevenueCat);

  useEffect(() => {
    const configured = configurePurchases();
    if (!configured) return;

    let cancelled = false;
    getCustomerInfo().then((info) => {
      if (info && !cancelled) syncFromRevenueCat(info);
    });

    const unsubscribe = subscribeToCustomerInfoUpdates((info) => syncFromRevenueCat(info));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [syncFromRevenueCat]);
}

/** Status bar contrast has to follow the palette, or Marble loses its clock. */
function ThemedStatusBar() {
  const { isLight } = useTheme();
  return <StatusBar style={isLight ? 'dark' : 'light'} />;
}

/**
 * Nothing renders until both persisted stores have been read.
 *
 * Both decide something that is wrong by default: the theme picks a palette,
 * and onboarding picks the first screen. Rendering before AsyncStorage comes
 * back would show a returning user the wrong theme for a frame and, worse,
 * would drop them into onboarding they completed months ago.
 */
function Gate() {
  const themeReady = useThemeStore((s) => s.hydrated);
  const onboardingReady = useOnboarding((s) => s.hydrated);
  const theme = useThemeStore((s) => s.theme);

  if (!themeReady || !onboardingReady) {
    // the stored palette is not known yet, so hold on a neutral ground
    return <View style={{ flex: 1, backgroundColor: getPalette(theme).bg }} />;
  }
  return <RootNavigator />;
}

/**
 * No-op when Supabase isn't configured (see lib/supabase.ts) — Friends &
 * Groups then just shows a "not set up yet" screen. Once configured, this
 * restores whatever session AsyncStorage already has (so a signed-in person
 * stays signed in across launches) and keeps listening for sign-in/out.
 */
function useAuthInit() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);
}

function App() {
  usePurchasesSync();
  useAuthInit();
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <Gate />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

// Sentry.wrap adds a top-level error boundary plus screen/navigation
// tracing; skip it entirely when there's no DSN so an unconfigured build
// doesn't pay for machinery it can't use.
export default SENTRY_DSN ? Sentry.wrap(App) : App;
