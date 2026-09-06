import React from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, DevSettings } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, SectionHeader, StatTile, Chip, Button } from '@/components/ui';
import { ScreenLayout } from '@/components/ScreenLayout';
import { ProBadge } from '@/components/Pro';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme, useThemeStore } from '@/theme/ThemeProvider';
import { PALETTES } from '@/theme/palettes';
import { useWorkoutStore, UserProfile, sessionVolume, sessionSetCount } from '@/store/workoutStore';
import { useEntitlements, FREE_LIMITS, PRO_LIMITS } from '@/store/entitlements';
import { useOnboarding } from '@/store/onboarding';
import { useAuth } from '@/store/auth';
import { getExerciseById, CATEGORY_LABELS, EQUIPMENT_LABELS } from '@/data/exercises';
import { computeAchievements } from '@/data/achievements';
import { displayWeight, kgToLb } from '@/utils/units';

const GOALS: { key: UserProfile['goal']; label: string }[] = [
  { key: 'build_muscle', label: 'Build Muscle' },
  { key: 'lose_fat', label: 'Lose Fat' },
  { key: 'strength', label: 'Strength' },
  { key: 'general_fitness', label: 'General' },
];

const EXPERIENCE: { key: UserProfile['experience']; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

const EQUIPMENT: { key: UserProfile['equipmentAccess']; label: string }[] = [
  { key: 'full_gym', label: 'Full Gym' },
  { key: 'home_dumbbells', label: 'Home Dumbbells' },
  { key: 'bodyweight_only', label: 'Bodyweight' },
];

const DAYS = [2, 3, 4, 5, 6];
const REST_OPTIONS = [60, 90, 120, 180, 240];
const UNITS: { key: UserProfile['unit']; label: string }[] = [
  { key: 'kg', label: 'Kilograms (kg)' },
  { key: 'lb', label: 'Pounds (lb)' },
];
const HEIGHT_LIMITS = { minCm: 100, maxCm: 250 };

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const themeName = useThemeStore((s) => s.theme);
  const navigation = useNavigation<any>();
  const profile = useWorkoutStore((s) => s.profile);
  const unit = profile.unit;
  const setProfile = useWorkoutStore((s) => s.setProfile);
  const sessions = useWorkoutStore((s) => s.sessions);
  const records = useWorkoutStore((s) => s.records);
  const routines = useWorkoutStore((s) => s.routines);
  const bodyweight = useWorkoutStore((s) => s.bodyweight);
  const deleteRoutine = useWorkoutStore((s) => s.deleteRoutine);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const deleteCustomExercise = useWorkoutStore((s) => s.deleteCustomExercise);
  const isPro = useEntitlements((s) => s.isPro);
  const setPro = useEntitlements((s) => s.setPro);
  const resetOnboarding = useOnboarding((s) => s.reset);
  const authSession = useAuth((s) => s.session);
  const authProfile = useAuth((s) => s.profile);

  const totalVolume = sessions.reduce((sum, s) => sum + sessionVolume(s), 0);
  const totalSets = sessions.reduce((sum, s) => sum + sessionSetCount(s), 0);
  const latestWeight = bodyweight[bodyweight.length - 1];
  const achievements = computeAchievements(sessions, profile.daysPerWeek);

  const topRecords = Object.values(records)
    .sort((a, b) => b.bestE1rm - a.bestE1rm)
    .slice(0, 6);

  return (
    <Screen>
      <ScreenLayout>
        <Text style={styles.title}>Profile</Text>

        {/* subscription state */}
        <Pressable
          style={[styles.proCard, isPro && styles.proCardActive]}
          onPress={() => (isPro ? null : navigation.navigate('Paywall'))}
        >
          <Icon name={isPro ? 'sparkle' : 'lock'} size={22} color={colors.bronze} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.proTitle}>{isPro ? 'ATLAS Premium' : 'Free Plan'}</Text>
            <Text style={styles.proBlurb}>
              {isPro
                ? 'AI planner, charts and export unlocked.'
                : 'Unlimited logging forever. Upgrade for the AI planner and analytics.'}
            </Text>
          </View>
          {!isPro && <Text style={styles.proCta}>Upgrade</Text>}
        </Pressable>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row' }}>
            <StatTile label="Workouts" value={String(sessions.length)} />
            <StatTile label="Sets" value={String(totalSets)} />
            <StatTile
              label="Volume"
              value={`${Math.round((unit === 'lb' ? kgToLb(totalVolume) : totalVolume) / 1000)}k`}
              unit={unit}
            />
          </View>
        </Card>

        {/* bodyweight shortcut */}
        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Bodyweight')}>
          <Icon name="scale" size={20} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Bodyweight</Text>
            <Text style={styles.linkMeta}>
              {latestWeight
                ? `${displayWeight(latestWeight.weightKg, unit)}${unit} · ${bodyweight.length} readings`
                : 'Not logged yet'}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Theme')}>
          <Icon name="palette" size={20} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Appearance</Text>
            <Text style={styles.linkMeta}>{PALETTES[themeName].label}</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Achievements')}>
          <Icon name="trophy" size={20} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Achievements</Text>
            <Text style={styles.linkMeta}>
              {achievements.unlockedCount} of {achievements.totalCount} unlocked
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
        </Pressable>

        <Pressable
          style={styles.linkRow}
          onPress={() => navigation.navigate(authSession ? 'Social' : 'Auth')}
        >
          <Icon name="friends" size={20} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Friends & Groups</Text>
            <Text style={styles.linkMeta}>
              {authProfile?.username ? `Signed in as @${authProfile.username}` : 'Compare lifts, join a group'}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('ShareCard')}>
          <Icon name="share" size={20} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Share Progress</Text>
            <Text style={styles.linkMeta}>Records, sessions, streaks</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('History')}>
          <Icon name="calendar" size={20} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Workout History</Text>
            <Text style={styles.linkMeta}>{sessions.length} sessions</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textDim} strokeWidth={1.7} />
        </Pressable>

        {/* routines */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Routines" />
          <Card style={{ padding: routines.length ? 0 : spacing.lg }}>
            {routines.length === 0 ? (
              <Text style={styles.emptyNote}>
                Finish a workout and save it as a routine to start it again in one tap.
              </Text>
            ) : (
              routines.map((r, i) => (
                <View key={r.id} style={[styles.routineRow, i > 0 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routineName}>{r.name}</Text>
                    <Text style={styles.routineMeta}>{r.exercises.length} exercises</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete routine?', r.name, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteRoutine(r.id) },
                      ])
                    }
                    hitSlop={10}
                  >
                    <Icon name="close" size={16} color={colors.textFaint} strokeWidth={1.7} />
                  </Pressable>
                </View>
              ))
            )}
          </Card>
          <Text style={styles.limitNote}>
            {routines.length} of {isPro ? PRO_LIMITS.routines : FREE_LIMITS.routines} routines used
          </Text>
        </View>

        {/* custom exercises */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Custom Exercises"
            action="Add"
            onAction={() => navigation.navigate('AddCustomExercise')}
          />
          <Card style={{ padding: customExercises.length ? 0 : spacing.lg }}>
            {customExercises.length === 0 ? (
              <Text style={styles.emptyNote}>
                Can't find a lift in the library? Add your own — it'll show up everywhere the built-in
                exercises do.
              </Text>
            ) : (
              customExercises.map((e, i) => (
                <Pressable
                  key={e.id}
                  style={[styles.routineRow, i > 0 && styles.rowBorder]}
                  onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: e.id })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routineName}>{e.name}</Text>
                    <Text style={styles.routineMeta}>
                      {CATEGORY_LABELS[e.category]} · {EQUIPMENT_LABELS[e.equipment]}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete custom exercise?', e.name, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteCustomExercise(e.id) },
                      ])
                    }
                    hitSlop={10}
                  >
                    <Icon name="close" size={16} color={colors.textFaint} strokeWidth={1.7} />
                  </Pressable>
                </Pressable>
              ))
            )}
          </Card>
        </View>

        {/* personal records */}
        {topRecords.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Personal Records" />
            <Card style={{ padding: 0 }}>
              {topRecords.map((r, i) => {
                const ex = getExerciseById(r.exerciseId);
                return (
                  <View key={r.exerciseId} style={[styles.prRow, i > 0 && styles.rowBorder]}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {ex?.name ?? r.exerciseId}
                    </Text>
                    <View style={styles.prValues}>
                      <Text style={styles.prWeight}>
                        {displayWeight(r.bestWeightKg, unit)}{unit} × {r.bestReps}
                      </Text>
                      <Text style={styles.prE1rm}>
                        e1RM {Math.round(displayWeight(r.bestE1rm, unit))}{unit}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Goal" />
          <View style={styles.chipRow}>
            {GOALS.map((g) => (
              <Chip key={g.key} label={g.label} active={profile.goal === g.key} onPress={() => setProfile({ goal: g.key })} />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Experience" />
          <View style={styles.chipRow}>
            {EXPERIENCE.map((e) => (
              <Chip
                key={e.key}
                label={e.label}
                active={profile.experience === e.key}
                onPress={() => setProfile({ experience: e.key })}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Equipment Access" />
          <View style={styles.chipRow}>
            {EQUIPMENT.map((e) => (
              <Chip
                key={e.key}
                label={e.label}
                active={profile.equipmentAccess === e.key}
                onPress={() => setProfile({ equipmentAccess: e.key })}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Training Days / Week" />
          <View style={styles.chipRow}>
            {DAYS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setProfile({ daysPerWeek: d })}
                style={[styles.dayChip, profile.daysPerWeek === d && styles.dayChipActive]}
              >
                <Text style={[styles.dayText, profile.daysPerWeek === d && styles.dayTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Default Rest Timer" />
          <View style={styles.chipRow}>
            {REST_OPTIONS.map((r) => (
              <Chip
                key={r}
                label={`${Math.floor(r / 60)}:${(r % 60).toString().padStart(2, '0')}`}
                active={profile.defaultRestSec === r}
                onPress={() => setProfile({ defaultRestSec: r })}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Units" />
          <View style={styles.chipRow}>
            {UNITS.map((u) => (
              <Chip
                key={u.key}
                label={u.label}
                active={unit === u.key}
                onPress={() => setProfile({ unit: u.key })}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Height" />
          <View style={styles.heightRow}>
            <TextInput
              style={styles.heightInput}
              keyboardType="number-pad"
              placeholder="170"
              placeholderTextColor={colors.textFaint}
              value={profile.heightCm ? String(profile.heightCm) : ''}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                if (!Number.isFinite(n)) {
                  setProfile({ heightCm: undefined });
                  return;
                }
                setProfile({
                  heightCm: Math.min(HEIGHT_LIMITS.maxCm, Math.max(HEIGHT_LIMITS.minCm, n)),
                });
              }}
            />
            <Text style={styles.heightUnit}>cm</Text>
          </View>
        </View>

        {/* dev affordance — remove once billing is wired up */}
        {isPro && (
          <Button
            label="Switch back to Free (testing)"
            variant="ghost"
            onPress={() => setPro(false)}
            style={{ marginTop: spacing.xl }}
          />
        )}

        {/* replays the first-run flow — handy while testing, and worth keeping
            as a real settings option later too */}
        <Button
          label="Replay intro"
          variant="ghost"
          onPress={() => {
            resetOnboarding();
            DevSettings.reload();
          }}
          style={{ marginTop: spacing.sm }}
        />
        <View style={{ height: spacing.xxxl }} />
      </ScreenLayout>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  title: { ...typography.hero, color: c.text },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  proCardActive: { backgroundColor: c.bronzeSoft },
  proTitle: { ...typography.h3, color: c.text },
  proBlurb: { ...typography.caption, color: c.textDim, marginTop: 2, lineHeight: 18 },
  proCta: { ...typography.captionBold, color: c.bronze },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  linkTitle: { ...typography.bodyMedium, color: c.text },
  linkMeta: { ...typography.caption, color: c.textDim, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayChip: {
    width: 46,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  dayText: { ...typography.bodyMedium, color: c.text },
  dayTextActive: { color: c.onAccent },
  emptyNote: { ...typography.caption, color: c.textDim, lineHeight: 19 },
  limitNote: { ...typography.caption, color: c.textFaint, marginTop: spacing.sm },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  routineName: { ...typography.bodyMedium, color: c.text },
  routineMeta: { ...typography.caption, color: c.textDim, marginTop: 2 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  prName: { ...typography.body, color: c.text, flex: 1 },
  prValues: { alignItems: 'flex-end' },
  prWeight: { ...typography.bodyMedium, color: c.bronze },
  prE1rm: { ...typography.caption, color: c.textDim },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  heightInput: { color: c.text, paddingVertical: 12, width: 70, ...typography.bodyMedium },
  heightUnit: { ...typography.caption, color: c.textDim },
}));
