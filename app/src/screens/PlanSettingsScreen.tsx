import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Chip } from '@/components/ui';
import { ScreenLayout, ModalHeader } from '@/components/ScreenLayout';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, SplitPreference } from '@/store/workoutStore';
import { MUSCLE_LABELS, MuscleGroup } from '@/data/exercises';

/**
 * The shape of your training — how many days a week, how long a session
 * runs, which split, what to emphasise, what to avoid.
 *
 * Used by both the manual plan builder (daysPerWeek decides how many days a
 * blank plan gets) and the AI Planner's generation — but unlike generation
 * itself, these are free for every user. Before this screen existed, every
 * one of these controls only lived inside the Pro-gated AI panel, so a free
 * user had no way at all to change "3 days · 30 min".
 */
const DAYS_PER_WEEK = [2, 3, 4, 5, 6];
const SESSION_LENGTHS = [30, 45, 60, 75, 90];

const SPLITS: { key: SplitPreference; label: string }[] = [
  { key: 'auto', label: 'Let it choose' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'upper_lower', label: 'Upper / Lower' },
  { key: 'push_pull_legs', label: 'Push Pull Legs' },
  { key: 'bro_split', label: 'Body Part Split' },
];

const EMPHASIS_OPTIONS: MuscleGroup[] = [
  'chest', 'lats', 'side_delts', 'rear_delts', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
];

export default function PlanSettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const profile = useWorkoutStore((s) => s.profile);
  const setProfile = useWorkoutStore((s) => s.setProfile);

  const toggleEmphasis = (m: MuscleGroup) => {
    const has = profile.emphasis.includes(m);
    setProfile({
      emphasis: has ? profile.emphasis.filter((x) => x !== m) : [...profile.emphasis, m].slice(0, 3),
    });
  };

  return (
    <Screen>
      <ModalHeader title="Plan Settings" onBack={() => navigation.goBack()} />
      <ScreenLayout hasTabBar={false}>
        <Text style={styles.label}>DAYS PER WEEK</Text>
        <View style={styles.chipRow}>
          {DAYS_PER_WEEK.map((d) => (
            <Chip
              key={d}
              label={String(d)}
              active={profile.daysPerWeek === d}
              onPress={() => setProfile({ daysPerWeek: d })}
            />
          ))}
        </View>

        <Text style={[styles.label, { marginTop: spacing.xl }]}>SESSION LENGTH</Text>
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

        <Text style={[styles.label, { marginTop: spacing.xl }]}>SPLIT STYLE</Text>
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

        <Text style={[styles.label, { marginTop: spacing.xl }]}>EMPHASIS · PICK UP TO 3</Text>
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

        <Text style={[styles.label, { marginTop: spacing.xl }]}>INJURIES / THINGS TO AVOID</Text>
        <TextInput
          style={styles.limitationsInput}
          value={profile.limitations}
          onChangeText={(t) => setProfile({ limitations: t })}
          placeholder="e.g. dodgy left shoulder, no overhead pressing"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        <Text style={styles.note}>
          These apply to every new plan you build or generate — the manual builder
          and the AI Planner both start from what's set here.
        </Text>
      </ScreenLayout>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  label: { ...typography.micro, color: c.textFaint, marginBottom: spacing.sm },
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
  note: { ...typography.caption, color: c.textDim, marginTop: spacing.xl, lineHeight: 18 },
}));
