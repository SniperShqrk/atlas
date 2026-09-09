import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { Screen, Card, EmptyState, StatTile } from '@/components/ui';
import { TopInset } from '@/components/ScreenLayout';
import { spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, sessionVolume, sessionSetCount } from '@/store/workoutStore';
import { getExerciseById } from '@/data/exercises';
import { displayWeight, kgToLb } from '@/utils/units';

function duration(sec?: number) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HistoryScreen() {
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const sessions = useWorkoutStore((s) => s.sessions);
  const unit = useWorkoutStore((s) => s.profile.unit);

  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
      ),
    [sessions]
  );

  const totals = useMemo(() => {
    const volume = sessions.reduce((sum, s) => sum + sessionVolume(s), 0);
    const sets = sessions.reduce((sum, s) => sum + sessionSetCount(s), 0);
    return { volume, sets };
  }, [sessions]);

  return (
    <Screen>
      <TopInset />
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>

        {sessions.length > 0 && (
          <Card style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row' }}>
              <StatTile label="Workouts" value={String(sessions.length)} />
              <StatTile label="Total sets" value={String(totals.sets)} />
              <StatTile
                label="Lifetime volume"
                value={`${Math.round((unit === 'lb' ? kgToLb(totals.volume) : totals.volume) / 1000)}k`}
                unit={unit}
              />
            </View>
          </Card>
        )}

        <FlatList
          data={sorted}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={
            <EmptyState
              title="No workouts yet"
              subtitle="Finish your first session and it will show up here with full set-by-set detail."
            />
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={styles.rowHeader}>
                <Text style={styles.sessionName}>{item.name}</Text>
                <Text style={styles.sessionDate}>
                  {format(new Date(item.completedAt ?? item.startedAt), 'MMM d')}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>{duration(item.durationSec)}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaItem}>{sessionSetCount(item)} sets</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaItem}>
                  {Math.round(
                    unit === 'lb' ? kgToLb(sessionVolume(item)) : sessionVolume(item)
                  ).toLocaleString()}
                  {unit}
                </Text>
              </View>

              <View style={styles.exerciseList}>
                {item.entries.slice(0, 5).map((entry) => {
                  const ex = getExerciseById(entry.exerciseId);
                  if (!ex) return null;
                  const best = entry.sets.reduce(
                    (b, s) => (s.weightKg * s.reps > b.weightKg * b.reps ? s : b),
                    entry.sets[0]
                  );
                  return (
                    <View key={entry.exerciseId} style={styles.exerciseRow}>
                      <Text style={styles.exerciseName} numberOfLines={1}>
                        {entry.sets.length} × {ex.name}
                      </Text>
                      <Text style={styles.exerciseBest}>
                        {best ? `${displayWeight(best.weightKg, unit)}${unit} × ${best.reps}` : ''}
                      </Text>
                    </View>
                  );
                })}
                {item.entries.length > 5 && (
                  <Text style={styles.more}>+{item.entries.length - 5} more</Text>
                )}
              </View>
            </Card>
          )}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.hero, color: c.text },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sessionName: { ...typography.h3, color: c.text },
  sessionDate: { ...typography.caption, color: c.textDim },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaItem: { ...typography.caption, color: c.accent },
  metaDot: { color: c.textFaint, fontSize: 10 },
  exerciseList: { marginTop: spacing.md, gap: 5 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  exerciseName: { ...typography.caption, color: c.textSecondary, flex: 1 },
  exerciseBest: { ...typography.caption, color: c.textDim },
  more: { ...typography.caption, color: c.textFaint, marginTop: 2 },
}));
