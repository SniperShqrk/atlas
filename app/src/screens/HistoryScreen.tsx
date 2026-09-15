import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { Icon } from '@/components/Icon';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { Screen, Card, EmptyState, StatTile } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, sessionVolume, sessionSetCount, WorkoutSession } from '@/store/workoutStore';
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
  const route = useRoute<any>();
  const sessions = useWorkoutStore((s) => s.sessions);
  const deleteSession = useWorkoutStore((s) => s.deleteSession);
  const unit = useWorkoutStore((s) => s.profile.unit);

  const onDelete = (item: WorkoutSession) => {
    Alert.alert('Delete workout?', `"${item.name}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(item.id) },
    ]);
  };
  const listRef = useRef<FlatList<WorkoutSession>>(null);

  // arriving from a chart point on the Progress tab — jump straight to the
  // session that point came from and give it a brief highlight so it's
  // obvious which row is the one being pointed at
  const highlightId: string | undefined = route.params?.highlightSessionId;
  const [flashId, setFlashId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
      ),
    [sessions]
  );

  useEffect(() => {
    if (!highlightId) return;
    const index = sorted.findIndex((s) => s.id === highlightId);
    if (index === -1) return;
    setFlashId(highlightId);
    const t = setTimeout(
      () => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 }),
      50
    );
    const fade = setTimeout(() => setFlashId(null), 2200);
    return () => {
      clearTimeout(t);
      clearTimeout(fade);
    };
    // only re-run if a *new* highlight request comes in, not on every
    // session-list change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  const totals = useMemo(() => {
    const volume = sessions.reduce((sum, s) => sum + sessionVolume(s), 0);
    const sets = sessions.reduce((sum, s) => sum + sessionSetCount(s), 0);
    return { volume, sets };
  }, [sessions]);

  return (
    <Screen>
      <ModalHeader title="History" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>

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
          ref={listRef}
          data={sorted}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
          onScrollToIndexFailed={(info) => {
            // rows are variable height, so a first-attempt miss is normal —
            // scroll to the best estimate and let the list settle, then the
            // effect's own retry (via the ref) isn't needed since this
            // fallback already lands close enough for a 12-row-ish list
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          ListEmptyComponent={
            <EmptyState
              title="No workouts yet"
              subtitle="Finish your first session and it will show up here with full set-by-set detail."
            />
          }
          renderItem={({ item }) => (
            <Card
              style={{
                marginBottom: spacing.md,
                ...(item.id === flashId ? styles.flashCard : null),
              }}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.sessionName}>{item.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={styles.sessionDate}>
                    {format(new Date(item.completedAt ?? item.startedAt), 'MMM d')}
                  </Text>
                  <Pressable onPress={() => onDelete(item)} hitSlop={8}>
                    <Icon name="trash" size={15} color={styles.deleteIcon.color} strokeWidth={1.7} />
                  </Pressable>
                </View>
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
                {(expandedIds.has(item.id) ? item.entries : item.entries.slice(0, 5)).map(
                  (entry) => {
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
                  }
                )}
                {item.entries.length > 5 && (
                  <Pressable onPress={() => toggleExpanded(item.id)} hitSlop={6}>
                    <Text style={styles.more}>
                      {expandedIds.has(item.id)
                        ? 'Show less'
                        : `+${item.entries.length - 5} more`}
                    </Text>
                  </Pressable>
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
  flashCard: { borderWidth: 1.5, borderColor: c.bronze },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sessionName: { ...typography.h3, color: c.text },
  sessionDate: { ...typography.caption, color: c.textDim },
  deleteIcon: { color: c.textFaint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaItem: { ...typography.caption, color: c.accent },
  metaDot: { color: c.textFaint, fontSize: 10 },
  exerciseList: { marginTop: spacing.md, gap: 5 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  exerciseName: { ...typography.caption, color: c.textSecondary, flex: 1 },
  exerciseBest: { ...typography.caption, color: c.textDim },
  more: { ...typography.caption, color: c.textFaint, marginTop: 2 },
}));
