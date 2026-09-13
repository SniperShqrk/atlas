import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  PanResponder,
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
import { substitutionsFor, Substitution } from '@/data/exerciseRelations';
import { syncSession } from '@/api/client';
import { syncStatsToSupabase } from '@/lib/socialSync';
import { syncSessionToSupabase } from '@/lib/dataSync';
import { promptStartWorkout } from '@/lib/startWorkoutFlow';
import { quoteByTheme } from '@/data/quotes';
import { StoicQuote } from '@/components/StoicQuote';
import { computeAchievements, newlyUnlocked } from '@/data/achievements';
import { prTimeline } from '@/store/analytics';
import { displayWeight, parseWeightInput, parseReps } from '@/utils/units';
import { useEntitlements } from '@/store/entitlements';
import { useCoach } from '@/store/coach';

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

/**
 * Weight and RPE are both free-decimal fields whose committed value lives in
 * the store as a number, and both used to bind the TextInput's `value`
 * straight to that number. That re-renders the field from the parsed number
 * on every keystroke, so typing a bare "." before any digit follows it gets
 * wiped on the very next render — parseFloat("102.") is 102, so the field
 * snaps back to "102" and there's nowhere for a decimal to land. That reads
 * as "decimals aren't accepted".
 *
 * Buffering the raw typed text locally and only parsing/committing on blur
 * fixes it — the same pattern already used for the height field in
 * ProfileScreen.tsx. `committed` only overwrites the buffer when it changed
 * for a reason other than this field's own typing (a unit toggle, mainly).
 */
function DecimalInput({
  committed,
  parse,
  format,
  onCommit,
  style,
  placeholder,
  placeholderTextColor,
}: {
  committed: number | undefined;
  parse: (text: string) => number | undefined;
  format: (n: number | undefined) => string;
  onCommit: (n: number | undefined) => void;
  style: any;
  placeholder: string;
  placeholderTextColor: string;
}) {
  const displayValue = format(committed);
  const [text, setText] = useState(displayValue);
  const lastExternal = useRef(displayValue);

  useEffect(() => {
    if (displayValue !== lastExternal.current) {
      setText(displayValue);
      lastExternal.current = displayValue;
    }
  }, [displayValue]);

  return (
    <TextInput
      style={style}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ''))}
      onEndEditing={() => {
        const n = parse(text);
        onCommit(n);
        const normalized = format(n);
        setText(normalized);
        lastExternal.current = normalized;
      }}
    />
  );
}

/**
 * Compact +/- stepper wrapped around the weight input, in fixed 0.5kg
 * increments regardless of display unit (kg is the unit the user actually
 * loads plates in). A tap steps once; holding either button auto-repeats
 * after a short delay, like a native stepper.
 *
 * This owns its own text buffer rather than delegating to the generic
 * DecimalInput — the +/- buttons need to read whatever is CURRENTLY typed,
 * not the last value committed to the store. DecimalInput only commits on
 * blur, so typing "100" and immediately tapping "+" without the field losing
 * focus used to read `committed` (still 0, or whatever it was before you
 * started typing), step from that, and silently discard the "100" you'd just
 * typed — the bug where a tap after typing produced 0.5 instead of 100.5.
 */
