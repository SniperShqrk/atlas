import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Card, Button, InfoButton } from '@/components/ui';
import { ScreenLayout, ModalHeader } from '@/components/ScreenLayout';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { useEntitlements } from '@/store/entitlements';
import { EXERCISES, getExerciseById, MUSCLE_LABELS, Exercise } from '@/data/exercises';
import { filterExercises } from '@/data/exerciseRelations';
import { haptics } from '@/lib/haptics';
import { useCoach } from '@/store/coach';

/** Bounding box in screen (page) coordinates, from measureInWindow. */
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LONG_PRESS_MS = 280;

/**
 * One row in the embedded library. The PanResponder (built per-row by
 * makeRowResponder, below) owns the drag gesture; a plain onPress alongside
 * it is the non-drag fallback.
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

/**
 * A plan, open — pushed from the Plan tab's chooser, with a real back button.
 *
 * This used to be a conditional block on the Plan tab itself: opening a plan
 * hid every "start something new" section underneath it with no way back
 * except an undiscoverable swipe gesture. Now it's its own screen; the Plan
 * tab always shows the chooser underneath, and this is one tap away from it
 * in either direction.
 */
export default function PlanDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const currentPlan = useWorkoutStore((s) => s.currentPlan);
  const savedPlans = useWorkoutStore((s) => s.savedPlans);
  const savePlan = useWorkoutStore((s) => s.savePlan);
  const deleteSavedPlan = useWorkoutStore((s) => s.deleteSavedPlan);
  const startSession = useWorkoutStore((s) => s.startSession);
  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const updatePlanExercise = useWorkoutStore((s) => s.updatePlanExercise);
  const removePlanExercise = useWorkoutStore((s) => s.removePlanExercise);
  const removePlanDay = useWorkoutStore((s) => s.removePlanDay);
  const addPlanDay = useWorkoutStore((s) => s.addPlanDay);
  const addExerciseToPlanDay = useWorkoutStore((s) => s.addExerciseToPlanDay);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const profile = useWorkoutStore((s) => s.profile);
  const isPro = useEntitlements((s) => s.isPro);
  const recordPaywallView = useEntitlements((s) => s.recordPaywallView);
  const openCoach = useCoach((s) => s.openCoach);

  // "Build it yourself" and "Start from a program" both land here straight
  // into edit mode — a brand-new blank plan or freshly-loaded program has
  // nothing to look at yet in view mode, so skipping straight to editing is
  // one less tap than making someone find and tap "Edit Plan" first.
  const [editing, setEditing] = useState(route.params?.editing === true);
  const [justSaved, setJustSaved] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');

  // ---- drag-and-drop: pick up a library row, drop it on a day card ----
  const [dragExercise, setDragExercise] = useState<Exercise | null>(null);
  const [dropTargetDay, setDropTargetDay] = useState<number | null>(null);
  const dragPos = useRef(new Animated.ValueXY()).current;
  const dayCardNodes = useRef<Record<number, any>>({});
  const dayCardBounds = useRef<Record<number, Bounds>>({});

  const onAskCoach = () => {
    if (!isPro) {
      recordPaywallView('ai_coach');
      navigation.navigate('Paywall', { feature: 'ai_coach' });
      return;
    }
    openCoach({ entryPoint: 'plan' });
  };

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

  /** One PanResponder factory per library row — long-press then drag,
   *  without pulling in react-native-gesture-handler for one interaction. */
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

  // A plan can vanish out from under this screen (deleted from My Plans on
  // the chooser in another tab session, or — in practice — never, since
  // deleting happens from here or from My Plans and both navigate away
  // immediately after). Guard anyway rather than crash on a null render.
  useEffect(() => {
    if (!currentPlan) navigation.goBack();
  }, [currentPlan]);
  if (!currentPlan) return null;

  const onSavePlan = () => {
    const label = `${profile.goal.replace('_', ' ')} · ${new Date(currentPlan.createdAt).toLocaleDateString()}`;
    savePlan(currentPlan.name ?? label);
    setEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const onDeletePlan = () => {
    Alert.alert('Delete this plan?', currentPlan.name ?? 'Untitled plan', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (isPlanSaved) deleteSavedPlan(currentPlan.id);
          useWorkoutStore.setState({ currentPlan: null });
          navigation.goBack();
        },
      },
    ]);
  };

  const startDay = (dayIndex: number) => {
    const day = currentPlan.days[dayIndex];
    if (!day || day.exercises.length === 0) return;
    startSession(`${day.label} · ${day.focus}`);
    day.exercises.forEach((ex) =>
      addExerciseToActive(ex.exerciseId, { targetSets: ex.targetSets, targetReps: ex.targetReps })
    );
    navigation.navigate('WorkoutTab');
  };

  return (
    <Screen>
      <ModalHeader title={currentPlan.name ?? 'Your Plan'} onBack={() => navigation.goBack()} />
      <ScreenLayout hasTabBar={false}>
        <Card>
          <Text style={styles.summary}>{currentPlan.summary}</Text>
          {/* Only shown when it adds information the summary above doesn't —
              a manually-built plan's summary already says "built by you",
              so a second note saying the same thing was a literal duplicate. */}
          {currentPlan.model && (
            <Text style={styles.modelNote}>Generated by {currentPlan.model}</Text>
          )}
          {currentPlan.source === 'rule_based' && (
            <Text style={styles.modelNote}>Built offline — the AI planner wasn't reachable.</Text>
          )}
          {currentPlan.source === 'imported' && (
            <Text style={styles.modelNote}>Imported from your own workout history.</Text>
          )}
        </Card>

        {justSaved && <Text style={styles.note}>Saved to My Plans.</Text>}

        <Button
          label={editing ? 'Done Editing' : 'Edit Plan'}
          variant="bronze"
          size="md"
          onPress={() => setEditing((e) => !e)}
          style={{ marginTop: spacing.md }}
        />

        <View style={styles.secondaryRow}>
          {isPro && (
            <Button
              label={isPlanSaved ? 'Update Saved Plan' : 'Save Plan'}
              variant="secondary"
              onPress={onSavePlan}
              style={{ flex: 1 }}
            />
          )}
          <Button
            label="Regenerate with AI"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={{ flex: 1 }}
          />
        </View>

        <Pressable onPress={onAskCoach} style={styles.askCoachRow}>
          <Icon name="info" size={15} color={colors.bronze} strokeWidth={1.7} />
          <Text style={styles.askCoachText}>Ask the coach to adjust this plan</Text>
        </Pressable>

        {currentPlan.days.map((day, i) => {
          const hasExercises = day.exercises.length > 0;
          const names = day.exercises.slice(0, 3).map((ex) => getExerciseById(ex.exerciseId)?.name).filter(Boolean);
          return (
            <View
              key={i}
              ref={(node) => {
                dayCardNodes.current[i] = node;
              }}
              style={[{ marginTop: spacing.xl }, editing && dropTargetDay === i && styles.dayCardDropActive]}
            >
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{day.label} · {day.focus}</Text>
                {editing ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert('Remove this day?', `${day.label} · ${day.focus}`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removePlanDay(i) },
                      ])
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.removeDayText}>Remove</Text>
                  </Pressable>
                ) : (
                  hasExercises && (
                    <Pressable onPress={() => startDay(i)} style={styles.startPill}>
                      <Text style={styles.startPillText}>START</Text>
                    </Pressable>
                  )
                )}
              </View>
              <Text style={styles.dayMeta}>
                {hasExercises
                  ? `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}${
                      day.estimatedMinutes ? ` · about ${day.estimatedMinutes} minutes` : ''
                    } · ${names.join(', ')}`
                  : 'Nothing here yet'}
              </Text>

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
                {/* Every empty day gets this, editing or not — a bare divider
                    with nothing in it and no path forward was the exact "I
                    can't exit" complaint, one level down. */}
                <Pressable
                  style={[styles.addExerciseRow, day.exercises.length > 0 && styles.exRowBorder]}
                  onPress={() => navigation.navigate('ExerciseLibrary', { picker: true, planDayIndex: i })}
                >
                  <Icon name="plus" size={16} color={colors.bronze} strokeWidth={1.9} />
                  <Text style={styles.addExerciseText}>
                    {hasExercises ? 'Add Exercise' : 'Add exercises to this day'}
                  </Text>
                </Pressable>
              </Card>
            </View>
          );
        })}

        {editing && (
          <Button
            label="Add Day"
            variant="secondary"
            onPress={addPlanDay}
            style={{ marginTop: spacing.xl }}
          />
        )}

        {/* Exercise library, embedded — the drag source for the builder
            above. Search narrows it since dragging is the point, not
            scrolling through 176 rows. Only shown while editing. */}
        {editing && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={styles.sectionTitle}>Exercise Library</Text>
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

        {/* Destructive, small, last, away from every primary action above. */}
        <Pressable onPress={onDeletePlan} style={styles.deleteRow} hitSlop={8}>
          <Text style={styles.deleteText}>Delete this plan</Text>
        </Pressable>
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
  summary: { ...typography.body, color: c.textSecondary, lineHeight: 22 },
  modelNote: { ...typography.caption, color: c.textFaint, marginTop: spacing.sm },
  note: { ...typography.caption, color: c.bronze, marginTop: spacing.md, lineHeight: 18 },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  askCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  askCoachText: { ...typography.captionBold, color: c.bronze },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { ...typography.h3, color: c.text },
  removeDayText: { ...typography.caption, color: c.danger, fontWeight: '600' },
  // A button-shaped pill, not a bare coloured word — the old bare "Start"
  // text used the same colour treatment a destructive link would get, on a
  // screen whose primary action is bronze.
  startPill: {
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.bronze,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  startPillText: { ...typography.captionBold, color: c.bronze, letterSpacing: 0.5 },
  dayMeta: { ...typography.caption, color: c.textDim, marginTop: 4, lineHeight: 17 },
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
  dayCardDropActive: {
    borderWidth: 1.5,
    borderColor: c.bronze,
    borderRadius: radius.lg,
    backgroundColor: c.bronzeSoft,
  },
  sectionTitle: { ...typography.h3, color: c.text },
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
  deleteRow: { alignSelf: 'center', marginTop: spacing.xxl, marginBottom: spacing.md, padding: spacing.sm },
  deleteText: { ...typography.caption, color: c.danger },
}));
