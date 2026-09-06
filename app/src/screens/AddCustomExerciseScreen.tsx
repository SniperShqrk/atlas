import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Card, Chip, Button, SectionHeader } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import {
  CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  Category,
  Equipment,
  MuscleGroup,
} from '@/data/exercises';
import { MovementPattern, PATTERNS, PATTERN_GROUPS } from '@/data/patterns';
import { useWorkoutStore } from '@/store/workoutStore';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
const MECHANICS: { key: 'compound' | 'isolation'; label: string }[] = [
  { key: 'compound', label: 'Compound' },
  { key: 'isolation', label: 'Isolation' },
];

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function AddCustomExerciseScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const fromPicker: boolean = route.params?.picker === true;

  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);
  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startSession = useWorkoutStore((s) => s.startSession);

  const [name, setName] = useState<string>(route.params?.initialName ?? '');
  const [category, setCategory] = useState<Category | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [mechanic, setMechanic] = useState<'compound' | 'isolation'>('compound');
  const [primaryMuscles, setPrimaryMuscles] = useState<MuscleGroup[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [patternGroup, setPatternGroup] = useState<string | null>(null);
  const [pattern, setPattern] = useState<MovementPattern | null>(null);

  const secondaryOptions = useMemo(
    () => MUSCLES.filter((m) => !primaryMuscles.includes(m)),
    [primaryMuscles]
  );

  const togglePrimary = (m: MuscleGroup) => {
    setPrimaryMuscles((prev) => toggleIn(prev, m));
    setSecondaryMuscles((prev) => prev.filter((s) => s !== m));
  };

  const isValid =
    name.trim().length > 0 && !!category && !!equipment && primaryMuscles.length > 0 && !!pattern;

  const onSave = () => {
    if (!isValid || !category || !equipment || !pattern) return;
    const created = addCustomExercise({
      name,
      category,
      equipment,
      mechanic,
      primaryMuscles,
      secondaryMuscles,
      pattern,
    });
    if (fromPicker) {
      if (!activeSession) startSession();
      addExerciseToActive(created.id);
      navigation.navigate('WorkoutTab');
    } else {
      navigation.goBack();
    }
  };

  return (
    <Screen>
      <ModalHeader title="New Exercise" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Reverse Nordic Curl"
          placeholderTextColor={colors.textFaint}
          autoFocus
        />

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Category" />
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={CATEGORY_LABELS[c]}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Equipment" />
          <View style={styles.chipRow}>
            {EQUIPMENT.map((e) => (
              <Chip
                key={e}
                label={EQUIPMENT_LABELS[e]}
                active={equipment === e}
                onPress={() => setEquipment(e)}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Primary Muscles" />
          <Text style={styles.hint}>Pick at least one — this drives the muscle diagram and PRs.</Text>
          <View style={styles.chipRow}>
            {MUSCLES.map((m) => (
              <Chip
                key={m}
                label={MUSCLE_LABELS[m]}
                active={primaryMuscles.includes(m)}
                onPress={() => togglePrimary(m)}
              />
            ))}
          </View>
        </View>

        {secondaryOptions.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Secondary Muscles" />
            <Text style={styles.hint}>Optional.</Text>
            <View style={styles.chipRow}>
              {secondaryOptions.map((m) => (
                <Chip
                  key={m}
                  label={MUSCLE_LABELS[m]}
                  active={secondaryMuscles.includes(m)}
                  onPress={() => setSecondaryMuscles((prev) => toggleIn(prev, m))}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Movement Pattern" />
          <Text style={styles.hint}>Picks the coaching notes and common mistakes shown for this lift.</Text>
          <View style={styles.chipRow}>
            {PATTERN_GROUPS.map((g) => (
              <Chip
                key={g.label}
                label={g.label}
                active={patternGroup === g.label}
                onPress={() => {
                  setPatternGroup(g.label);
                  if (!g.patterns.includes(pattern as MovementPattern)) setPattern(null);
                }}
              />
            ))}
          </View>
          {patternGroup && (
            <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
              {PATTERN_GROUPS.find((g) => g.label === patternGroup)?.patterns.map((p) => (
                <Chip
                  key={p}
                  label={PATTERNS[p].label}
                  active={pattern === p}
                  onPress={() => setPattern(p)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Mechanic" />
          <View style={styles.chipRow}>
            {MECHANICS.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                active={mechanic === m.key}
                onPress={() => setMechanic(m.key)}
              />
            ))}
          </View>
        </View>

        <Button
          label="Save Exercise"
          size="lg"
          onPress={onSave}
          disabled={!isValid}
          style={{ marginTop: spacing.xxl }}
        />
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  label: { ...typography.micro, color: c.textFaint, marginBottom: spacing.sm },
  input: {
    color: c.text,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...typography.body,
  },
  hint: { ...typography.caption, color: c.textDim, marginBottom: spacing.sm, marginTop: -4, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