function WeightStepper({
  committed,
  isBodyweight,
  unit,
  placeholderKg,
  onChange,
  done,
  styles,
  colors,
}: {
  committed: number;
  isBodyweight: boolean;
  unit: 'kg' | 'lb';
  placeholderKg: number;
  onChange: (kg: number) => void;
  done: boolean;
  styles: any;
  colors: any;
}) {
  const STEP_KG = 0.5;
  const repeatDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const format = (kg: number | undefined) => (kg ? String(displayWeight(kg, unit)) : '');
  const [text, setText] = useState(format(committed || undefined));
  const lastExternal = useRef(format(committed || undefined));

  useEffect(() => {
    const formatted = format(committed || undefined);
    if (formatted !== lastExternal.current) {
      setText(formatted);
      lastExternal.current = formatted;
    }
    // unit is a dependency too — toggling kg/lb needs to reformat the same
    // committed weight in the new unit even though `committed` itself didn't change.
  }, [committed, unit]);

  const commit = (kg: number) => {
    onChange(kg);
    const formatted = format(kg || undefined);
    setText(formatted);
    lastExternal.current = formatted;
  };

  // The base for a step is whatever is on screen right now, typed or not —
  // never the possibly-stale `committed` prop.
  const currentKg = () => {
    const parsed = parseWeightInput(text, unit);
    return parsed !== undefined ? parsed : committed || 0;
  };

  const step = (dir: 1 | -1) => {
    haptics.tapMedium();
    const base = currentKg();
    const next = Math.max(0, Math.round((base + dir * STEP_KG) * 2) / 2);
    commit(next);
  };

  const stopRepeat = () => {
    if (repeatDelay.current) clearTimeout(repeatDelay.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    repeatDelay.current = null;
    repeatTimer.current = null;
  };

  const startRepeat = (dir: 1 | -1) => {
    step(dir);
    repeatDelay.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => step(dir), 90);
    }, 350);
  };

  useEffect(() => stopRepeat, []);

  return (
    <View style={styles.stepperRow}>
      <Pressable
        style={styles.stepperBtn}
        onPressIn={() => startRepeat(-1)}
        onPressOut={stopRepeat}
        hitSlop={4}
      >
        <Text style={styles.stepperBtnText}>–</Text>
      </Pressable>
      <TextInput
        style={[styles.input, styles.stepperInput, done && styles.inputDone]}
        keyboardType="decimal-pad"
        placeholder={isBodyweight ? '–' : String(displayWeight(placeholderKg || 0, unit))}
        placeholderTextColor={colors.textFaint}
        value={text}
        onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ''))}
        onEndEditing={() => {
          const n = parseWeightInput(text, unit);
          commit(n ?? 0);
        }}
      />
      <Pressable
        style={styles.stepperBtn}
        onPressIn={() => startRepeat(1)}
        onPressOut={stopRepeat}
        hitSlop={4}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * One set row, as a real component rather than inline JSX inside a `.map` —
 * it needs its own PanResponder/Animated.Value per row, and hooks can't live
 * inside a loop body safely once sets are added/removed.
 *
 * Swipe right to complete, swipe left to undo — replaces the old tap-target
 * checkbox with a full-width gesture and a strong, distinctive haptic
 * (haptics.setComplete, now Heavy) so completing a set is felt without
 * looking at the phone.
 */
