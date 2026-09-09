import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Chip, InfoButton, EmptyState } from '@/components/ui';
import { TopInset } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import {
  EXERCISES,
  MUSCLE_LABELS,
  CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  Category,
  Equipment,
  Exercise,
} from '@/data/exercises';
import { PATTERN_GROUPS } from '@/data/patterns';
import { filterExercises } from '@/data/exerciseRelations';
import { useWorkoutStore } from '@/store/workoutStore';
import { ExerciseThumb } from '@/components/ExerciseThumb';

const CATEGORIES: (Category | 'all')[] = ['all', 'chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
const EQUIPMENT: (Equipment | 'all')[] = [
  'all',
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'smith',
];

export default function ExerciseLibraryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isPicker = route.params?.picker === true;
  /** When set, picking (or creating) an exercise here adds it to that day of
   *  the AI/imported plan on the Plan tab instead of the active session —
   *  see PlanScreen's edit mode. */
  const planDayIndex: number | undefined = route.params?.planDayIndex;
  /** When also set alongside planDayIndex, picking an exercise here replaces
   *  that one exercise in place (same slot, same targets) instead of
   *  appending a new one — see PlanScreen's per-exercise "swap" action. */
  const planExerciseIndex: number | undefined = route.params?.planExerciseIndex;

  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const addExerciseToPlanDay = useWorkoutStore((s) => s.addExerciseToPlanDay);
  const swapPlanExercise = useWorkoutStore((s) => s.swapPlanExercise);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startSession = useWorkoutStore((s) => s.startSession);
  const customExercises = useWorkoutStore((s) => s.customExercises);

  const allExercises = useMemo(
    () => (customExercises.length ? [...EXERCISES, ...customExercises] : EXERCISES),
    [customExercises]
  );

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>(route.params?.category ?? 'all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [mechanic, setMechanic] = useState<string>('all');
  const [patternGroup, setPatternGroup] = useState<string>('all');
  // the secondary filter row is collapsed by default — a wall of chips over a
  // search field is how a library stops feeling fast
  const [showMore, setShowMore] = useState(false);

  const activeExtras =
    (difficulty !== 'all' ? 1 : 0) + (mechanic !== 'all' ? 1 : 0) + (patternGroup !== 'all' ? 1 : 0);

  const filtered = useMemo(
    () =>
      filterExercises(
        allExercises,
        {
          query,
          category,
          equipment,
          difficulty,
          mechanic,
          patternGroup:
            patternGroup === 'all'
              ? null
              : PATTERN_GROUPS.find((g) => g.label === patternGroup)?.patterns ?? null,
        },
        MUSCLE_LABELS,
        EQUIPMENT_LABELS
      ),
    [allExercises, query, category, equipment, difficulty, mechanic, patternGroup]
  );

  const clearAll = () => {
    setDifficulty('all');
    setMechanic('all');
    setPatternGroup('all');
  };

  const onSelect = (exercise: Exercise) => {
    if (!isPicker) {
      navigation.navigate('ExerciseDetail', { exerciseId: exercise.id });
      return;
    }
    if (planDayIndex != null) {
      if (planExerciseIndex != null) {
        swapPlanExercise(planDayIndex, planExerciseIndex, exercise.id);
      } else {
        addExerciseToPlanDay(planDayIndex, exercise.id);
      }
      navigation.navigate('Tabs', { screen: 'PlanTab' });
      return;
    }
    if (!activeSession) startSession();
    addExerciseToActive(exercise.id);
    navigation.goBack();
  };

  return (
    <Screen>
      <TopInset />
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{!isPicker ? 'Exercises' : planExerciseIndex != null ? 'Swap Exercise' : 'Add Exercise'}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.count}>{filtered.length} of {allExercises.length}</Text>
            <Pressable
              onPress={() => navigation.navigate('AddCustomExercise', { picker: isPicker, planDayIndex, planExerciseIndex, initialName: query })}
              hitSlop={10}
              style={styles.addButton}
            >
              <Icon name="plus" size={18} color={colors.accent} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Icon name="search" size={17} color={colors.textDim} strokeWidth={1.6} />
          <TextInput
            style={styles.search}
            placeholder="Search exercise, muscle or equipment"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="close" size={15} color={colors.textDim} strokeWidth={1.7} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c === 'all' ? 'All' : CATEGORY_LABELS[c as Category]}
              active={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={[styles.filterRow, { paddingTop: 0 }]}
        >
          {EQUIPMENT.map((e) => (
            <Chip
              key={e}
              label={e === 'all' ? 'Any Equipment' : EQUIPMENT_LABELS[e as Equipment]}
              active={equipment === e}
              onPress={() => setEquipment(e)}
            />
          ))}
        </ScrollView>

        <View style={styles.moreRow}>
          <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={8} style={styles.moreToggle}>
            <Text style={styles.moreText}>
              {showMore ? 'Fewer filters' : 'More filters'}
              {activeExtras > 0 ? ` · ${activeExtras}` : ''}
            </Text>
            <View style={showMore ? styles.chevronOpen : undefined}>
              <Icon name="chevron" size={14} color={colors.accent} strokeWidth={2} />
            </View>
          </Pressable>
          {activeExtras > 0 && (
            <Pressable onPress={clearAll} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {showMore && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={[styles.filterRow, { paddingTop: 0, paddingBottom: spacing.sm }]}
            >
              {['all', 'beginner', 'intermediate', 'advanced'].map((d) => (
                <Chip
                  key={d}
                  label={d === 'all' ? 'Any Difficulty' : d[0].toUpperCase() + d.slice(1)}
                  active={difficulty === d}
                  onPress={() => setDifficulty(d)}
                />
              ))}
              {['compound', 'isolation'].map((m) => (
                <Chip
                  key={m}
                  label={m[0].toUpperCase() + m.slice(1)}
                  active={mechanic === m}
                  onPress={() => setMechanic(mechanic === m ? 'all' : m)}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={[styles.filterRow, { paddingTop: 0 }]}
            >
              <Chip
                label="Any Movement"
                active={patternGroup === 'all'}
                onPress={() => setPatternGroup('all')}
              />
              {PATTERN_GROUPS.map((g) => (
                <Chip
                  key={g.label}
                  label={g.label}
                  active={patternGroup === g.label}
                  onPress={() => setPatternGroup(patternGroup === g.label ? 'all' : g.label)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingBottom: spacing.xxxl, flexGrow: 1 }}
          ListEmptyComponent={
            <View>
              <EmptyState title="No matches" subtitle="Try a different search or clear the filters." />
              <Pressable
                style={styles.createRow}
                onPress={() => navigation.navigate('AddCustomExercise', { picker: isPicker, planDayIndex, planExerciseIndex, initialName: query })}
              >
                <Icon name="plus" size={16} color={colors.accent} strokeWidth={2} />
                <Text style={styles.createRowText}>
                  {query ? `Create "${query}" as a custom exercise` : 'Create a custom exercise'}
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardPressed }]}
              onPress={() => onSelect(item)}
            >
              <ExerciseThumb exercise={item} />
              <View style={styles.rowBody}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.isCustom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Custom</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowSubtitle}>
                  {item.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}
                </Text>
                <View style={styles.rowMeta}>
                  <Text style={styles.metaText}>{EQUIPMENT_LABELS[item.equipment]}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{item.mechanic}</Text>
                </View>
              </View>
              <InfoButton onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: item.id })} />
            </Pressable>
          )}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.hero, color: c.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  count: { ...typography.caption, color: c.textDim },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  createRowText: { ...typography.bodyMedium, color: c.accent },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  customBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
  },
  customBadgeText: { ...typography.micro, color: c.accent, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
  },
  search: { flex: 1, color: c.text, paddingVertical: 11, ...typography.body },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { ...typography.caption, color: c.accent, fontWeight: '600' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  clearText: { ...typography.caption, color: c.textDim, fontWeight: '600' },
  // Fixed height + locked flex so a horizontal chip row can never be
  // stretched or squashed by the surrounding column layout — each row's
  // box size is deterministic regardless of how many results the list
  // below ends up rendering.
  filterScroll: { height: 64, flexGrow: 0, flexShrink: 0 },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The list is the only element allowed to grow into leftover space —
  // everything above it sizes to its own content only.
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: c.text, flexShrink: 1 },
  rowSubtitle: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaText: { ...typography.caption, color: c.textFaint, textTransform: 'capitalize' },
  metaDot: { color: c.textFaint, fontSize: 10 },
}));
