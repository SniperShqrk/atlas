import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Screen, Card, EmptyState } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { spacing, typography, radius } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { formatWeight } from '@/utils/units';
import { getExerciseById } from '@/data/exercises';
import { ExerciseStatRow, fetchExerciseStats } from '@/store/social';
import { SocialProfile } from '@/store/auth';

type Metric = { label: string; mine: number; theirs: number; format: (kg: number) => string };

function BarRow({ label, mine, theirs, format }: Metric) {
  const { colors } = useTheme();
  const styles = useStyles();
  const max = Math.max(mine, theirs, 1);
  const pct = theirs > 0 ? Math.round(((mine - theirs) / theirs) * 100) : 0;
  const ahead = pct > 0;

  return (
    <View style={styles.metric}>
      <View style={styles.metricHead}>
        <Text style={styles.metricLabel}>{label}</Text>
        {pct !== 0 && (
          <Text style={[styles.pct, { color: ahead ? colors.success : colors.danger }]}>
            {ahead ? '↑' : '↓'} {Math.abs(pct)}%
          </Text>
        )}
      </View>
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View style={[styles.bar, { width: `${(mine / max) * 100}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={styles.barValue}>{format(mine)}</Text>
      </View>
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View style={[styles.bar, { width: `${(theirs / max) * 100}%`, backgroundColor: colors.textFaint }]} />
        </View>
        <Text style={styles.barValue}>{format(theirs)}</Text>
      </View>
    </View>
  );
}

export default function CompareScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const friend: SocialProfile = route.params.friend;
  const unit = useWorkoutStore((s) => s.profile.unit);
  const myRecords = useWorkoutStore((s) => s.records);

  const [theirStats, setTheirStats] = useState<Record<string, ExerciseStatRow> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const stats = await fetchExerciseStats(friend.id);
      setTheirStats(stats);
    } catch (e: any) {
      Alert.alert("Couldn't load", e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [friend.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const commonExerciseIds = Object.keys(myRecords).filter((id) => theirStats?.[id]);

  let winsMe = 0;
  let winsThem = 0;
  for (const id of commonExerciseIds) {
    const mine = myRecords[id];
    const theirs = theirStats![id];
    if (mine.bestE1rm > theirs.bestE1rm) winsMe += 1;
    else if (theirs.bestE1rm > mine.bestE1rm) winsThem += 1;
  }
  const badge = winsMe > winsThem ? 'STRONGER' : winsThem > winsMe ? 'WEAKER' : 'EVEN';
  const badgeColor = badge === 'STRONGER' ? colors.success : badge === 'WEAKER' ? colors.danger : colors.textDim;

  return (
    <Screen>
      <ModalHeader title="Compare" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <View style={styles.headRow}>
          <View style={styles.headCol}>
            <View style={[styles.avatar, { borderColor: colors.accent }]}>
              <Text style={{ fontSize: 26 }}>🏋️</Text>
            </View>
            <Text style={styles.headName}>You</Text>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.headCol}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 26 }}>{friend.avatar_emoji}</Text>
            </View>
            <Text style={styles.headName}>@{friend.username}</Text>
          </View>
        </View>

        {commonExerciseIds.length > 0 && (
          <View style={[styles.badge, { backgroundColor: badgeColor + '22', borderColor: badgeColor + '55' }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : commonExerciseIds.length === 0 ? (
          <EmptyState
            icon="⚖️"
            title="Nothing to compare yet"
            subtitle={`Once you and @${friend.username} have both logged the same exercise, it'll show up here.`}
          />
        ) : (
          commonExerciseIds.map((id) => {
            const mine = myRecords[id];
            const theirs = theirStats![id];
            const exercise = getExerciseById(id);
            return (
              <Card key={id} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise?.name ?? id}</Text>
                <BarRow
                  label="One Rep Max"
                  mine={mine.bestE1rm}
                  theirs={theirs.bestE1rm}
                  format={(kg) => formatWeight(kg, unit)}
                />
                <BarRow
                  label="Heaviest Weight"
                  mine={mine.bestWeightKg}
                  theirs={theirs.bestWeightKg}
                  format={(kg) => formatWeight(kg, unit)}
                />
                <BarRow
                  label="Best Set (Volume)"
                  mine={mine.bestSetVolumeKg}
                  theirs={theirs.bestSetVolumeKg}
                  format={(kg) => formatWeight(kg, unit)}
                />
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginBottom: spacing.md },
  headCol: { alignItems: 'center', gap: spacing.xs },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.cardAlt,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headName: { ...typography.bodyMedium, color: c.text },
  vs: { ...typography.caption, color: c.textFaint, fontWeight: '700' },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  badgeText: { ...typography.micro, fontWeight: '800' },
  exerciseCard: { marginBottom: spacing.md },
  exerciseName: { ...typography.h3, color: c.text, marginBottom: spacing.md },
  metric: { marginTop: spacing.sm },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metricLabel: { ...typography.caption, color: c.textDim, fontWeight: '600' },
  pct: { ...typography.caption, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.cardAlt, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  barValue: { ...typography.caption, color: c.textSecondary, width: 64, textAlign: 'right' },
}));
