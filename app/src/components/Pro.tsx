import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';
import { ProFeature, PRO_FEATURES, useEntitlements } from '@/store/entitlements';

/** Small bronze "PRO" badge for locked rows and section headers. */
export function ProBadge({ style }: { style?: any }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>PRO</Text>
    </View>
  );
}

/**
 * Wraps a Pro-only feature. When the user is free it renders a locked panel
 * describing what the feature does and routes to the paywall — never a dead
 * end, and never hiding what they'd be getting.
 */
export function ProGate({
  feature,
  children,
  compact,
}: {
  feature: ProFeature;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const isPro = useEntitlements((s) => s.isPro);
  const record = useEntitlements((s) => s.recordPaywallView);

  if (isPro) return <>{children}</>;

  const meta = PRO_FEATURES[feature];

  return (
    <Pressable
      onPress={() => {
        record(feature);
        navigation.navigate('Paywall', { feature });
      }}
      style={({ pressed }) => [styles.locked, compact && styles.lockedCompact, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.lockRow}>
        <Icon name="lock" size={18} color={colors.bronze} strokeWidth={1.7} />
        <Text style={styles.lockTitle}>{meta.title}</Text>
        <ProBadge />
      </View>
      {!compact && <Text style={styles.lockBlurb}>{meta.blurb}</Text>}
      <Text style={styles.lockCta}>Unlock with Pro</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.5)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { ...typography.micro, color: c.bronze, fontSize: 10 },
  locked: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.3)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  lockedCompact: { padding: spacing.md },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lockTitle: { ...typography.h3, color: c.text, flex: 1 },
  lockBlurb: { ...typography.body, color: c.textDim, marginTop: 8, lineHeight: 21 },
  lockCta: { ...typography.captionBold, color: c.bronze, marginTop: 12 },
}));
