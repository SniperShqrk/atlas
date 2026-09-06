import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { PACKAGE_TYPE, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Button } from '@/components/ui';
import { ModalHeader, BottomInset } from '@/components/ScreenLayout';
import { Icon, IconName } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useEntitlements, PRO_FEATURES, ProFeature } from '@/store/entitlements';
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
  more_routines: 'library',
  advanced_analytics: 'chart',
  volume_landmarks: 'flame',
  csv_export: 'edit',
};

const FREE_FOREVER = [
  'Unlimited workout logging — no session caps',
  `All ${EXERCISES.length} exercises with full instructions`,
  'Muscle recovery map and full history',
  'Rest timer, PR detection, plate calculator',
  'Progression suggestions on every lift',
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
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('yearly');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (isPurchasesConfigured()) fetchOfferings().then(setOffering);
  }, []);

  const ordered = (Object.keys(PRO_FEATURES) as ProFeature[]).sort((a, b) =>
    a === highlight ? -1 : b === highlight ? 1 : 0
  );

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
        <View style={styles.hero}>
          <Icon name="sparkle" size={30} color={colors.bronze} strokeWidth={1.5} />
          <Text style={styles.title}>ATLAS Premium</Text>
          <Text style={styles.subtitle}>
            {dayZero
              ? 'Everything you need to train is free, forever — no trial to expire and no session caps. Premium adds the thinking.'
              : 'Everything you need to train is free, forever. Premium adds the thinking.'}
          </Text>
        </View>

        {ordered.map((f) => {
          const meta = PRO_FEATURES[f];
          const isHighlight = f === highlight;
          return (
            <View key={f} style={[styles.feature, isHighlight && styles.featureHighlight]}>
              <Icon name={FEATURE_ICONS[f]} size={22} color={colors.bronze} strokeWidth={1.6} />
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{meta.title}</Text>
                <Text style={styles.featureBlurb}>{meta.blurb}</Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>ALWAYS FREE</Text>
        <View style={styles.freeCard}>
          {FREE_FOREVER.map((f) => (
            <View key={f} style={styles.freeRow}>
              <Icon name="check" size={16} color={colors.textDim} strokeWidth={2.2} />
              <Text style={styles.freeText}>{f}</Text>
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
        <Pressable onPress={onRestore} disabled={purchasing || restoring} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </Pressable>
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
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  featureHighlight: { borderColor: 'rgba(192,138,62,0.45)', backgroundColor: c.bronzeSoft },
  featureTitle: { ...typography.h3, color: c.text },
  featureBlurb: { ...typography.caption, color: c.textDim, marginTop: 3, lineHeight: 19 },
  sectionLabel: { ...typography.micro, color: c.textFaint, marginTop: spacing.xl, marginBottom: spacing.md },
  freeCard: {
    backgroundColor: c.cardAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  freeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  freeText: { ...typography.caption, color: c.textSecondary, flex: 1, lineHeight: 19 },
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
  restoreBtn: { alignItems: 'center', marginTop: spacing.lg, padding: spacing.sm },
  restoreText: { ...typography.bodyMedium, color: c.textDim },
  finePrint: {
    ...typography.caption,
    color: c.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
}));
