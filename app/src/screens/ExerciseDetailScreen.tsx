import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Card, Chip, Button, Divider } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { BodyMap } from '@/components/BodyMap';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { getExerciseById, MUSCLE_LABELS, EQUIPMENT_LABELS, CATEGORY_LABELS, ALL_EQUIPMENT } from '@/data/exercises';
import {
  commonMistakesFor,
  patternInfoFor,
  substitutionsFor,
  variationsOf,
} from '@/data/exerciseRelations';
import { useWorkoutStore, getPreviousSets, estimate1RM } from '@/store/workoutStore';
import { displayWeight } from '@/utils/units';

export default function ExerciseDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const exerciseId: string = route.params?.exerciseId;
  const exercise = getExerciseById(exerciseId);

  const sessions = useWorkoutStore((s) => s.sessions);
  const profile = useWorkoutStore((s) => s.profile);
  const unit = profile.unit;
  const records = useWorkoutStore((s) => s.records);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const startSession = useWorkoutStore((s) => s.startSession);
  const deleteCustomExercise = useWorkoutStore((s) => s.deleteCustomExercise);
  const addRecentlyViewed = useWorkoutStore((s) => s.addRecentlyViewed);

  useEffect(() => {
    if (exercise) addRecentlyViewed(exercise.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  if (!exercise) {
    return (
      <Screen>
        <ModalHeader onBack={() => navigation.goBack()} />
        <Text style={styles.title}>Exercise not found</Text>
      </Screen>
    );
  }

  const previous = getPreviousSets(sessions, exercise.id);
  const pr = records[exercise.id];

  const pattern = patternInfoFor(exercise);
  const mistakes = commonMistakesFor(exercise);
  const variations = variationsOf(exercise, 5);
  // substitutions respect what the user actually has access to, which is the
  // difference between a list of alternatives and a useful one
  const substitutions = substitutionsFor(exercise, {
    allowed: profile.equipment,
  });

  const openExercise = (id: string) =>
    navigation.push('ExerciseDetail', { exerciseId: id });

  const onAdd = () => {
    if (!activeSession) startSession();
    addExerciseToActive(exercise.id);
    navigation.navigate('WorkoutTab');
  };

  const onDelete = () => {
    Alert.alert('Delete custom exercise?', exercise.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCustomExercise(exercise.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ModalHeader onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{exercise.name}</Text>
          <View style={styles.tagRow}>
            {exercise.isCustom && <Chip label="Custom" />}
            <Chip label={CATEGORY_LABELS[exercise.category]} />
            <Chip label={EQUIPMENT_LABELS[exercise.equipment]} />
            <Chip label={exercise.mechanic} />
            <Chip label={exercise.difficulty} />
            <Chip label={pattern.label} />
          </View>
          <Text style={styles.patternSummary}>{pattern.summary}</Text>

          {/* muscles worked — the anatomy diagram */}
          <Card style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Text style={styles.cardTitle}>MUSCLES WORKED</Text>
            <View style={styles.diagramRow}>
              <View style={styles.diagramCol}>
                <BodyMap
                  mode="target"
                  view="front"
                  primary={exercise.primaryMuscles}
                  secondary={exercise.secondaryMuscles}
                  size={130}
                />
                <Text style={styles.diagramLabel}>FRONT</Text>
              </View>
              <View style={styles.diagramCol}>
                <BodyMap
                  mode="target"
                  view="back"
                  primary={exercise.primaryMuscles}
                  secondary={exercise.secondaryMuscles}
                  size={130}
                />
                <Text style={styles.diagramLabel}>BACK</Text>
              </View>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: colors.targetPrimary }]} />
                <Text style={styles.legendText}>Primary</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: colors.targetSecondary }]} />
                <Text style={styles.legendText}>Secondary</Text>
              </View>
            </View>

            <Divider style={{ alignSelf: 'stretch', marginVertical: spacing.md }} />

            <View style={styles.muscleLists}>
              <View style={styles.muscleCol}>
                <Text style={styles.muscleHeading}>PRIMARY</Text>
                {exercise.primaryMuscles.map((m) => (
                  <Text key={m} style={[styles.muscleItem, { color: colors.targetPrimary }]}>
                    {MUSCLE_LABELS[m]}
                  </Text>
                ))}
              </View>
              <View style={styles.muscleCol}>
                <Text style={styles.muscleHeading}>SECONDARY</Text>
                {exercise.secondaryMuscles.length === 0 ? (
                  <Text style={styles.muscleItem}>—</Text>
                ) : (
                  exercise.secondaryMuscles.map((m) => (
                    <Text key={m} style={[styles.muscleItem, { color: colors.targetSecondary }]}>
                      {MUSCLE_LABELS[m]}
                    </Text>
                  ))
                )}
              </View>
            </View>
          </Card>

          {/* your numbers */}
          {(pr || previous) && (
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.cardTitle}>YOUR NUMBERS</Text>
              {pr && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Best set</Text>
                  <Text style={styles.statValue}>
                    {displayWeight(pr.bestWeightKg, unit)}{unit} × {pr.bestReps}{' '}
                    <Text style={styles.statSub}>
                      (e1RM {Math.round(displayWeight(pr.bestE1rm, unit))}{unit})
                    </Text>
                  </Text>
                </View>
              )}
              {previous && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Last session</Text>
                  <Text style={styles.statValue}>
                    {previous.map((s) => `${displayWeight(s.weightKg, unit)}×${s.reps}`).join(', ')}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* instructions */}
          {exercise.instructions.length > 0 && (
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.cardTitle}>HOW TO PERFORM</Text>
              {exercise.instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* tips */}
          {exercise.tips.length > 0 && (
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.cardTitle}>COACHING NOTES</Text>
              {exercise.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>▸</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* common mistakes — the thing people actually need and rarely get */}
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.cardTitle}>COMMON MISTAKES</Text>
            {mistakes.map((mistake, i) => (
              <View key={i} style={styles.mistakeRow}>
                <View style={styles.mistakeMark}>
                  <Text style={styles.mistakeMarkText}>✕</Text>
                </View>
                <Text style={styles.tipText}>{mistake}</Text>
              </View>
            ))}
            {exercise.mistakes && exercise.mistakes.length > 0 && (
              <Text style={styles.mistakeNote}>
                The first {exercise.mistakes.length} are specific to this lift; the rest apply to
                every {pattern.label.toLowerCase()}.
              </Text>
            )}
          </Card>

          {/* variations — the same movement, run differently */}
          {variations.length > 0 && (
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.cardTitle}>VARIATIONS</Text>
              <Text style={styles.sectionNote}>
                The same movement with a different implement or angle. Swapping between these keeps
                a stalled lift moving without changing what the session trains.
              </Text>
              {variations.map((v) => (
                <Pressable key={v.id} style={styles.linkRow} onPress={() => openExercise(v.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkTitle}>{v.name}</Text>
                    <Text style={styles.linkMeta}>
                      {EQUIPMENT_LABELS[v.equipment]} · {v.difficulty}
                    </Text>
                  </View>
                  <Icon name="chevron" size={16} color={colors.textFaint} strokeWidth={1.7} />
                </Pressable>
              ))}
            </Card>
          )}

          {/* substitutions — what to do when you cannot do this one */}
          {substitutions.length > 0 && (
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.cardTitle}>IF YOU CAN'T DO THIS ONE</Text>
              <Text style={styles.sectionNote}>
                Filtered to the equipment on your profile
                {profile.equipment.length >= ALL_EQUIPMENT.length - 1
                  ? ''
                  : ' — change it in Profile to see more'}.
              </Text>
              {substitutions.map((sub) => (
                <Pressable
                  key={sub.exercise.id}
                  style={styles.linkRow}
                  onPress={() => openExercise(sub.exercise.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkTitle}>{sub.exercise.name}</Text>
                    <Text style={styles.linkMeta}>{sub.reason}</Text>
                  </View>
                  <Icon name="chevron" size={16} color={colors.textFaint} strokeWidth={1.7} />
                </Pressable>
              ))}
            </Card>
          )}

          <Button label="Add to Workout" size="lg" onPress={onAdd} style={{ marginTop: spacing.xl }} />
          {exercise.isCustom && (
            <Button
              label="Delete Custom Exercise"
              variant="danger"
              size="lg"
              onPress={onDelete}
              style={{ marginTop: spacing.md }}
            />
          )}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  patternSummary: {
    ...typography.caption,
    color: c.textDim,
    marginTop: spacing.md,
    lineHeight: 19,
  },
  sectionNote: {
    ...typography.caption,
    color: c.textDim,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  mistakeRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  mistakeMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  mistakeMarkText: { color: c.accent, fontSize: 10, fontWeight: '700', lineHeight: 13 },
  mistakeNote: {
    ...typography.caption,
    color: c.textFaint,
    marginTop: spacing.md,
    fontSize: 11.5,
    lineHeight: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  linkTitle: { ...typography.bodyMedium, color: c.text, fontSize: 14.5 },
  linkMeta: { ...typography.caption, color: c.textFaint, marginTop: 2, textTransform: 'capitalize' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  back: { ...typography.bodyMedium, color: c.accent },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...typography.hero, color: c.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  cardTitle: { ...typography.micro, color: c.textDim, marginBottom: spacing.md },
  diagramRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  diagramCol: { alignItems: 'center' },
  diagramLabel: { ...typography.micro, color: c.textFaint, marginTop: 4 },
  legendRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { ...typography.caption, color: c.textSecondary },
  muscleLists: { flexDirection: 'row', alignSelf: 'stretch' },
  muscleCol: { flex: 1 },
  muscleHeading: { ...typography.micro, color: c.textDim, marginBottom: 6 },
  muscleItem: { ...typography.bodyMedium, color: c.textSecondary, marginBottom: 3 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { ...typography.body, color: c.textSecondary },
  statValue: { ...typography.bodyMedium, color: c.text },
  statSub: { ...typography.caption, color: c.textDim, fontWeight: '400' },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { ...typography.micro, color: c.accent },
  stepText: { ...typography.body, color: c.textSecondary, flex: 1, lineHeight: 21 },
  tipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tipBullet: { color: c.bronze, fontSize: 12, marginTop: 3 },
  tipText: { ...typography.body, color: c.textSecondary, flex: 1, lineHeight: 21 },
}));
