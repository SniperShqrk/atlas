import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
import { PACKAGE_TYPE, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Button } from '@/components/ui';
import { ModalHeader, BottomInset } from '@/components/ScreenLayout';
import { Icon, IconName } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useEntitlements, PRO_FEATURES, ProFeature, FREE_LIMITS, PRO_LIMITS } from '@/store/entitlements';
import { fetchOfferings, isPurchasesConfigured, purchase, restore } from '@/store/purchases';
import { EXERCISES } from '@/data/exercises';

// Lifetime sits at ~3.3x the annual price, matching the ratio the two closest
// comps (Hevy, Strong) both use — at the old €79.99 it was only 2.7x annual,
// which meant anyone confident they'd use ATLAS for more than ~2.7 years was
// mathematically better off buying lifetime than subscribing. That's exactly
// backwards: it let the most committed, highest-LTV users opt out of
// recurring revenue for the cheapest possible one-time price.
const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '€4.99', per: 'per month', note: '', packageType: PACKAGE_TYPE.MONTHLY },
  { id: 'yearly', label: 'Yearly', price: '€29.99', per: 'per year', note: 'Save 50%', packageType: PACKAGE_TYPE.ANNUAL },
  { id: 'lifetime', label: 'Lifetime', price: '€99.99', per: 'once', note: 'No subscription', packageType: PACKAGE_TYPE.LIFETIME },
] as const;

/** Matches this plan against the real RevenueCat package, when configured
 *  and loaded, so the price shown is always what the App Store will
 *  actually charge rather than the static placeholder above. */
function packageFor(
  offering: PurchasesOffering | null,
  packageType: PACKAGE_TYPE
): PurchasesPackage | undefined {
  return offering?.availablePackages.find((p) => p.packageType === packageType);
}

const FEATURE_ICONS: Record<ProFeature, IconName> = {
  atlas_insights: 'sparkle',
  ai_planner: 'plan',
  import_workouts: 'share',
  more_routines: 'library',
  advanced_analytics: 'chart',
  volume_landmarks: 'flame',
  csv_export: 'edit',
};

/** One specific value statement per trigger feature, rather than a generic
 *  pitch — whatever locked feature actually sent someone here becomes the
 *  headline, since that's the one thing they were just trying to do. */
const VALUE_HEADLINE: Record<ProFeature, string> = {
  atlas_insights: 'Know exactly what to change',
  ai_planner: 'Never guess your program again',
  import_workouts: 'Turn any plan into a ready week',
  more_routines: 'Keep every routine you build',
  advanced_analytics: 'See the trend, not just the numbers',
  volume_landmarks: 'Train each muscle exactly enough',
  csv_export: 'Your data, never locked in',
};
const DEFAULT_FEATURE: ProFeature = 'ai_planner';

/** The whole free-vs-premium picture in one glance, replacing two separate
 *  walls of text (a card per Pro feature, then a bulleted "always free"
 *  list) with a single compact table. */
const COMPARISON: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: 'Workout logging', free: true, pro: true },
  { label: `All ${EXERCISES.length} exercises`, free: true, pro: true },
  { label: 'Recovery map & history', free: true, pro: true },
  { label: 'Saved routines', free: `${FREE_LIMITS.routines}`, pro: `${PRO_LIMITS.routines}` },
  { label: 'AI Workout Planner', free: false, pro: true },
  { label: 'ATLAS Insights', free: false, pro: true },
  { label: 'Import Workouts', free: false, pro: true },
  { label: 'Strength & volume charts', free: false, pro: true },
  { label: 'Volume landmarks', free: false, pro: true },
  { label: 'CSV export', free: false, pro: true },
];

