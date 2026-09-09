import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card } from '@/components/ui';
import { ModalHeader, BottomInset } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import {
  AchievementCategory,
  AchievementProgress,
  CATEGORY_LABELS,
  computeAchievements,
} from '@/data/achievements';

const CATEGORY_ORDER: AchievementCategory[] = ['sessions', 'volume', 'streak', 'records', 'exercises'];
const CATEGORY_ICON: Record<AchievementCategory, any> = {
  sessions: 'workout',
  volume: 'plates',
  streak: 'flame',
  records: 'trophy',
  exercises: 'library',
};

function formatDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const sessions = useWorkoutStore((s) => s.sessions);
  const profile = useWorkoutStore((s) => s.profile);

  const report = useMemo(
    () => computeAchievements(sessions, profile.daysPerWeek),
    [sessions, profile.daysPerWeek]
  );

  return (
    <Screen>
      <ModalHeader title="Achievements" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.summaryValue}>
            {report.unlockedCount} <Text style={styles.summaryOf}>of {report.totalCount}</Text>
          </Text>
          <Text style={styles.summaryLabel}>Milestones unlocked</Text>
          <View style={styles.summaryTrack}>
            <View
              style={[
                styles.summaryFill,
                { width: `${Math.round((report.unlockedCount / report.totalCount) * 100)}%` },
              ]}
            />
          </View>
        </Card>

        {report.nextUp.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={styles.sectionTitle}>Closest to unlocking</Text>
            <Card style={{ padding: 0 }}>
              {report.nextUp.slice(0, 3).map((n, i) => (
                <View key={n.tier.id} style={[styles.nextRow, i > 0 && styles.rowBorder]}>
                  <Icon name={CATEGORY_ICON[n.tier.category]} size={18} color={colors.bronze} strokeWidth={1.6} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextLabel}>{n.tier.label}</Text>
                    <Text style={styles.nextDetail}>{n.tier.detail}</Text>
                  </View>
                  <Text style={styles.nextPct}>{n.pct}%</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {CATEGORY_ORDER.map((cat) => (
          <View key={cat} style={{ marginTop: spacing.xl }}>
            <Text style={styles.sectionTitle}>{CATEGORY_LABELS[cat]}</Text>
            <Card style={{ padding: 0 }}>
              {report.byCategory[cat].map((a, i) => (
                <TierRow key={a.tier.id} progress={a} first={i === 0} />
              ))}
            </Card>
          </View>
        ))}

        <BottomInset extra={spacing.xxl} />
      </ScrollView>
    </Screen>
  );
}

function TierRow({ progress, first }: { progress: AchievementProgress; first: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { tier, unlocked, achievedAt } = progress;

  return (
    <View style={[styles.tierRow, !first && styles.rowBorder]}>
      <View
        style={[
          styles.badge,
          unlocked ? { backgroundColor: colors.bronzeSoft, borderColor: colors.bronze } : styles.badgeLocked,
        ]}
      >
        <Icon
          name={unlocked ? 'check' : 'lock'}
          size={14}
          color={unlocked ? colors.bronze : colors.textFaint}
          strokeWidth={2}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tierLabel, !unlocked && styles.tierLabelLocked]}>{tier.label}</Text>
        <Text style={styles.tierDetail}>
          {tier.detail}
          {achievedAt ? ` · ${formatDate(achievedAt)}` : ''}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  summaryValue: { ...typography.hero, color: c.text },
  summaryOf: { ...typography.h3, color: c.textDim, fontWeight: '400' },
  summaryLabel: { ...typography.caption, color: c.textDim, marginTop: 2 },
  summaryTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.cardAlt,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  summaryFill: { height: '100%', borderRadius: 3, backgroundColor: c.bronze },

  sectionTitle: {
    ...typography.micro,
    color: c.textDim,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  nextLabel: { ...typography.bodyMedium, color: c.text },
  nextDetail: { ...typography.caption, color: c.textDim, marginTop: 2 },
  nextPct: { ...typography.captionBold, color: c.bronze },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLocked: { backgroundColor: c.cardAlt, borderColor: c.border },
  tierLabel: { ...typography.bodyMedium, color: c.text },
  tierLabelLocked: { color: c.textDim },
  tierDetail: { ...typography.caption, color: c.textDim, marginTop: 2 },
}));
