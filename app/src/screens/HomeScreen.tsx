import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, Button, SectionHeader, StatTile } from '@/components/ui';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { BodyMap } from '@/components/BodyMap';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, sessionVolume, sessionSetCount } from '@/store/workoutStore';
import { computeMuscleLoads } from '@/store/recovery';
import { consistency } from '@/store/analytics';
import {
  EXERCISES,
  MUSCLE_LABELS,
  MuscleGroup,
  getExerciseById,
  CATEGORY_LABELS,
  Category,
} from '@/data/exercises';
import { quoteOfTheDay } from '@/data/quotes';
import { StoicQuote } from '@/components/StoicQuote';
import { kgToLb } from '@/utils/units';

// A fixed, well-rounded set rather than anything computed — "popular" has no
// real signal to draw on yet (no cross-user data), so this is a deliberate
// editorial pick covering the big push/pull/leg compounds.
const POPULAR_EXERCISE_IDS = [
  'barbell_bench_press',
  'back_squat',
  'deadlift',
  'overhead_press',
  'barbell_row',
  'pull_up',
];
const HOME_LIBRARY_CATEGORIES: Category[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const sessions = useWorkoutStore((s) => s.sessions);
  const profile = useWorkoutStore((s) => s.profile);
  const unit = profile.unit;
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startSession = useWorkoutStore((s) => s.startSession);
  const currentPlan = useWorkoutStore((s) => s.currentPlan);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const recentlyViewed = useWorkoutStore((s) => s.recentlyViewed);
  const [view, setView] = useState<'front' | 'back'>('front');

  const popularExercises = useMemo(
    () => POPULAR_EXERCISE_IDS.map(getExerciseById).filter((e): e is NonNullable<typeof e> => !!e),
    []
  );
  const recentlyViewedExercises = useMemo(
    () =>
      recentlyViewed
        .map(getExerciseById)
        .filter((e): e is NonNullable<typeof e> => !!e)
        .slice(0, 8),
    [recentlyViewed]
  );

  const quote = useMemo(() => quoteOfTheDay(), []);
  const loads = useMemo(() => computeMuscleLoads(sessions), [sessions]);
  const streak = useMemo(
    () => consistency(sessions, profile.daysPerWeek),
    [sessions, profile.daysPerWeek]
  );
  // a gap wider than the days-per-week target plus a two-day margin is where
  // "recovering" reads as "at risk" instead — a 4x/week trainer resting on
  // day 3 hasn't slipped, but on day 6 they're about to lose the week
  const streakAtRisk = streak.daysSinceLast !== null && streak.daysSinceLast >= profile.daysPerWeek + 2;

  const weekSessions = useMemo(() => {
    const wkStart = startOfWeek(new Date()).getTime();
    return sessions.filter((s) => (s.completedAt ?? s.startedAt) >= wkStart);
  }, [sessions]);

  const weekVolume = useMemo(
    () => weekSessions.reduce((sum, s) => sum + sessionVolume(s), 0),
    [weekSessions]
  );
  const weekSets = useMemo(
    () => weekSessions.reduce((sum, s) => sum + sessionSetCount(s), 0),
    [weekSessions]
  );

  const ranked = useMemo(() => {
    return (Object.values(loads) as any[])
      .filter((l) => l.status !== 'untrained')
      .sort((a, b) => a.recoveryPct - b.recoveryPct);
  }, [loads]);

  const needsRecovery = ranked.filter((l) => l.recoveryPct < 65).slice(0, 4);
  const readyToTrain = useMemo(
    () =>
      (Object.values(loads) as any[])
        .filter((l) => l.recoveryPct >= 85)
        .sort((a, b) => b.recoveryPct - a.recoveryPct)
        .slice(0, 4),
    [loads]
  );

  const lastSession = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
      )[0],
    [sessions]
  );

  return (
    <Screen>
      <ScreenLayout>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hey {profile.name || 'there'}</Text>
              <Text style={styles.subGreeting}>
                {weekSessions.length} of {profile.daysPerWeek} sessions this week
              </Text>
            </View>
            {streak.weekStreak > 0 && (
              <Pressable
                style={[styles.streakChip, streakAtRisk && styles.streakChipRisk]}
                onPress={() => navigation.navigate('Achievements')}
              >
                <Icon
                  name="flame"
                  size={15}
                  color={streakAtRisk ? colors.recoveryFatigued : colors.bronze}
                  strokeWidth={1.8}
                />
                <Text style={[styles.streakText, streakAtRisk && { color: colors.recoveryFatigued }]}>
                  {streak.weekStreak}w
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <StoicQuote quote={quote} variant="inline" />
          </View>

          {/* week snapshot */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={styles.statRow}>
              <StatTile label="Workouts" value={String(weekSessions.length)} />
              <StatTile label="Sets" value={String(weekSets)} />
              <StatTile
                label="Volume"
                value={Math.round(unit === 'lb' ? kgToLb(weekVolume) : weekVolume).toLocaleString()}
                unit={unit}
              />
            </View>
          </Card>

          {activeSession ? (
            <Button
              label="Resume Workout"
              size="lg"
              onPress={() => navigation.navigate('WorkoutTab')}
              style={{ marginTop: spacing.lg }}
            />
          ) : (
            <Button
              label="Start Workout"
              size="lg"
              onPress={() => {
                startSession();
                navigation.navigate('WorkoutTab');
              }}
              style={{ marginTop: spacing.lg }}
            />
          )}

          {/* recovery map */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Muscle Recovery" />
            <Card style={{ alignItems: 'center' }}>
              <View style={styles.toggle}>
                {(['front', 'back'] as const).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setView(v)}
                    style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                      {v === 'front' ? 'Front' : 'Back'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <BodyMap mode="recovery" view={view} loads={loads} size={200} />

              <View style={styles.legend}>
                <Legend color={colors.recoveryFatigued} label="Fatigued" />
                <Legend color={colors.recoveryModerate} label="Recovering" />
                <Legend color={colors.recoveryReady} label="Ready" />
                <Legend color={colors.recoveryFresh} label="Fresh" />
                <Legend color={colors.recoveryUntrained} label="Untrained" />
              </View>
            </Card>
          </View>

          {needsRecovery.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Still Recovering" />
              <Card>
                {needsRecovery.map((l, i) => (
                  <MuscleRow key={l.muscle} load={l} first={i === 0} />
                ))}
              </Card>
            </View>
          )}

          {readyToTrain.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Ready To Train" />
              <Card>
                {readyToTrain.map((l, i) => (
                  <MuscleRow key={l.muscle} load={l} first={i === 0} />
                ))}
              </Card>
            </View>
          )}

          {/* last workout */}
          {lastSession && (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Last Workout" action="See all" onAction={() => navigation.navigate('History')} />
              <Card onPress={() => navigation.navigate('History')}>
                <Text style={styles.lastName}>{lastSession.name}</Text>
                <Text style={styles.lastMeta}>
                  {sessionSetCount(lastSession)} sets ·{' '}
                  {Math.round(
                    unit === 'lb' ? kgToLb(sessionVolume(lastSession)) : sessionVolume(lastSession)
                  ).toLocaleString()}
                  {unit}
                </Text>
                <Text style={styles.lastExercises} numberOfLines={2}>
                  {lastSession.entries
                    .map((e) => getExerciseById(e.exerciseId)?.name)
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Card>
            </View>
          )}

          {currentPlan && (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Your Plan" action="View" onAction={() => navigation.navigate('PlanTab')} />
              <Card onPress={() => navigation.navigate('PlanTab')}>
                <Text style={styles.planSummary} numberOfLines={3}>
                  {currentPlan.summary}
                </Text>
              </Card>
            </View>
          )}

          {/* exercise library preview — same system as the standalone Library
              screen (shared ExerciseThumb + category/data), just a taste of
              it here. Kept at the very bottom since it's a jumping-off point
              rather than something to check daily. */}
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxxl }}>
            <SectionHeader
              title="Exercise Library"
              action="View All"
              onAction={() => navigation.navigate('ExerciseLibrary')}
            />
            <Pressable
              style={styles.librarySearch}
              onPress={() => navigation.navigate('ExerciseLibrary')}
            >
              <Icon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
              <Text style={styles.librarySearchText}>Search exercises…</Text>
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryRow}
            >
              {HOME_LIBRARY_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={styles.categoryChip}
                  onPress={() => navigation.navigate('ExerciseLibrary', { category: cat })}
                >
                  <Text style={styles.categoryChipText}>{CATEGORY_LABELS[cat]}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {recentlyViewedExercises.length > 0 && (
              <>
                <Text style={styles.libSubLabel}>RECENTLY VIEWED</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.exCardRow}>
                    {recentlyViewedExercises.map((ex) => (
                      <Pressable
                        key={ex.id}
                        style={styles.exCard}
                        onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.id })}
                      >
                        <ExerciseThumb exercise={ex} size={52} />
                        <Text style={styles.exCardName} numberOfLines={2}>
                          {ex.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={styles.libSubLabel}>POPULAR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.exCardRow}>
                {popularExercises.map((ex) => (
                  <Pressable
                    key={ex.id}
                    style={styles.exCard}
                    onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.id })}
                  >
                    <ExerciseThumb exercise={ex} size={52} />
                    <Text style={styles.exCardName} numberOfLines={2}>
                      {ex.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

      </ScreenLayout>
    </Screen>
  );
}

function MuscleRow({ load, first }: { load: any; first: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const color =
    load.recoveryPct >= 85
      ? colors.recoveryFresh
      : load.recoveryPct >= 65
      ? colors.recoveryReady
      : load.recoveryPct >= 35
      ? colors.recoveryModerate
      : colors.recoveryFatigued;

  return (
    <View style={[styles.muscleRow, !first && styles.muscleRowBorder]}>
      <Text style={styles.muscleName}>{MUSCLE_LABELS[load.muscle as MuscleGroup]}</Text>
      <View style={styles.muscleBarWrap}>
        <View style={[styles.muscleBar, { width: `${load.recoveryPct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.musclePct}>{load.recoveryPct}%</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  greeting: { ...typography.hero, color: c.text },
  subGreeting: { ...typography.body, color: c.textDim, marginTop: 2 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  streakChipRisk: { backgroundColor: 'rgba(180,71,47,0.14)', borderColor: 'rgba(180,71,47,0.4)' },
  streakText: { ...typography.captionBold, color: c.bronze },
  statRow: { flexDirection: 'row' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.cardAlt,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.md,
  },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 7, borderRadius: radius.pill },
  toggleBtnActive: { backgroundColor: c.accent },
  toggleText: { ...typography.caption, color: c.textSecondary },
  toggleTextActive: { color: c.onAccent, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...typography.caption, color: c.textDim, fontSize: 12 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: spacing.md },
  muscleRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  muscleName: { ...typography.body, color: c.text, width: 92 },
  muscleBarWrap: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.cardAlt,
    overflow: 'hidden',
  },
  muscleBar: { height: '100%', borderRadius: 3, borderWidth: 1, borderColor: c.borderStrong },
  musclePct: { ...typography.captionBold, width: 38, textAlign: 'right', color: c.textSecondary },
  lastName: { ...typography.h3, color: c.text },
  lastMeta: { ...typography.caption, color: c.accent, marginTop: 3 },
  lastExercises: { ...typography.caption, color: c.textDim, marginTop: 6, lineHeight: 18 },
  planSummary: { ...typography.body, color: c.textSecondary, lineHeight: 21 },
  librarySearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  librarySearchText: { ...typography.body, color: c.textDim },
  categoryScroll: { height: 48, flexGrow: 0, flexShrink: 0, marginTop: spacing.md },
  categoryRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  categoryChipText: { ...typography.caption, color: c.textSecondary, fontWeight: '600' },
  libSubLabel: { ...typography.micro, color: c.textFaint, marginTop: spacing.lg, marginBottom: spacing.sm },
  exCardRow: { flexDirection: 'row', gap: spacing.md },
  exCard: { width: 76, alignItems: 'center', gap: 6 },
  exCardName: { ...typography.caption, color: c.textSecondary, textAlign: 'center', lineHeight: 16 },
}));
