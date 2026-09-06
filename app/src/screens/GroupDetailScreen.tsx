import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Screen, Card, SectionHeader, Divider, EmptyState } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { spacing, typography, radius } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { formatWeight } from '@/utils/units';
import { GroupMemberRow, GroupRow, listGroupMembers } from '@/store/social';
import { useAuth } from '@/store/auth';

type SortKey = 'volume' | 'streak';

export default function GroupDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const group: GroupRow = route.params.group;
  const unit = useWorkoutStore((s) => s.profile.unit);
  const myId = useAuth((s) => s.session?.user.id);

  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('volume');

  const load = useCallback(async () => {
    try {
      const rows = await listGroupMembers(group.id);
      setMembers(rows);
    } catch (e: any) {
      Alert.alert("Couldn't load group", e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sorted = [...members].sort((a, b) =>
    sortKey === 'volume' ? b.totalVolumeKg - a.totalVolumeKg : b.currentStreakWeeks - a.currentStreakWeeks
  );

  return (
    <Screen>
      <ModalHeader title={group.name} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>INVITE CODE</Text>
          <Text style={styles.code}>{group.inviteCode}</Text>
          <Text style={styles.codeHint}>Share this with a friend so they can join from Groups → Join with a code.</Text>
        </Card>

        <View style={styles.sortRow}>
          <SectionHeader title="Leaderboard" />
          <View style={styles.sortToggle}>
            <Pressable
              style={[styles.sortBtn, sortKey === 'volume' && styles.sortBtnActive]}
              onPress={() => setSortKey('volume')}
            >
              <Text style={[styles.sortText, sortKey === 'volume' && styles.sortTextActive]}>Volume</Text>
            </Pressable>
            <Pressable
              style={[styles.sortBtn, sortKey === 'streak' && styles.sortBtnActive]}
              onPress={() => setSortKey('streak')}
            >
              <Text style={[styles.sortText, sortKey === 'streak' && styles.sortTextActive]}>Streak</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : sorted.length === 0 ? (
          <EmptyState icon="👥" title="No members yet" />
        ) : (
          <Card style={{ padding: 0 }}>
            {sorted.map((m, i) => {
              const isMe = m.profile.id === myId;
              return (
                <View key={m.profile.id}>
                  {i > 0 && <Divider />}
                  <View style={styles.row}>
                    <Text style={[styles.rank, i === 0 && styles.rankFirst]}>{i + 1}</Text>
                    <View style={styles.avatar}>
                      <Text style={{ fontSize: 18 }}>{m.profile.avatar_emoji}</Text>
                    </View>
                    <Text style={styles.rowName}>
                      @{m.profile.username}
                      {isMe && <Text style={styles.youTag}> (you)</Text>}
                    </Text>
                    <Text style={styles.rowValue}>
                      {sortKey === 'volume' ? formatWeight(m.totalVolumeKg, unit) : `${m.currentStreakWeeks}w`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg },
  codeCard: { alignItems: 'center', marginBottom: spacing.xl },
  codeLabel: { ...typography.micro, color: c.textFaint },
  code: { ...typography.stat, color: c.accent, letterSpacing: 4, marginTop: spacing.xs },
  codeHint: { ...typography.caption, color: c.textDim, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortToggle: {
    flexDirection: 'row',
    backgroundColor: c.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    padding: 2,
    marginBottom: spacing.md,
  },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm - 2 },
  sortBtnActive: { backgroundColor: c.accent },
  sortText: { ...typography.caption, color: c.textDim, fontWeight: '600' },
  sortTextActive: { color: c.onAccent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rank: { ...typography.bodyMedium, color: c.textFaint, width: 20, textAlign: 'center' },
  rankFirst: { color: c.gold },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { ...typography.bodyMedium, color: c.text, flex: 1 },
  youTag: { color: c.textDim, fontWeight: '400' },
  rowValue: { ...typography.bodyMedium, color: c.text },
}));