export default function PaywallScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const highlight: ProFeature | undefined = route.params?.feature;
  // Day 0: the user has no logs yet, so the pitch has to be the promise plus a
  // worked example rather than anything about their own training. There is no
  // trial — the free tier is the trial, and it never expires.
  const dayZero = route.params?.source === 'onboarding';
  const setPro = useEntitlements((s) => s.setPro);
  const syncFromRevenueCat = useEntitlements((s) => s.syncFromRevenueCat);
  const redeemBetaCode = useEntitlements((s) => s.redeemBetaCode);
  const setRemindLater = useEntitlements((s) => s.setRemindLater);
  const feature = highlight ?? DEFAULT_FEATURE;
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('yearly');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (isPurchasesConfigured()) fetchOfferings().then(setOffering);
  }, []);

  const onRemindLater = () => {
    setRemindLater();
    navigation.goBack();
  };

  const onSubscribe = async () => {
    const selected = PLANS.find((p) => p.id === plan)!;

    // No RevenueCat key configured in this build (see purchases.ts) — the
    // dev/testing path, unlocking locally so the rest of the app can be
    // built without needing real IAP credentials on hand.
    if (!isPurchasesConfigured()) {
      setPro(true);
      navigation.goBack();
      return;
    }

    const pkg = packageFor(offering, selected.packageType);
    if (!pkg) {
      Alert.alert('Not available yet', 'This plan isn\'t live in App Store Connect yet — try again shortly.');
      return;
    }

    setPurchasing(true);
    const result = await purchase(pkg);
    setPurchasing(false);

    if (result.status === 'purchased') {
      syncFromRevenueCat(result.customerInfo);
      navigation.goBack();
    } else if (result.status === 'error') {
      Alert.alert('Purchase failed', result.message);
    }
    // cancelled: leave them on the paywall, no error needed
  };

  const onRedeemCode = () => {
    if (redeemBetaCode(code)) {
      navigation.goBack();
    } else {
      setCodeError('That code isn\'t valid — double-check the digits.');
    }
  };

  const onRestore = async () => {
    if (!isPurchasesConfigured()) {
      Alert.alert('Nothing to restore', 'Purchases aren\'t set up in this build yet.');
      return;
    }
    setRestoring(true);
    const result = await restore();
    setRestoring(false);

    if (result.status === 'restored') {
      syncFromRevenueCat(result.customerInfo);
      Alert.alert('Restored', 'Your ATLAS Premium purchase has been restored.');
      navigation.goBack();
    } else if (result.status === 'nothing_to_restore') {
      Alert.alert('Nothing to restore', 'No previous purchase was found for this Apple ID.');
    } else {
      Alert.alert('Restore failed', result.message);
    }
  };

  return (
    <Screen>
      <ModalHeader onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* One value statement — whatever locked feature actually sent
            someone here, not a tour of all seven. */}
        <View style={styles.hero}>
          <Icon name={FEATURE_ICONS[feature]} size={30} color={colors.bronze} strokeWidth={1.5} />
          <Text style={styles.title}>{VALUE_HEADLINE[feature]}</Text>
          <Text style={styles.subtitle}>
            {PRO_FEATURES[feature].blurb}
            {dayZero ? ' No trial to expire, no session caps — the free tier is permanent.' : ''}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>FREE VS PREMIUM</Text>
        <View style={styles.compareCard}>
          <View style={styles.compareHeaderRow}>
            <Text style={[styles.compareHeaderCell, { flex: 1.4 }]} />
            <Text style={styles.compareHeaderCell}>Free</Text>
            <Text style={[styles.compareHeaderCell, { color: colors.bronze }]}>Premium</Text>
          </View>
          {COMPARISON.map((row, i) => (
            <View key={row.label} style={[styles.compareRow, i > 0 && styles.compareRowBorder]}>
              <Text style={[styles.compareLabel, { flex: 1.4 }]} numberOfLines={1}>
                {row.label}
              </Text>
              <View style={styles.compareCell}>
                {typeof row.free === 'boolean' ? (
                  row.free ? (
                    <Icon name="check" size={15} color={colors.textDim} strokeWidth={2.2} />
                  ) : (
                    <Text style={styles.compareDash}>–</Text>
                  )
                ) : (
                  <Text style={styles.compareValue}>{row.free}</Text>
                )}
              </View>
              <View style={styles.compareCell}>
                {typeof row.pro === 'boolean' ? (
                  <Icon name="check" size={15} color={colors.bronze} strokeWidth={2.4} />
                ) : (
                  <Text style={[styles.compareValue, { color: colors.bronze }]}>{row.pro}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>CHOOSE A PLAN</Text>
        <View style={styles.plans}>
          {PLANS.map((p) => {
            const active = plan === p.id;
            const livePrice = packageFor(offering, p.packageType)?.product.priceString;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlan(p.id)}
                style={[styles.plan, active && styles.planActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>{p.label}</Text>
                  <Text style={styles.planPer}>{p.per}</Text>
                </View>
                {!!p.note && (
                  <View style={styles.planNote}>
                    <Text style={styles.planNoteText}>{p.note}</Text>
                  </View>
                )}
                <Text style={[styles.planPrice, active && { color: colors.bronze }]}>
                  {livePrice ?? p.price}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={plan === 'lifetime' ? 'Unlock ATLAS Premium' : 'Subscribe'}
          size="lg"
          onPress={onSubscribe}
          loading={purchasing}
          disabled={purchasing || restoring}
          style={{ marginTop: spacing.lg }}
        />
        <Pressable
          onPress={onRemindLater}
          disabled={purchasing || restoring}
          style={styles.remindLaterBtn}
        >
          <Text style={styles.remindLaterText}>Remind me later</Text>
        </Pressable>

        <Pressable onPress={onRestore} disabled={purchasing || restoring} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </Pressable>

        {showCodeInput ? (
          <View style={styles.codeBlock}>
            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => {
                  setCode(t);
                  setCodeError(null);
                }}
                placeholder="8-digit code"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={9}
                autoFocus
              />
              <Button label="Redeem" size="sm" onPress={onRedeemCode} />
            </View>
            {codeError && <Text style={styles.codeError}>{codeError}</Text>}
          </View>
        ) : (
          <Pressable onPress={() => setShowCodeInput(true)} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Have a beta code?</Text>
          </Pressable>
        )}

        <Text style={styles.finePrint}>
          No trial to expire and no session caps — the free tier is permanent. Cancel any time;
          your logged workouts stay yours either way.
        </Text>
        <BottomInset extra={spacing.lg} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  title: { ...typography.hero, color: c.text },
  subtitle: {
    ...typography.body,
    color: c.textDim,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  sectionLabel: { ...typography.micro, color: c.textFaint, marginTop: spacing.xl, marginBottom: spacing.md },
  compareCard: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  compareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: c.cardAlt,
  },
  compareHeaderCell: { ...typography.captionBold, color: c.textDim, flex: 1, textAlign: 'center' },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  compareRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  compareLabel: { ...typography.caption, color: c.text },
  compareCell: { flex: 1, alignItems: 'center' },
  compareValue: { ...typography.captionBold, color: c.textDim },
  compareDash: { ...typography.body, color: c.textFaint },
  plans: { gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  planActive: { borderColor: c.bronze, backgroundColor: c.bronzeSoft },
  planLabel: { ...typography.bodyMedium, color: c.text },
  planPer: { ...typography.caption, color: c.textDim, marginTop: 1 },
  planNote: {
    backgroundColor: c.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  planNoteText: { ...typography.micro, color: c.accent, fontSize: 10 },
  planPrice: { ...typography.h3, color: c.text },
  remindLaterBtn: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  remindLaterText: { ...typography.bodyMedium, color: c.textSecondary, fontWeight: '600' },
  restoreBtn: { alignItems: 'center', marginTop: spacing.sm, padding: spacing.sm },
  restoreText: { ...typography.bodyMedium, color: c.textDim },
  codeBlock: { marginTop: spacing.lg },
  codeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  codeInput: {
    flex: 1,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    letterSpacing: 1,
    ...typography.bodyMedium,
  },
  codeError: { ...typography.caption, color: c.danger, marginTop: spacing.sm, textAlign: 'center' },
  finePrint: {
    ...typography.caption,
    color: c.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
}));
