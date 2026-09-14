import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Button, StatTile, Divider } from '@/components/ui';
import { ModalHeader, BottomInset } from '@/components/ScreenLayout';
import { StoicQuote } from '@/components/StoicQuote';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, WorkoutSession, sessionVolume, sessionSetCount } from '@/store/workoutStore';
import type { PrEvent } from '@/store/analytics';
import { prCard, sessionCard } from '@/share/cards';
import type { AchievementProgress } from '@/data/achievements';
import { quoteByTheme } from '@/data/quotes';
import { displayWeight } from '@/utils/units';

/**
 * The one screen in the app whose whole job is to make a real PR feel like a
 * real PR — distinct enough from an ordinary finish that hitting one
 * registers, without turning every completed set into a celebration (the
 * research is explicit that decorative gamification reads as "not serious"
 * to this audience, and that unearned celebration is what makes a real one
 * stop landing).
 *
 * A plain finish gets a quiet stat readout. A finish with a genuine e1RM
 * record gets the bronze hero treatment and, only then, a single low-key
 * offer to turn it into a share card — never forced open, never repeated for
 * a session that didn't earn it.
 */
export default function PostWorkoutSummaryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const session: WorkoutSession = route.params.session;
  const prEvents: PrEvent[] = route.params.prEvents ?? [];
  const justUnlocked: AchievementProgress[] = route.params.justUnlocked ?? [];

  const profile = useWorkoutStore((s) => s.profile);
  const sessions = useWorkoutStore((s) => s.sessions);
  const unit = profile.unit;

  const hasPr = prEvents.length > 0;
  const volume = sessionVolume(session);
  const setCount = sessionSetCount(session);

  // seeded off the session's own finish time so it doesn't echo the quote
  // shown when the workout started
  const quote = useMemo(
    () => quoteByTheme(['endurance', 'effort'], Math.floor(session.completedAt! / 86_400_000) + 2),
    [session.completedAt]
  );

  const durationLabel = session.durationSec
    ? session.durationSec >= 3600
      ? `${Math.floor(session.durationSec / 3600)}h ${Math.round((session.durationSec % 3600) / 60)}m`
      : `${Math.round(session.durationSec / 60)}m`
    : '—';

  const onShare = () => {
    const card = hasPr ? prCard(prEvents[0], sessions) : sessionCard(session, sessions);
    navigation.navigate('ShareCard', { card });
  };

  const onDone = () => navigation.goBack();

  return (
    <Screen>
      <ModalHeader title={hasPr ? 'New Record' : 'Workout Complete'} onBack={onDone} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hasPr ? (
          <View style={styles.prHero}>
            <View style={styles.prIconWrap}>
              <Icon name="trophy" size={30} color={colors.bronze} strokeWidth={1.6} />
            </View>
            <Text style={styles.prEyebrow}>
              {prEvents.length === 1 ? 'PERSONAL RECORD' : `${prEvents.length} PERSONAL RECORDS`}
            </Text>
            <View style={styles.prList}>
              {prEvents.map((e) => (
                <View key={e.exerciseId} style={styles.prRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.prDetail}>
                      {displayWeight(e.weightKg, unit)}
                      {unit} × {e.reps}
                    </Text>
                  </View>
                  <Text style={styles.prGain}>+{Math.round(e.gainKg * 10) / 10}kg e1RM</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.plainHero}>
            <View style={styles.plainIconWrap}>
              <Icon name="check" size={26} color={colors.textSecondary} strokeWidth={2} />
            </View>
            <Text style={styles.plainTitle} numberOfLines={1}>
              {session.name}
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <StatTile label="Duration" value={durationLabel} />
          <StatTile label="Sets" value={String(setCount)} />
          <StatTile label="Volume" value={Math.round(volume).toLocaleString()} unit="kg" />
        </View>

        {justUnlocked.length > 0 && (
          <Pressable
            style={styles.unlockRow}
            onPress={() => navigation.navigate('Achievements')}
          >
            <Icon name="trophy" size={16} color={colors.bronze} strokeWidth={1.7} />
            <Text style={styles.unlockText} numberOfLines={1}>
              {justUnlocked.length === 1
                ? justUnlocked[0].tier.label
                : `${justUnlocked.length} milestones unlocked`}
            </Text>
            <Icon name="chevron" size={14} color={colors.textDim} strokeWidth={1.7} />
          </Pressable>
        )}

        <Button
          label={hasPr ? 'Share this record' : 'Share this workout'}
          variant={hasPr ? 'bronze' : 'secondary'}
          onPress={onShare}
          style={{ marginTop: spacing.lg }}
        />

        <View style={styles.quoteWrap}>
          <StoicQuote quote={quote} variant="card" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Divider style={{ marginBottom: spacing.md }} />
        <Button label="Done" onPress={onDone} size="lg" />
        <BottomInset />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },
  prHero: {
    alignItems: 'center',
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  prIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  prEyebrow: { ...typography.micro, color: c.bronze, fontWeight: '700', letterSpacing: 1.2 },
  prList: { width: '100%', marginTop: spacing.lg, gap: spacing.sm },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  prName: { ...typography.bodyMedium, color: c.text },
  prDetail: { ...typography.caption, color: c.textDim, marginTop: 2 },
  prGain: { ...typography.captionBold, color: c.bronze },
  plainHero: { alignItems: 'center', paddingVertical: spacing.xl },
  plainIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  plainTitle: { ...typography.h2, color: c.text, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  unlockText: { ...typography.caption, color: c.textSecondary, flex: 1, fontWeight: '600' },
  quoteWrap: { marginTop: spacing.xl },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
}));
