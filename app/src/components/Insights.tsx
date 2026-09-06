import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';
import { Insight, InsightReport, isUnlocked } from '@/store/insights';
import type { Palette } from '@/theme/palettes';
import { useEntitlements } from '@/store/entitlements';

/**
 * The ATLAS Insights block.
 *
 * The paywall here is built on curiosity rather than on withholding: the
 * opener names something real that ATLAS found, one finding is revealed in
 * full so the quality of the analysis is visible, and the rest show their
 * headline and a line of evidence with the diagnosis behind Premium. A user
 * who upgrades knows exactly what they are buying, which is also the reason
 * they keep it.
 */

/** Severity reads the same in every theme: bronze works, accent needs action. */
function severityTone(severity: Insight['severity'], c: Palette): string {
  return severity === 'good' ? c.bronze : severity === 'warn' ? c.accent : c.textSecondary;
}

const SEVERITY_LABEL: Record<Insight['severity'], string> = {
  good: 'WORKING',
  watch: 'WATCH',
  warn: 'ACTION',
};

/** The curiosity opener — praise, then the count of what is still hidden. */
export function InsightHeadline({
  report,
  onUnlock,
}: {
  report: InsightReport;
  onUnlock: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isPro = useEntitlements((s) => s.isPro);
  if (!report.headline) return null;
  const { praise, tease, findingCount } = report.headline;

  return (
    <View style={styles.headline}>
      <View style={styles.headlineTop}>
        <Icon name="sparkle" size={15} color={colors.bronze} strokeWidth={1.5} />
        <Text style={styles.headlineKicker}>ATLAS READ YOUR LAST BLOCK</Text>
      </View>

      <Text style={styles.headlinePraise}>{praise}.</Text>
      {findingCount > 0 && <Text style={styles.headlineTease}>However — {tease}</Text>}

      {!isPro && findingCount > 0 && (
        <Pressable
          onPress={onUnlock}
          style={({ pressed }) => [styles.headlineCta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.headlineCtaText}>See what ATLAS found</Text>
          <Icon name="chevron" size={15} color={colors.onAccent} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

/** One insight. Expands in place when unlocked; routes to the paywall when not. */
export function InsightCard({
  insight,
  unlocked,
  onUnlock,
}: {
  insight: Insight;
  unlocked: boolean;
  onUnlock: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const tone = severityTone(insight.severity, colors);

  return (
    <Pressable
      onPress={() => (unlocked ? setOpen((v) => !v) : onUnlock())}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.cardPressed }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.severityDot, { backgroundColor: tone }]} />
        <Text style={[styles.severityLabel, { color: tone }]}>
          {SEVERITY_LABEL[insight.severity]}
        </Text>
        <View style={{ flex: 1 }} />
        {!unlocked ? (
          <Icon name="lock" size={14} color={colors.textFaint} strokeWidth={1.6} />
        ) : (
          <View style={open ? styles.chevronOpen : undefined}>
            <Icon name="chevron" size={14} color={colors.textFaint} strokeWidth={1.8} />
          </View>
        )}
      </View>

      <Text style={styles.cardHeadline}>{insight.headline}</Text>
      <Text style={styles.cardPreview}>{insight.preview}</Text>

      {unlocked && open && (
        <View style={styles.body}>
          {insight.metrics.length > 0 && (
            <View style={styles.metricRow}>
              {insight.metrics.map((m) => (
                <View key={m.label} style={styles.metric}>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          )}

          {insight.detail.map((line, i) => (
            <Text key={i} style={styles.detailLine}>
              {line}
            </Text>
          ))}

          <View style={styles.actionBox}>
            <Text style={styles.actionKicker}>DO THIS</Text>
            <Text style={styles.actionText}>{insight.action}</Text>
          </View>
        </View>
      )}

      {!unlocked && (
        <View style={styles.lockedFoot}>
          <Text style={styles.lockedText}>Diagnosis and fix</Text>
          <View style={styles.miniBadge}>
            <Text style={styles.miniBadgeText}>PREMIUM</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** The whole block: opener, the free reveal, then the locked findings. */
export function InsightList({ report }: { report: InsightReport }) {
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const isPro = useEntitlements((s) => s.isPro);
  const record = useEntitlements((s) => s.recordPaywallView);

  const openPaywall = () => {
    record('atlas_insights');
    navigation.navigate('Paywall', { feature: 'atlas_insights' });
  };

  if (!report.hasEnoughData) return null;

  return (
    <View>
      <InsightHeadline report={report} onUnlock={openPaywall} />

      {/* ranked, so the most severe finding leads regardless of what is gated */}
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {report.all.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            unlocked={isUnlocked(report, insight, isPro)}
            onUnlock={openPaywall}
          />
        ))}
      </View>

      {!isPro && report.locked.length > 0 && (
        <Pressable
          onPress={openPaywall}
          style={({ pressed }) => [styles.footerCta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.footerCtaText}>
            Unlock {report.locked.length} more findings with Premium
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  headline: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.32)',
    padding: spacing.lg,
  },
  headlineTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headlineKicker: { ...typography.micro, color: c.bronze, fontSize: 10 },
  headlinePraise: {
    ...typography.h2,
    color: c.text,
    marginTop: spacing.md,
    lineHeight: 25,
  },
  headlineTease: {
    ...typography.body,
    color: c.textSecondary,
    marginTop: 6,
    lineHeight: 21,
  },
  headlineCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  headlineCtaText: { ...typography.bodyMedium, color: c.onAccent, fontWeight: '700' },

  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityLabel: { ...typography.micro, fontSize: 10 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  cardHeadline: { ...typography.h3, color: c.text, lineHeight: 22 },
  cardPreview: {
    ...typography.caption,
    color: c.textDim,
    marginTop: 5,
    lineHeight: 19,
  },

  body: { marginTop: spacing.lg, gap: spacing.md },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  metric: { minWidth: 62 },
  metricValue: {
    ...typography.h3,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { ...typography.caption, color: c.textFaint, marginTop: 1, fontSize: 11 },
  detailLine: { ...typography.body, color: c.textSecondary, lineHeight: 22, fontSize: 14 },
  actionBox: {
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: c.bronze,
  },
  actionKicker: { ...typography.micro, color: c.bronze, fontSize: 10 },
  actionText: {
    ...typography.body,
    color: c.text,
    marginTop: 5,
    lineHeight: 21,
    fontSize: 14,
  },

  lockedFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  lockedText: { ...typography.caption, color: c.textFaint, flex: 1 },
  miniBadge: {
    backgroundColor: c.bronzeSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  miniBadgeText: { ...typography.micro, color: c.bronze, fontSize: 9 },

  footerCta: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
  },
  footerCtaText: { ...typography.captionBold, color: c.bronze },
}));
