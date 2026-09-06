import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, Button, SectionHeader, EmptyState, Chip, InfoButton } from '@/components/ui';
import { ScreenLayout } from '@/components/ScreenLayout';
import { ProBadge } from '@/components/Pro';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, SplitPreference } from '@/store/workoutStore';
import { useEntitlements } from '@/store/entitlements';
import { getExerciseById, MUSCLE_LABELS, MuscleGroup } from '@/data/exercises';
import { generatePlan } from '@/api/client';

const SPLITS: { key: SplitPreference; label: string }[] = [
  { key: 'auto', label: 'Let it choose' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'upper_lower', label: 'Upper / Lower' },
  { key: 'push_pull_legs', label: 'Push Pull Legs' },
  { key: 'bro_split', label: 'Body Part Split' },
];

const SESSION_LENGTHS = [30, 45, 60, 75, 90];

const EMPHASIS_OPTIONS: MuscleGroup[] = [
  'chest', 'lats', 'side_delts', 'rear_delts', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
];

export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const profile = useWorkoutStore((s) => s.profile);
  const setProfile = useWorkoutStore((s) => s.setProfile);
  const sessions = useWorkoutStore((s) => s.sessions);
  const currentPlan = useWorkoutStore((s) => s.currentPlan);
  const setCurrentPlan = useWorkoutStore((s) => s.setCurrentPlan);
  const startSession = useWorkoutStore((s) => s.startSession);
  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const isPro = useEntitlements((s) => s.isPro);
  const recordPaywallView = useEntitlements((s) => s.recordPaywallView);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
      const plan = await generatePlan(profile, recent);
      setCurrentPlan(plan);
    } catch {
      setError('Could not reach the planner. Check the backend is running and reachable.');
    } finally {
      setLoading(false);
    }
  };

  const startDay = (dayIndex: number) => {
    const day = currentPlan?.days[dayIndex];
    if (!day) return;
    startSession(`${day.label} · ${day.focus}`);
    day.exercises.forEach((ex) => addExerciseToActive(ex.exerciseId));
    navigation.navigate('WorkoutTab');
  };

  const toggleEmphasis = (m: MuscleGroup) => {
    const has = profile.emphasis.includes(m);
    setProfile({
      emphasis: has ? profile.emphasis.filter((x) => x !== m) : [...profile.emphasis, m].slice(0, 3),
    });
  };

  return (
    <Screen>
      <ScreenLayout>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Plan</Text>
          {!isPro && <ProBadge />}
        </View>
        <Text style={styles.subtitle}>
          {profile.daysPerWeek} days · {profile.sessionMinutes} min · {profile.goal.replace('_', ' ')}
        </Text>

        {/* generation — the real thing, for Pro. Free users get the Create
            Plan CTA above instead of a second, redundant lock panel here. */}
        {isPro && (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              label={loading ? 'Building your week…' : currentPlan ? 'Regenerate Plan' : 'Generate Plan'}
              onPress={onGenerate}
              loading={loading}
              size="lg"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {currentPlan?.source === 'rule_based' && !loading && (
              <Text style={styles.note}>
                Built with the offline generator — set an API key on the backend for the AI planner.
              </Text>
            )}
          </View>
        )}

        {/* planner parameters — always visible; these feed the AI planner above
            and also shape the empty-state suggestions below, so hiding them
            behind a toggle just cost a tap for no reason */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Planner Settings" />
          <Card style={{ marginTop: spacing.sm }}>
            <Text style={styles.paramLabel}>SESSION LENGTH</Text>
            <View style={styles.chipRow}>
              {SESSION_LENGTHS.map((m) => (
                <Chip
                  key={m}
                  label={`${m}m`}
                  active={profile.sessionMinutes === m}
                  onPress={() => setProfile({ sessionMinutes: m })}
                />
              ))}
            </View>

            <Text style={[styles.paramLabel, { marginTop: spacing.lg }]}>SPLIT STYLE</Text>
            <View style={styles.chipRow}>
              {SPLITS.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={profile.preferredSplit === s.key}
                  onPress={() => setProfile({ preferredSplit: s.key })}
                />
              ))}
            </View>

            <Text style={[styles.paramLabel, { marginTop: spacing.lg }]}>
              EMPHASIS · PICK UP TO 3
            </Text>
            <View style={styles.chipRow}>
              {EMPHASIS_OPTIONS.map((m) => (
                <Chip
                  key={m}
                  label={MUSCLE_LABELS[m]}
                  active={profile.emphasis.includes(m)}
                  onPress={() => toggleEmphasis(m)}
                />
              ))}
            </View>

            <Text style={[styles.paramLabel, { marginTop: spacing.lg }]}>
              INJURIES / THINGS TO AVOID
            </Text>
            <TextInput
              style={styles.limitationsInput}
              value={profile.limitations}
              onChangeText={(t) => setProfile({ limitations: t })}
              placeholder="e.g. dodgy left shoulder, no overhead pressing"
              placeholderTextColor={colors.textFaint}
              multiline
            />
          </Card>
        </View>

        {/* prominent premium CTA — the intentional funnel this screen exists
            to run: Workout Planner → Create Plan → ATLAS Pro. Pro users
            already have the real generate button up top, so this only shows
            for Free. Sits above "No plan yet" so it reads as the answer to
            that question rather than an afterthought below it. */}
        {!isPro && (
          <Pressable
            onPress={() => {
              recordPaywallView('ai_planner');
              navigation.navigate('Paywall', { feature: 'ai_planner' });
            }}
            style={({ pressed }) => [
              styles.createPlanCard,
              pressed && { opacity: 0.88 },
              { marginTop: spacing.xl },
            ]}
          >
            <View style={styles.createPlanIconWrap}>
              <Icon name="sparkle" size={22} color="#fff" strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.createPlanTitleRow}>
                <Text style={styles.createPlanTitle}>Create Plan</Text>
                <ProBadge />
              </View>
              <Text style={styles.createPlanBlurb}>
                Let ATLAS build and schedule your whole week automatically
              </Text>
            </View>
            <Icon name="chevron" size={18} color={colors.bronze} strokeWidth={1.8} />
          </Pressable>
        )}

        {!currentPlan && !loading && (
          <EmptyState
            title="No plan yet"
            subtitle="The planner reads your goal, equipment, time per session, injuries and current recovery, then writes the week around them."
          />
        )}

        {currentPlan && (
          <>
            <Card style={{ marginTop: spacing.xl }}>
              <Text style={styles.summary}>{currentPlan.summary}</Text>
              {currentPlan.model && (
                <Text style={styles.modelNote}>Generated by {currentPlan.model}</Text>
              )}
            </Card>

            {currentPlan.days.map((day, i) => (
              <View key={i} style={{ marginTop: spacing.xl }}>
                <SectionHeader
                  title={`${day.label} · ${day.focus}`}
                  action="Start"
                  onAction={() => startDay(i)}
                />
                {day.estimatedMinutes ? (
                  <Text style={styles.dayMeta}>
                    about {day.estimatedMinutes} minutes · {day.exercises.length} exercises
                  </Text>
                ) : null}
                <Card style={{ padding: 0, marginTop: spacing.sm }}>
                  {day.exercises.map((ex, j) => {
                    const exercise = getExerciseById(ex.exerciseId);
                    if (!exercise) return null;
                    return (
                      <Pressable
                        key={j}
                        style={[styles.exRow, j > 0 && styles.exRowBorder]}
                        onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.exerciseId })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.exName}>{exercise.name}</Text>
                          <Text style={styles.exMuscles}>
                            {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}
                          </Text>
                          {ex.note ? <Text style={styles.exNote}>{ex.note}</Text> : null}
                        </View>
                        <Text style={styles.exTarget}>
                          {ex.targetSets} × {ex.targetReps}
                        </Text>
                        <InfoButton
                          onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.exerciseId })}
                        />
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            ))}
          </>
        )}
      </ScreenLayout>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  createPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.bronzeSoft,
    borderWidth: 1.5,
    borderColor: c.bronze,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  createPlanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPlanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  createPlanTitle: { ...typography.h2, color: c.text },
  createPlanBlurb: { ...typography.caption, color: c.textDim, marginTop: 3, lineHeight: 18 },
  title: { ...typography.hero, color: c.text },
  subtitle: { ...typography.body, color: c.textDim, marginTop: 2, textTransform: 'capitalize' },
  paramLabel: { ...typography.micro, color: c.textFaint, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  limitationsInput: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    padding: spacing.md,
    minHeight: 68,
    textAlignVertical: 'top',
    ...typography.body,
  },
  error: { ...typography.caption, color: c.danger, marginTop: spacing.md },
  note: { ...typography.caption, color: c.bronze, marginTop: spacing.md, lineHeight: 18 },
  summary: { ...typography.body, color: c.textSecondary, lineHeight: 22 },
  modelNote: { ...typography.caption, color: c.textFaint, marginTop: spacing.sm },
  dayMeta: { ...typography.caption, color: c.textDim, marginTop: -spacing.sm },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  exRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  exName: { ...typography.bodyMedium, color: c.text },
  exMuscles: { ...typography.caption, color: c.textDim, marginTop: 2 },
  exNote: { ...typography.caption, color: c.bronze, marginTop: 3, lineHeight: 17 },
  exTarget: { ...typography.bodyMedium, color: c.accent },
}));
