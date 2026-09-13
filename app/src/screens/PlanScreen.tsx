import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, Button, SectionHeader, EmptyState, Chip, InfoButton } from '@/components/ui';
import { ScreenLayout } from '@/components/ScreenLayout';
import { ProBadge } from '@/components/Pro';
import { Icon } from '@/components/Icon';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, SplitPreference } from '@/store/workoutStore';
import { useEntitlements } from '@/store/entitlements';
import {
  EXERCISES,
  getExerciseById,
  MUSCLE_LABELS,
  MuscleGroup,
  Exercise,
} from '@/data/exercises';
import { filterExercises } from '@/data/exerciseRelations';
import { PREBUILT_PROGRAMS } from '@/data/programs';
import { generatePlan } from '@/api/client';
import { haptics } from '@/lib/haptics';
import { useCoach } from '@/store/coach';

const PROGRAM_SOURCE_LABEL: Record<string, string> = {
  ai: 'AI generated',
  imported: 'Imported',
  preset: 'Program',
  rule_based: 'Offline generator',
};

/** Bounding box in screen (page) coordinates, from measureInWindow. */
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LONG_PRESS_MS = 280;

const SPLITS: { key: SplitPreference; label: string }[] = [
  { key: 'auto', label: 'Let it choose' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'upper_lower', label: 'Upper / Lower' },
  { key: 'push_pull_legs', label: 'Push Pull Legs' },
  { key: 'bro_split', label: 'Body Part Split' },
];

const SESSION_LENGTHS = [30, 45, 60, 75, 90];
const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

/** "Auto" (null) lets the backend pick a focus from recovery data rather
 *  than always defaulting to Push. */
const DAY_FOCUS_OPTIONS: (string | null)[] = [null, 'Push', 'Pull', 'Legs', 'Upper', 'Full Body'];

const EMPHASIS_OPTIONS: MuscleGroup[] = [
  'chest', 'lats', 'side_delts', 'rear_delts', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
];

/**
 * One row in the embedded library. The PanResponder (built per-row by
 * makeRowResponder, above) owns the drag gesture; a plain onPress alongside
 * it is the non-drag fallback — a quick tap just isn't part of the same
 * gesture the responder ever claims (it only claims on a held, then moved,
 * touch), so both can live on the same row without conflict.
 */
