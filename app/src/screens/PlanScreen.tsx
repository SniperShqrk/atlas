import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert } from 'react-native';
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
import { haptics } from '@/lib/haptics';

const SPLITS: { key: SplitPreference; label: string }[] = [
  { key: 'auto', label: 'Let it choose' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'upper_lower', label: 'Upper / Lower' },
  { key: 'push_pull_legs', label: 'Push Pull Legs' },
  { key: 'bro_split', label: 'Body Part Split' },
];

const SESSION_LENGTHS = [30, 45, 60, 75, 90];
const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

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
  const savedPlans = useWorkoutStore((s) => s.savedPlans);
  const savePlan = useWorkoutStore((s) => s.savePlan);
  const loadSavedPlan = useWorkoutStore((s) => s.loadSavedPlan);
  const deleteSavedPlan = useWorkoutStore((s) => s.deleteSavedPlan);
  const startSession = useWorkoutStore((s) => s.startSession);
  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const updatePlanExercise = useWorkoutStore((s) => s.updatePlanExercise);
  const removePlanExercise = useWorkoutStore((s) => s.removePlanExercise);
  const removePlanDay = useWorkoutStore((s) => s.removePlanDay);
  const addPlanDay = useWorkoutStore((s) => s.addPlanDay);
  const isPro = useEntitlements((s) => s.isPro);
  const recordPaywallView = useEntitlements((s) => s.recordPaywallView);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const isPlanSaved = !!currentPlan && savedPlans.some((p) => p.id === currentPlan.id);

  const onSavePlan = () => {
    if (!currentPlan) return;
    const label = `${profile.goal.replace('_', ' ')} · ${new Date(currentPlan.createdAt).toLocaleDateString()}`;
    savePlan(currentPlan.name ?? label);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
      const plan = await generatePlan(profile, recent);
      setCurrentPlan(plan);
      // Land straight in Edit Plan mode — the set/rep steppers and Add
      // Exercise row so editing is immediately available rather than making
      // someone find and tap "Edit Plan" first to discover it exists.
      setEditing(true);
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
    day.exercises.forEach((ex) =>
      addExerciseToActive(ex.exerciseId, { targetSets: ex.targetSets, targetReps: ex.targetReps })
    );
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
            <Button
              label="Import Workout"
              variant="secondary"
              onPress={() => navigation.navigate('ImportWorkout')}
              style={{ marginTop: spacing.sm }}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {currentPlan?.source === 'rule_based' && !loading && (
              <Text style={styles.note}>
                Built with the offline generator — set an API key on the backend for the AI planner.
              </Text>
            )}
            {currentPlan?.source === 'imported' && !loading && (
              <Text style={styles.note}>Imported from your own plan.</Text>
            )}
          </View>
        )}

        {/* saved plan library — generating/regenerating never touches these,
            only an explicit Save Plan tap does, so switching plans or trying
            a new week never costs you one you already liked. */}
        {isPro && savedPlans.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="My Plans" />
            <Card style={{ padding: 0, marginTop: spacing.sm }}>
              {savedPlans.map((p, i) => (
                <Pressable
                  key={p.id}
                  style={[styles.planRow, i > 0 && styles.exRowBorder]}
                  onPress={() => {
                    loadSavedPlan(p.id);
                    setEditing(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planRowName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.planRowMeta}>
                      {p.days.length} days · {p.source === 'ai' ? 'AI generated' : p.source === 'imported' ? 'Imported' : 'Offline generator'}
                      {currentPlan?.id === p.id ? ' · Open now' : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete this plan?', p.name ?? 'Untitled plan', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteSavedPlan(p.id) },
                      ])
                    }
                    hitSlop={10}
                  >
                    <Icon name="close" size={16} color={colors.textFaint} strokeWidth={1.7} />
                  </Pressable>
                </Pressable>
              ))}
            </Card>
          </View>
        )}

        {/* Free doesn't get a dedicated Import CTA card — the Create Plan
            card below already sends them to the same paywall, which lists
            Import Workouts among the Pro features. A plain link keeps this
            screen from stacking three near-identical upsell blocks. */}
        {!isPro && (
          <Pressable
            onPress={() => {
              recordPaywallView('import_workouts');
              navigation.navigate('Paywall', { feature: 'import_workouts' });
            }}
            style={{ marginTop: spacing.lg }}
          >
            <Text style={styles.importLink}>Have a plan already? Import it →</Text>
          </Pressable>
        )}

        {/* planner parameters — always visible; these feed the AI planner above
            and also shape the empty-state suggestions below, so hiding them
            behind a toggle just cost a tap for no reason */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Planner Settings" />
          <Card style={{ marginTop: spacing.sm }}>
            <Text style={styles.paramLabel}>DAYS PER WEEK</Text>
            <View style={styles.chipRow}>
              {DAYS_PER_WEEK_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  label={`${d}`}
                  active={profile.daysPerWeek === d}
                  onPress={() => setProfile({ daysPerWeek: d })}
                />
              ))}
            </View>

            <Text style={[styles.paramLabel, { marginTop: spacing.lg }]}>SESSION LENGTH</Text>
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

            <Button
              label={editing ? 'Done Editing' : 'Edit Plan'}
              variant="bronze"
              size="md"
              onPress={() => setEditing((e) => !e)}
              style={{ marginTop: spacing.md }}
            />

            {isPro && (
              <Button
                label={isPlanSaved ? 'Update Saved Plan' : 'Save Plan'}
                variant="secondary"
                onPress={onSavePlan}
                style={{ marginTop: spacing.sm }}
              />
            )}
            {justSaved && !loading && (
              <Text style={[styles.note, { marginTop: spacing.sm }]}>Saved to My Plans.</Text>
            )}

            {currentPlan.days.map((day, i) => (
              <View key={i} style={{ marginTop: spacing.xl }}>
                <SectionHeader
                  title={`${day.label} · ${day.focus}`}
                  action={editing ? 'Remove Day' : 'Start'}
                  onAction={() =>
                    editing
                      ? Alert.alert('Remove this day?', `${day.label} · ${day.focus}`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removePlanDay(i) },
                        ])
                      : startDay(i)
                  }
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
                    if (editing) {
                      return (
                        <View key={j} style={[styles.exRowEditing, j > 0 && styles.exRowBorder]}>
                          <View style={styles.exEditTop}>
                            <Pressable
                              style={{ flex: 1 }}
                              onPress={() =>
                                navigation.navigate('ExerciseLibrary', {
                                  picker: true,
                                  planDayIndex: i,
                                  planExerciseIndex: j,
                                })
                              }
                            >
                              <Text style={styles.exName} numberOfLines={1}>
                                {exercise.name}
                              </Text>
                              <Text style={styles.swapHint}>Tap to swap</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => removePlanExercise(i, j)}
                              hitSlop={10}
                              style={styles.removeExBtn}
                            >
                              <Icon name="close" size={14} color={colors.textFaint} strokeWidth={1.8} />
                            </Pressable>
                          </View>
                          <View style={styles.exEditBottom}>
                            <View style={styles.stepperRow}>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => {
                                  haptics.tap();
                                  updatePlanExercise(i, j, { targetSets: Math.max(1, ex.targetSets - 1) });
                                }}
                              >
                                <Text style={styles.stepperBtnText}>–</Text>
                              </Pressable>
                              <Text style={styles.stepperValue}>{ex.targetSets} sets</Text>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => {
                                  haptics.tap();
                                  updatePlanExercise(i, j, { targetSets: Math.min(10, ex.targetSets + 1) });
                                }}
                              >
                                <Text style={styles.stepperBtnText}>+</Text>
                              </Pressable>
                            </View>
                            <TextInput
                              style={styles.repsInput}
                              value={ex.targetReps}
                              onChangeText={(t) => updatePlanExercise(i, j, { targetReps: t })}
                              placeholder="reps"
                              placeholderTextColor={colors.textFaint}
                            />
                          </View>
                        </View>
                      );
                    }
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
                  {editing && (
                    <Pressable
                      style={[styles.addExerciseRow, day.exercises.length > 0 && styles.exRowBorder]}
                      onPress={() => navigation.navigate('ExerciseLibrary', { picker: true, planDayIndex: i })}
                    >
                      <Icon name="plus" size={16} color={colors.bronze} strokeWidth={1.9} />
                      <Text style={styles.addExerciseText}>Add Exercise</Text>
                    </Pressable>
                  )}
                </Card>
              </View>
            ))}

            {editing && (
              <Button
                label="Add Day"
                variant="secondary"
                onPress={addPlanDay}
                style={{ marginTop: spacing.xl }}
              />
            )}
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
  importLink: { ...typography.captionBold, color: c.bronze, textAlign: 'center' },
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
  swapHint: { ...typography.caption, color: c.bronze, marginTop: 1 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  planRowName: { ...typography.bodyMedium, color: c.text },
  planRowMeta: { ...typography.caption, color: c.textDim, marginTop: 2 },
  exMuscles: { ...typography.caption, color: c.textDim, marginTop: 2 },
  exNote: { ...typography.caption, color: c.bronze, marginTop: 3, lineHeight: 17 },
  exTarget: { ...typography.bodyMedium, color: c.accent },
  exRowEditing: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  exEditTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exEditBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  removeExBtn: { padding: 4 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepperBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { ...typography.bodyMedium, color: c.accent },
  stepperValue: { ...typography.caption, color: c.textSecondary, minWidth: 50, textAlign: 'center' },
  repsInput: {
    flex: 1,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    ...typography.caption,
  },
  addExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  addExerciseText: { ...typography.bodyMedium, color: c.bronze },
}));
