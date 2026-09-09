import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Button, EmptyState, InfoButton } from '@/components/ui';
import { RestTimer } from '@/components/RestTimer';
import { PlateCalculator } from '@/components/PlateCalculator';
import { WorkoutGuide } from '@/components/WorkoutGuide';
import { TopInset, BottomInset } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { haptics } from '@/lib/haptics';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import {
  useWorkoutStore,
  getPreviousSets,
  sessionVolume,
  sessionSetCount,
  estimate1RM,
} from '@/store/workoutStore';
import { suggestNext } from '@/store/progression';
import { getExerciseById } from '@/data/exercises';
import { syncSession } from '@/api/client';
import { syncStatsToSupabase } from '@/lib/socialSync';
import { quoteByTheme } from '@/data/quotes';
import { StoicQuote } from '@/components/StoicQuote';
import { computeAchievements, newlyUnlocked, AchievementProgress } from '@/data/achievements';
import { displayWeight, parseWeightInput, parseReps } from '@/utils/units';

function elapsed(startedAt: number | null, now: number) {
  // still building the plan — nothing logged yet, so the clock hasn't started
  if (startedAt == null) return '0:00';
  const total = Math.floor((now - startedAt) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const active = useWorkoutStore((s) => s.activeSession);
  const sessions = useWorkoutStore((s) => s.sessions);
  const records = useWorkoutStore((s) => s.records);
  const profile = useWorkoutStore((s) => s.profile);
  const unit = profile.unit;
  const routines = useWorkoutStore((s) => s.routines);
  const currentPlan = useWorkoutStore((s) => s.currentPlan);
  const savedPlans = useWorkoutStore((s) => s.savedPlans);
  const startSession = useWorkoutStore((s) => s.startSession);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const startFromPlanDay = useWorkoutStore((s) => s.startFromPlanDay);
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removeExercise = useWorkoutStore((s) => s.removeExerciseFromActive);
  const finishSession = useWorkoutStore((s) => s.finishSession);
  const discard = useWorkoutStore((s) => s.discardActiveSession);

  const [now, setNow] = useState(Date.now());
  const [plateTarget, setPlateTarget] = useState<number | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<AchievementProgress[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  // seeded a day ahead of the home screen's quote so the two don't echo
  // each other, and filtered to lines about starting rather than enduring
  const startQuote = useMemo(
    () => quoteByTheme(['action', 'discipline'], Math.floor(Date.now() / 86_400_000) + 1),
    []
  );

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) {
    return (
      <Screen>
        <TopInset />
        <View style={styles.emptyHeader}>
          <Text style={styles.emptyHeaderTitle}>Workout</Text>
          <Pressable
            style={({ pressed }) => [styles.helpButton, pressed && { opacity: 0.75 }]}
            onPress={() => setShowGuide(true)}
            hitSlop={6}
          >
            <Icon name="info" size={14} color={colors.accent} strokeWidth={2} />
            <Text style={styles.helpButtonText}>How to use</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
          {justUnlocked.length > 0 && (
            <Pressable
              style={styles.unlockBanner}
              onPress={() => {
                setJustUnlocked([]);
                navigation.navigate('Achievements');
              }}
            >
              <Icon name="trophy" size={20} color={colors.bronze} strokeWidth={1.6} />
              <View style={{ flex: 1 }}>
                <Text style={styles.unlockTitle}>
                  {justUnlocked.length === 1 ? 'Milestone unlocked' : `${justUnlocked.length} milestones unlocked`}
                </Text>
                <Text style={styles.unlockDetail} numberOfLines={1}>
                  {justUnlocked.map((a) => a.tier.label).join(' · ')}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.bronze} strokeWidth={1.7} />
            </Pressable>
          )}

          {!currentPlan && (
            <Pressable style={styles.planNudge} onPress={() => navigation.navigate('PlanTab')}>
              <Icon name="plan" size={20} color={colors.bronze} strokeWidth={1.6} />
              <View style={{ flex: 1 }}>
                <Text style={styles.planNudgeTitle}>No plan made</Text>
                <Text style={styles.planNudgeDetail}>Want to build one for the week?</Text>
              </View>
              <Icon name="chevron" size={16} color={colors.textDim} strokeWidth={1.7} />
            </Pressable>
          )}

          <EmptyState
            title="Ready to train"
            subtitle="Start an empty session, or pick up one of your routines."
          />
          <Button label="Start Empty Workout" size="lg" onPress={() => startSession()} />

          {routines.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={styles.sectionLabel}>YOUR ROUTINES</Text>
              {routines.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.routineRow}
                  onPress={() => startFromRoutine(r.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routineName}>{r.name}</Text>
                    <Text style={styles.routineMeta}>{r.exercises.length} exercises</Text>
                  </View>
                  <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
                </Pressable>
              ))}
            </View>
          )}

          {/* saved AI-generated/imported plans — each one expands into its
              days right here, since jumping straight into "Push day of my
              Hypertrophy plan" is the point, not just opening the plan and
              tapping Start from there. */}
          {savedPlans.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={styles.sectionLabel}>YOUR PLANS</Text>
              {savedPlans.map((p) => (
                <View key={p.id} style={{ marginBottom: spacing.md }}>
                  <Text style={styles.planGroupName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.days.map((day, di) => (
                    <Pressable
                      key={di}
                      style={styles.routineRow}
                      onPress={() => startFromPlanDay(p.id, di)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routineName}>{day.label} · {day.focus}</Text>
                        <Text style={styles.routineMeta}>{day.exercises.length} exercises</Text>
                      </View>
                      <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
            <StoicQuote quote={startQuote} variant="card" />
          </View>
        </ScrollView>
        <WorkoutGuide visible={showGuide} onClose={() => setShowGuide(false)} />
      </Screen>
    );
  }

  const volume = sessionVolume(active);
  const setCount = sessionSetCount(active);

  const onFinish = () => {
    if (setCount === 0) {
      Alert.alert('No sets logged', 'Complete at least one set before finishing.');
      return;
    }
    // diff achievements before/after rather than tracking an "unlocked" event
    // anywhere — this session isn't in `sessions` yet, so the after-state is
    // the current log plus the one about to be finished
    const before = computeAchievements(sessions, profile.daysPerWeek);
    const finished = finishSession();
    if (finished) {
      haptics.success();
      syncSession(finished);
      const allSessions = [...sessions, finished];
      syncStatsToSupabase(useWorkoutStore.getState().records, allSessions);
      const after = computeAchievements(allSessions, profile.daysPerWeek);
      setJustUnlocked(newlyUnlocked(before, after));
    }
  };

  const onDiscard = () => {
    Alert.alert('Discard workout?', 'This session will not be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { haptics.warning(); discard(); } },
    ]);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <TopInset />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {active.name}
            </Text>
            <Text style={styles.timer}>{elapsed(active.trainingStartedAt ?? null, now)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.helpButton, pressed && { opacity: 0.75 }]}
            onPress={() => setShowGuide(true)}
            hitSlop={6}
          >
            <Icon name="info" size={14} color={colors.accent} strokeWidth={2} />
            <Text style={styles.helpButtonText}>How to use</Text>
          </Pressable>
          <Button label="Finish" variant="success" size="sm" onPress={onFinish} style={{ paddingHorizontal: 20 }} />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{setCount}</Text>
            <Text style={styles.summaryLabel}>Sets</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(volume).toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Volume (kg)</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{active.entries.length}</Text>
            <Text style={styles.summaryLabel}>Exercises</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {active.entries.length === 0 && (
            <EmptyState title="No exercises yet" subtitle="Add your first exercise to start logging." />
          )}

          {active.entries.map((entry) => {
            const exercise = getExerciseById(entry.exerciseId);
            if (!exercise) return null;
            const previous = getPreviousSets(sessions, entry.exerciseId);
            const pr = records[entry.exerciseId];
            const suggestion = suggestNext(exercise, sessions, profile.goal, unit);
            const usesBar = exercise.equipment === 'barbell' || exercise.equipment === 'smith';

            return (
              <View key={entry.exerciseId} style={styles.exerciseBlock}>
                <View style={styles.exerciseHeader}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: entry.exerciseId })}
                  >
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                  </Pressable>
                  <View style={styles.exerciseActions}>
                    <InfoButton
                      onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: entry.exerciseId })}
                    />
                    <Pressable onPress={() => removeExercise(entry.exerciseId)} hitSlop={8}>
                      <Icon name="close" size={17} color={colors.textDim} strokeWidth={1.7} />
                    </Pressable>
                  </View>
                </View>

                {/* progression coaching line */}
                <View style={styles.suggestionRow}>
                  <Icon name="sparkle" size={12} color={colors.textFaint} strokeWidth={1.5} />
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </View>

                <View style={styles.tableHeader}>
                  <Text style={[styles.th, styles.colSet]}>SET</Text>
                  <Text style={[styles.th, styles.colPrev]}>PREVIOUS</Text>
                  <Text style={[styles.th, styles.colInput, styles.center]}>{unit.toUpperCase()}</Text>
                  <Text style={[styles.th, styles.colInput, styles.center]}>REPS</Text>
                  <Text style={[styles.th, styles.colRpe, styles.center]}>RPE</Text>
                  <View style={styles.colCheck} />
                </View>

                {entry.sets.map((s, idx) => {
                  const prev = previous?.[idx];
                  const isPr = !!pr && s.completed && estimate1RM(s.weightKg, s.reps) > pr.bestE1rm;
                  const workingIndex =
                    entry.sets.slice(0, idx + 1).filter((x) => !x.warmup).length;

                  return (
                    <View key={s.id} style={[styles.setRow, s.completed && styles.setRowDone]}>
                      {/* tap the set number to flag it as a warm-up */}
                      <Pressable
                        style={styles.colSet}
                        onPress={() => updateSet(entry.exerciseId, s.id, { warmup: !s.warmup })}
                        onLongPress={() => removeSet(entry.exerciseId, s.id)}
                      >
                        {s.warmup ? (
                          <Text style={styles.warmupTag}>W</Text>
                        ) : (
                          <Text style={styles.setNumber}>{workingIndex}</Text>
                        )}
                        {isPr && <Icon name="trophy" size={11} color={colors.bronze} strokeWidth={2} />}
                      </Pressable>

                      <Text style={[styles.prevText, styles.colPrev]} numberOfLines={1}>
                        {prev ? `${displayWeight(prev.weightKg, unit)}${unit} × ${prev.reps}` : '—'}
                      </Text>

                      <View style={styles.colInput}>
                        <TextInput
                          style={[styles.input, s.completed && styles.inputDone]}
                          keyboardType="decimal-pad"
                          placeholder={
                            prev
                              ? String(displayWeight(prev.weightKg, unit))
                              : String(displayWeight(suggestion.weightKg || 0, unit))
                          }
                          placeholderTextColor={colors.textFaint}
                          value={s.weightKg ? String(displayWeight(s.weightKg, unit)) : ''}
                          onChangeText={(t) =>
                            updateSet(entry.exerciseId, s.id, { weightKg: parseWeightInput(t, unit) })
                          }
                        />
                      </View>

                      <View style={styles.colInput}>
                        <TextInput
                          style={[styles.input, s.completed && styles.inputDone]}
                          keyboardType="number-pad"
                          placeholder={prev ? String(prev.reps) : String(suggestion.reps || 0)}
                          placeholderTextColor={colors.textFaint}
                          value={s.reps ? String(s.reps) : ''}
                          onChangeText={(t) =>
                            updateSet(entry.exerciseId, s.id, { reps: parseReps(t) })
                          }
                        />
                      </View>

                      <View style={styles.colRpe}>
                        <TextInput
                          style={[styles.input, styles.rpeInput, s.completed && styles.inputDone]}
                          keyboardType="decimal-pad"
                          placeholder="–"
                          placeholderTextColor={colors.textFaint}
                          value={s.rpe ? String(s.rpe) : ''}
                          onChangeText={(t) => {
                            const v = parseFloat(t);
                            updateSet(entry.exerciseId, s.id, {
                              rpe: Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : undefined,
                            });
                          }}
                        />
                      </View>

                      <Pressable
                        style={styles.colCheck}
                        onPress={() => {
                          (s.completed ? haptics.tap : haptics.setComplete)();
                          toggleSetComplete(entry.exerciseId, s.id);
                        }}
                        hitSlop={6}
                      >
                        <View style={[styles.checkbox, s.completed && styles.checkboxDone]}>
                          <Icon
                            name="check"
                            size={15}
                            color={s.completed ? colors.onAccent : colors.textFaint}
                            strokeWidth={2.4}
                          />
                        </View>
                      </Pressable>
                    </View>
                  );
                })}

                <View style={styles.exerciseFooter}>
                  <Pressable style={styles.addSetBtn} onPress={() => addSet(entry.exerciseId)}>
                    <Text style={styles.addSetText}>+ Add Set</Text>
                  </Pressable>
                  {usesBar && (
                    <Pressable
                      style={styles.plateBtn}
                      onPress={() => {
                        const heaviest = Math.max(
                          0,
                          ...entry.sets.map((x) => x.weightKg),
                          suggestion.weightKg
                        );
                        setPlateTarget(heaviest || profile.barKg);
                      }}
                    >
                      <Icon name="plates" size={16} color={colors.textSecondary} strokeWidth={1.6} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          <Button
            label="+ Add Exercise"
            variant="secondary"
            onPress={() => navigation.navigate('ExerciseLibrary', { picker: true })}
            style={{ marginTop: spacing.lg }}
          />
          <Button
            label="Save as Routine"
            variant="success"
            onPress={() => navigation.navigate('SaveRoutine')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Discard Workout"
            variant="danger"
            onPress={onDiscard}
            style={{ marginTop: spacing.sm }}
          />
          <BottomInset extra={spacing.xxl} />
        </ScrollView>

        <RestTimer />
      </KeyboardAvoidingView>

      <PlateCalculator
        visible={plateTarget !== null}
        targetKg={plateTarget ?? 0}
        onClose={() => setPlateTarget(null)}
      />
      <WorkoutGuide visible={showGuide} onClose={() => setShowGuide(false)} />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyHeaderTitle: { ...typography.hero, color: c.text },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.accent,
  },
  helpButtonText: { ...typography.caption, color: c.accent, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: { ...typography.h1, color: c.text },
  timer: { ...typography.caption, color: c.textDim, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  summaryItem: { flex: 1 },
  summaryValue: { ...typography.h2, color: c.text },
  summaryLabel: { ...typography.caption, color: c.textDim },
  content: { padding: spacing.lg },
  sectionLabel: { ...typography.micro, color: c.textFaint, marginBottom: spacing.md },
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.4)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  unlockTitle: { ...typography.bodyMedium, color: c.text },
  unlockDetail: { ...typography.caption, color: c.bronze, marginTop: 2 },
  planNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  planNudgeTitle: { ...typography.bodyMedium, color: c.text },
  planNudgeDetail: { ...typography.caption, color: c.textDim, marginTop: 2 },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  routineName: { ...typography.bodyMedium, color: c.text },
  routineMeta: { ...typography.caption, color: c.textDim, marginTop: 2 },
  planGroupName: { ...typography.caption, color: c.bronze, marginBottom: spacing.xs, marginLeft: 2 },
  exerciseBlock: { marginBottom: spacing.xl },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exerciseName: { ...typography.h3, color: c.text },
  exerciseActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  suggestionText: { ...typography.caption, color: c.textDim, flex: 1 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
  th: { ...typography.micro, color: c.textDim, fontSize: 10 },
  center: { textAlign: 'center' },
  colSet: { width: 34, flexDirection: 'row', alignItems: 'center', gap: 3 },
  colPrev: { flex: 1 },
  colInput: { width: 54 },
  colRpe: { width: 38 },
  colCheck: { width: 36, alignItems: 'flex-end' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderRadius: radius.sm, gap: 4 },
  setRowDone: { backgroundColor: 'rgba(255,255,255,0.03)' },
  setNumber: { ...typography.bodyMedium, color: c.textSecondary },
  warmupTag: { ...typography.captionBold, color: c.textFaint },
  prevText: { ...typography.caption, color: c.textFaint },
  input: {
    backgroundColor: c.cardAlt,
    borderRadius: radius.sm,
    color: c.text,
    paddingVertical: 8,
    textAlign: 'center',
    ...typography.bodyMedium,
  },
  rpeInput: { fontSize: 13 },
  inputDone: { backgroundColor: 'transparent' },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: c.bronze },
  exerciseFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  addSetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
  },
  addSetText: { ...typography.caption, color: c.textSecondary, fontWeight: '600' },
  plateBtn: {
    width: 44,
    borderRadius: radius.sm,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