function LibraryDragRow({
  exercise,
  bordered,
  styles,
  responder,
}: {
  exercise: Exercise;
  bordered: boolean;
  styles: any;
  responder: ReturnType<typeof PanResponder.create>;
}) {
  return (
    <View style={[styles.libraryRow, bordered && styles.exRowBorder]} {...responder.panHandlers}>
      <ExerciseThumb exercise={exercise} />
      <View style={{ flex: 1 }}>
        <Text style={styles.exName} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={styles.exMuscles} numberOfLines={1}>
          {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}
        </Text>
      </View>
      <Text style={styles.dragHandle}>⠿</Text>
    </View>
  );
}

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
  const addExerciseToPlanDay = useWorkoutStore((s) => s.addExerciseToPlanDay);
  const loadPresetProgram = useWorkoutStore((s) => s.loadPresetProgram);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const isPro = useEntitlements((s) => s.isPro);
  const recordPaywallView = useEntitlements((s) => s.recordPaywallView);
  const openCoach = useCoach((s) => s.openCoach);

  const onAskCoach = () => {
    if (!isPro) {
      recordPaywallView('ai_coach');
      navigation.navigate('Paywall', { feature: 'ai_coach' });
      return;
    }
    openCoach({ entryPoint: 'plan' });
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');

  // ---- drag-and-drop: pick up a library row, drop it on a day card ----
  const [dragExercise, setDragExercise] = useState<Exercise | null>(null);
  const [dropTargetDay, setDropTargetDay] = useState<number | null>(null);
  const [planScope, setPlanScope] = useState<'week' | 'day'>('week');
  const [dayFocus, setDayFocus] = useState<string | null>(null);
  const dragPos = useRef(new Animated.ValueXY()).current;
  const dayCardNodes = useRef<Record<number, any>>({});
  const dayCardBounds = useRef<Record<number, Bounds>>({});

  const measureDayBounds = () => {
    Object.entries(dayCardNodes.current).forEach(([key, node]) => {
      if (!node?.measureInWindow) return;
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        dayCardBounds.current[Number(key)] = { x, y, width, height };
      });
    });
  };

  const hitTestDay = (pageX: number, pageY: number): number | null => {
    for (const [key, b] of Object.entries(dayCardBounds.current)) {
      if (pageX >= b.x && pageX <= b.x + b.width && pageY >= b.y && pageY <= b.y + b.height) {
        return Number(key);
      }
    }
    return null;
  };

  /** One PanResponder factory per library row. Claims nothing at touch-down
   *  (so the library list still scrolls normally) — it only starts arming a
   *  drag after LONG_PRESS_MS of holding still, via a ref flag checked in
   *  onMoveShouldSetPanResponderCapture. That's the standard technique for a
   *  "long-press then drag" gesture inside a ScrollView without pulling in
   *  react-native-gesture-handler for a single interaction. */
  const makeRowResponder = (exercise: Exercise) => {
    const ready = { current: false };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let origin = { x: 0, y: 0 };

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      ready.current = false;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        origin = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        clear();
        timer = setTimeout(() => {
          ready.current = true;
        }, LONG_PRESS_MS);
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        ready.current && Math.abs(g.dx) + Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        haptics.tapMedium();
        dragPos.setValue({ x: origin.x - 70, y: origin.y - 34 });
        setDragExercise(exercise);
        measureDayBounds();
      },
      onPanResponderMove: (evt, g) => {
        dragPos.setValue({ x: origin.x - 70 + g.dx, y: origin.y - 34 + g.dy });
        setDropTargetDay(hitTestDay(evt.nativeEvent.pageX, evt.nativeEvent.pageY));
      },
      onPanResponderRelease: (evt) => {
        const hit = hitTestDay(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (ready.current && hit != null) {
          haptics.success();
          addExerciseToPlanDay(hit, exercise.id);
        } else if (ready.current) {
          haptics.tap();
        }
        clear();
        setDragExercise(null);
        setDropTargetDay(null);
      },
      onPanResponderTerminate: () => {
        clear();
        setDragExercise(null);
        setDropTargetDay(null);
      },
      onPanResponderTerminationRequest: () => true,
    });
  };

  const allExercises = useMemo(
    () => (customExercises.length ? [...EXERCISES, ...customExercises] : EXERCISES),
    [customExercises]
  );
  const libraryResults = useMemo(
    () =>
      editing
        ? filterExercises(allExercises, { query: libraryQuery }, MUSCLE_LABELS, {}).slice(0, 40)
        : [],
    [editing, allExercises, libraryQuery]
  );

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
      const plan = await generatePlan(profile, recent, {
        scope: planScope,
        focus: planScope === 'day' ? dayFocus : undefined,
      });
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
            {/* Plan the whole week, or just today — before this, the planner
                only ever wrote a full week, which meant asking it for "just
                today's session" meant regenerating (and losing) the rest of
                an otherwise-fine week. */}
            <View style={styles.chipRow}>
              <Chip label="Plan the Week" active={planScope === 'week'} onPress={() => setPlanScope('week')} />
              <Chip label="Plan 1 Day" active={planScope === 'day'} onPress={() => setPlanScope('day')} />
            </View>

            {planScope === 'day' && (
              <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
                {DAY_FOCUS_OPTIONS.map((f) => (
                  <Chip
                    key={f ?? 'auto'}
                    label={f ?? 'Auto'}
                    active={dayFocus === f}
                    onPress={() => setDayFocus(f)}
                  />
                ))}
              </View>
            )}

            <Button
              label={
                loading
                  ? planScope === 'day'
                    ? 'Building your session…'
                    : 'Building your week…'
                  : currentPlan
                  ? 'Regenerate Plan'
                  : planScope === 'day'
                  ? 'Generate Day'
                  : 'Generate Plan'
              }
              onPress={onGenerate}
              loading={loading}
              size="lg"
              style={{ marginTop: spacing.lg }}
            />
            <Button
              label="Import Workout"
              variant="secondary"
              onPress={() => navigation.navigate('ImportWorkout')}
              style={{ marginTop: spacing.sm }}
            />
            {currentPlan && (
              <Pressable onPress={onAskCoach} style={styles.askCoachRow}>
                <Icon name="info" size={15} color={colors.bronze} strokeWidth={1.7} />
                <Text style={styles.askCoachText}>Ask the coach to adjust this plan</Text>
              </Pressable>
            )}
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
                      {p.days.length} days · {PROGRAM_SOURCE_LABEL[p.source] ?? 'Offline generator'}
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

        {/* Ready-made programs — free, no generator required. Loading one just
            opens it as a normal, editable plan, same as anything the AI
            writes or you import. */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Quick-Start Programs" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.programRow}
            style={{ marginTop: spacing.sm }}
          >
            {PREBUILT_PROGRAMS.map((program) => (
              <Pressable
                key={program.name}
                style={styles.programCard}
                onPress={() => {
                  haptics.tap();
                  loadPresetProgram(program);
                  setEditing(false);
                }}
              >
                <Text style={styles.programCardName}>{program.name}</Text>
                <Text style={styles.programCardMeta}>{program.days.length}-day split</Text>
                <Text style={styles.programCardSummary} numberOfLines={3}>
                  {program.summary}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

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
              <View
                key={i}
                ref={(node) => {
                  dayCardNodes.current[i] = node;
                }}
                style={[{ marginTop: spacing.xl }, editing && dropTargetDay === i && styles.dayCardDropActive]}
              >
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

        {/* Exercise library, moved here from its own screen — this is the
            drag source for the builder above. Search narrows it since
            dragging is the point, not scrolling through 176 rows. Only shown
            while editing: it has nothing to do once there's no day to drop
            an exercise onto. */}
        {editing && currentPlan && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Exercise Library" />
            <Text style={styles.libraryHint}>
              Long-press an exercise, then drag it onto a day above to add it there.
            </Text>
            <View style={styles.librarySearchWrap}>
              <Icon name="search" size={16} color={colors.textDim} strokeWidth={1.6} />
              <TextInput
                style={styles.librarySearch}
                placeholder="Search exercise, muscle or equipment"
                placeholderTextColor={colors.textFaint}
                value={libraryQuery}
                onChangeText={setLibraryQuery}
                autoCorrect={false}
              />
              {libraryQuery.length > 0 && (
                <Pressable onPress={() => setLibraryQuery('')} hitSlop={8}>
                  <Icon name="close" size={14} color={colors.textDim} strokeWidth={1.7} />
                </Pressable>
              )}
            </View>
            <Card style={{ padding: 0, marginTop: spacing.sm }}>
              {libraryResults.length === 0 && (
                <Text style={styles.libraryEmpty}>
                  {libraryQuery ? 'No matches.' : 'Type to search the exercise library.'}
                </Text>
              )}
              {libraryResults.map((exercise, idx) => (
                <LibraryDragRow
                  key={exercise.id}
                  exercise={exercise}
                  bordered={idx > 0}
                  styles={styles}
                  responder={makeRowResponder(exercise)}
                />
              ))}
            </Card>
          </View>
        )}
      </ScreenLayout>

      {dragExercise && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragGhost,
            { transform: [{ translateX: dragPos.x }, { translateY: dragPos.y }] },
          ]}
        >
          <Text style={styles.dragGhostText} numberOfLines={1}>
            {dragExercise.name}
          </Text>
        </Animated.View>
      )}
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
  askCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  askCoachText: { ...typography.captionBold, color: c.bronze },
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
  programRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  programCard: {
    width: 220,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  programCardName: { ...typography.h3, color: c.text },
  programCardMeta: { ...typography.caption, color: c.bronze, marginTop: 2, fontWeight: '600' },
  programCardSummary: { ...typography.caption, color: c.textDim, marginTop: spacing.sm, lineHeight: 17 },
  dayCardDropActive: {
    borderWidth: 1.5,
    borderColor: c.bronze,
    borderRadius: radius.lg,
    backgroundColor: c.bronzeSoft,
  },
  libraryHint: { ...typography.caption, color: c.textDim, marginTop: spacing.sm, lineHeight: 17 },
  librarySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
  },
  librarySearch: { flex: 1, color: c.text, paddingVertical: 10, ...typography.body },
  libraryEmpty: {
    ...typography.caption,
    color: c.textFaint,
    padding: spacing.lg,
    textAlign: 'center',
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dragHandle: { color: c.textFaint, fontSize: 16 },
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: c.bronze,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dragGhostText: { ...typography.bodyMedium, color: c.onAccent, fontWeight: '700' },
}));