function SetRow({
  exercise,
  entry,
  s,
  workingIndex,
  prev,
  isPr,
  unit,
  suggestion,
  styles,
  colors,
  updateSet,
  removeSet,
  toggleSetComplete,
}: {
  exercise: ReturnType<typeof getExerciseById>;
  entry: { exerciseId: string };
  s: { id: string; weightKg: number; reps: number; rpe?: number; completed: boolean; warmup?: boolean };
  workingIndex: number;
  prev: { weightKg: number; reps: number } | undefined;
  isPr: boolean;
  unit: 'kg' | 'lb';
  suggestion: { weightKg: number; reps: number };
  styles: any;
  colors: any;
  updateSet: (exerciseId: string, setId: string, patch: any) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isBodyweight = exercise?.equipment === 'bodyweight';
  // Lowered from 72/10/1.5 — the old numbers made the gesture feel like it
  // wasn't registering unless the swipe was long and near-perfectly
  // horizontal. This is a full-width, single gesture with nothing else to
  // conflict with underneath it, so there's no reason to make it that strict.
  const SWIPE_THRESHOLD = 52;
  const MAX_SWIPE = 96;
  // panResponder closes over `s.completed` via a ref so release logic always
  // sees the latest value without having to recreate the responder per render
  const completedRef = useRef(s.completed);
  completedRef.current = s.completed;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
      onPanResponderMove: (_evt, g) => {
        const dx = completedRef.current ? Math.min(0, g.dx) : Math.max(0, g.dx);
        translateX.setValue(Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx)));
      },
      onPanResponderRelease: (_evt, g) => {
        const crossed = completedRef.current
          ? g.dx < -SWIPE_THRESHOLD
          : g.dx > SWIPE_THRESHOLD;
        if (crossed) {
          (completedRef.current ? haptics.tap : haptics.setComplete)();
          toggleSetComplete(entry.exerciseId, s.id);
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
    })
  ).current;

  return (
    <View style={styles.setRowWrap}>
      <View
        style={[
          styles.swipeBackdrop,
          { backgroundColor: s.completed ? colors.cardAlt : colors.bronzeSoft },
        ]}
        pointerEvents="none"
      >
        {!s.completed && (
          <View style={styles.swipeHintLeft}>
            <Text style={[styles.swipeArrow, { color: colors.bronze }]}>→</Text>
            <Text style={[styles.swipeHintText, { color: colors.bronze }]}>SWIPE TO COMPLETE</Text>
          </View>
        )}
        {s.completed && (
          <View style={styles.swipeHintRight}>
            <Text style={[styles.swipeHintText, { color: colors.textFaint }]}>SWIPE TO UNDO</Text>
            <Text style={[styles.swipeArrow, { color: colors.textFaint }]}>←</Text>
          </View>
        )}
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.setRow, s.completed && styles.setRowDone, { transform: [{ translateX }] }]}
      >
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

        <View style={styles.colWeight}>
          <WeightStepper
            committed={s.weightKg}
            isBodyweight={isBodyweight}
            unit={unit}
            placeholderKg={prev?.weightKg ?? suggestion.weightKg ?? 0}
            onChange={(kg) => updateSet(entry.exerciseId, s.id, { weightKg: kg })}
            done={s.completed}
            styles={styles}
            colors={colors}
          />
        </View>

        <View style={styles.colInput}>
          <TextInput
            style={[styles.input, s.completed && styles.inputDone]}
            keyboardType="number-pad"
            placeholder={prev ? String(prev.reps) : String(suggestion.reps || 0)}
            placeholderTextColor={colors.textFaint}
            value={s.reps ? String(s.reps) : ''}
            onChangeText={(t) => updateSet(entry.exerciseId, s.id, { reps: parseReps(t) })}
          />
        </View>

        <View style={styles.colRpe}>
          <DecimalInput
            style={[styles.input, styles.rpeInput, s.completed && styles.inputDone]}
            placeholder="–"
            placeholderTextColor={colors.textFaint}
            committed={s.rpe}
            parse={(t) => {
              const v = parseFloat(t);
              return Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : undefined;
            }}
            format={(v) => (v ? String(v) : '')}
            onCommit={(v) => updateSet(entry.exerciseId, s.id, { rpe: v })}
          />
        </View>
      </Animated.View>
    </View>
  );
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
  const swapExerciseInActive = useWorkoutStore((s) => s.swapExerciseInActive);
  const finishSession = useWorkoutStore((s) => s.finishSession);
  const discard = useWorkoutStore((s) => s.discardActiveSession);
  const isPro = useEntitlements((s) => s.isPro);
  const recordPaywallView = useEntitlements((s) => s.recordPaywallView);
  const openCoach = useCoach((s) => s.openCoach);

  const onAskCoach = (exerciseId: string) => {
    if (!isPro) {
      recordPaywallView('ai_coach');
      navigation.navigate('Paywall', { feature: 'ai_coach' });
      return;
    }
    // Best-effort: only meaningful if this exercise is actually part of the
    // saved plan (it usually is, since sessions are normally started from
    // one) — the coach still works fine without a day index, just with a
    // little less to point at.
    const dayIndex = currentPlan?.days.findIndex((d) =>
      d.exercises.some((e) => e.exerciseId === exerciseId)
    );
    openCoach({
      entryPoint: 'exercise',
      seed: { exerciseId, dayIndex: dayIndex != null && dayIndex >= 0 ? dayIndex : null },
    });
  };

  const [now, setNow] = useState(Date.now());
  const [plateTarget, setPlateTarget] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  // exerciseId currently showing its swap-alternatives strip, or null
  const [swapFor, setSwapFor] = useState<string | null>(null);

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

  /** The empty-state CTA used to jump straight to an empty session, which
   *  buried the routines/plans lists already sitting right below it as the
   *  more useful default for anyone who has one. Now it asks first — unless
   *  there's genuinely nothing to choose from yet, in which case asking would
   *  just be a pointless extra tap. */
  const onStartWorkoutPress = () => {
    promptStartWorkout({
      hasPlanOrRoutines: routines.length > 0 || savedPlans.length > 0 || !!currentPlan,
      startSession,
      onCreatePlan: () => navigation.navigate('PlanTab'),
    });
  };

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
          <Button label="Start Workout" size="lg" onPress={onStartWorkoutPress} />

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
    const achievementOpts = { bodyweightKg: profile.weightKg, gender: profile.gender };
    const before = computeAchievements(sessions, profile.daysPerWeek, achievementOpts);
    const finished = finishSession();
    if (finished) {
      haptics.success();
      syncSession(finished);
      syncSessionToSupabase(finished);
      const allSessions = [...sessions, finished];
      syncStatsToSupabase(useWorkoutStore.getState().records, allSessions);
      const after = computeAchievements(allSessions, profile.daysPerWeek, achievementOpts);
      const justUnlocked = newlyUnlocked(before, after);
      // real PRs only — a genuinely new best e1RM logged in the set that was
      // just finished, not the whole history's records
      const prEvents = prTimeline(allSessions).filter((e) => e.at === finished.completedAt);
      navigation.navigate('PostWorkoutSummary', { session: finished, prEvents, justUnlocked });
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
            const swapCandidates: Substitution[] | null =
              swapFor === entry.exerciseId
                ? substitutionsFor(exercise, { allowed: profile.equipment, limit: 6 })
                : null;

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
                    <Pressable
                      style={styles.swapBtn}
                      onPress={() => {
                        haptics.tap();
                        setSwapFor(swapFor === entry.exerciseId ? null : entry.exerciseId);
                      }}
                      hitSlop={6}
                    >
                      <Text style={styles.swapBtnText}>Swap</Text>
                    </Pressable>
                    <Pressable
                      style={styles.swapBtn}
                      onPress={() => {
                        haptics.tap();
                        onAskCoach(entry.exerciseId);
                      }}
                      hitSlop={6}
                    >
                      <Text style={styles.swapBtnText}>Coach</Text>
                    </Pressable>
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

                {swapCandidates && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.swapRow}
                    style={styles.swapScroll}
                  >
                    {swapCandidates.length === 0 && (
                      <Text style={styles.swapEmpty}>No close substitutes with your equipment</Text>
                    )}
                    {swapCandidates.map((cand) => (
                      <Pressable
                        key={cand.exercise.id}
                        style={styles.swapCard}
                        onPress={() => {
                          haptics.select();
                          swapExerciseInActive(entry.exerciseId, cand.exercise.id);
                          setSwapFor(null);
                        }}
                      >
                        <Text style={styles.swapCardName} numberOfLines={2}>
                          {cand.exercise.name}
                        </Text>
                        <Text style={styles.swapCardReason} numberOfLines={1}>
                          {cand.reason}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.tableHeader}>
                  <Text style={[styles.th, styles.colSet]}>SET</Text>
                  <Text style={[styles.th, styles.colPrev]}>PREVIOUS</Text>
                  <Text style={[styles.th, styles.colWeight, styles.center]}>{unit.toUpperCase()}</Text>
                  <Text style={[styles.th, styles.colInput, styles.center]}>REPS</Text>
                  <Text style={[styles.th, styles.colRpe, styles.center]}>RPE</Text>
                </View>

                {entry.sets.map((s, idx) => {
                  const prev = previous?.[idx];
                  const isPr = !!pr && s.completed && estimate1RM(s.weightKg, s.reps) > pr.bestE1rm;
                  const workingIndex =
                    entry.sets.slice(0, idx + 1).filter((x) => !x.warmup).length;

                  return (
                    <SetRow
                      key={s.id}
                      exercise={exercise}
                      entry={entry}
                      s={s}
                      workingIndex={workingIndex}
                      prev={prev}
                      isPr={isPr}
                      unit={unit}
                      suggestion={suggestion}
                      styles={styles}
                      colors={colors}
                      updateSet={updateSet}
                      removeSet={removeSet}
                      toggleSetComplete={toggleSetComplete}
                    />
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
  colWeight: { width: 104, flexDirection: 'row', alignItems: 'center', gap: 2 },
  colRpe: { width: 38 },
  setRowWrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: 3,
  },
  swipeBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeHintLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: spacing.md,
  },
  swipeHintRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingRight: spacing.md,
  },
  swipeArrow: { fontSize: 16, fontWeight: '700' },
  swipeHintText: { ...typography.micro, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // taller than before (5 -> 11) — a bigger swipe target, and more room
    // for the "SWIPE TO COMPLETE" hint text to sit comfortably underneath
    paddingVertical: 11,
    borderRadius: radius.sm,
    gap: 4,
    backgroundColor: c.bg,
  },
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
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  stepperBtn: {
    width: 22,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { ...typography.bodyMedium, color: c.textSecondary, fontWeight: '700' },
  stepperInput: { flex: 1, minWidth: 50 },
  rpeInput: { fontSize: 13 },
  inputDone: { backgroundColor: 'transparent' },
  swapBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
  },
  swapBtnText: { ...typography.caption, color: c.textSecondary, fontWeight: '600' },
  swapScroll: { marginBottom: spacing.sm },
  swapRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  swapCard: {
    width: 140,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  swapCardName: { ...typography.bodyMedium, color: c.text },
  swapCardReason: { ...typography.caption, color: c.textDim, marginTop: 4 },
  swapEmpty: { ...typography.caption, color: c.textFaint, paddingVertical: spacing.sm },
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
