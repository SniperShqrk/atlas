import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Screen, Card, SectionHeader, Button, EmptyState, Divider } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useAuth, SocialProfile } from '@/store/auth';
import {
  FriendRow,
  GroupRow,
  IncomingRequest,
  OutgoingRequest,
  createGroup,
  joinGroupByCode,
  listFriends,
  listGroups,
  listIncomingRequests,
  listOutgoingRequests,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
} from '@/store/social';

function Avatar({ profile, size = 44 }: { profile: SocialProfile; size?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.5 }}>{profile.avatar_emoji}</Text>
    </View>
  );
}

export default function SocialScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);

  const [tab, setTab] = useState<'friends' | 'groups'>('friends');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);

  const [usernameInput, setUsernameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, inc, out, g] = await Promise.all([
        listFriends(),
        listIncomingRequests(),
        listOutgoingRequests(),
        listGroups(),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
      setGroups(g);
    } catch (e: any) {
      Alert.alert("Couldn't load", e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAddFriend = async () => {
    if (!usernameInput.trim()) return;
    setBusy(true);
    const { error } = await sendFriendRequest(usernameInput);
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't send request", error);
      return;
    }
    setUsernameInput('');
    load();
  };

  const onRespond = async (id: string, accept: boolean) => {
    const { error } = await respondToRequest(id, accept);
    if (error) Alert.alert('Error', error);
    load();
  };

  const onRemoveFriend = (row: FriendRow) => {
    Alert.alert('Remove friend?', `${row.profile.display_name ?? row.profile.username} will no longer see your stats.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeFriend(row.friendshipId);
          load();
        },
      },
    ]);
  };

  const onCreateGroup = async () => {
    if (!groupNameInput.trim()) return;
    setBusy(true);
    const { error } = await createGroup(groupNameInput);
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't create group", error);
      return;
    }
    setGroupNameInput('');
    load();
  };

  const onJoinGroup = async () => {
    if (!joinCodeInput.trim()) return;
    setBusy(true);
    const { error } = await joinGroupByCode(joinCodeInput);
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't join group", error);
      return;
    }
    setJoinCodeInput('');
    load();
  };

  return (
    <Screen>
      <ModalHeader
        title="Friends & Groups"
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={() => Alert.alert('Sign out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
          ])}>
            <Text style={styles.signOut}>Sign Out</Text>
          </Pressable>
        }
      />
      <View style={styles.content}>
        {profile?.username && (
          <View style={styles.meRow}>
            <Avatar profile={profile} size={36} />
            <Text style={styles.meText}>@{profile.username}</Text>
          </View>
        )}

        <View style={styles.segmented}>
          <Pressable style={[styles.segment, tab === 'friends' && styles.segmentActive]} onPress={() => setTab('friends')}>
            <Text style={[styles.segmentText, tab === 'friends' && styles.segmentTextActive]}>Friends</Text>
          </Pressable>
          <Pressable style={[styles.segment, tab === 'groups' && styles.segmentActive]} onPress={() => setTab('groups')}>
            <Text style={[styles.segmentText, tab === 'groups' && styles.segmentTextActive]}>Groups</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : tab === 'friends' ? (
          <>
            <SectionHeader title="Add a friend" />
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                value={usernameInput}
                onChangeText={setUsernameInput}
                placeholder="username"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button label="Add" onPress={onAddFriend} loading={busy} disabled={busy} />
            </View>

            {incoming.length > 0 && (
              <>
                <SectionHeader title="Requests" />
                <Card style={{ padding: 0, marginBottom: spacing.lg }}>
                  {incoming.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 && <Divider />}
                      <View style={styles.row}>
                        <Avatar profile={r.requester} />
                        <Text style={styles.rowName}>@{r.requester.username}</Text>
                        <Pressable onPress={() => onRespond(r.id, true)} hitSlop={8} style={styles.iconAction}>
                          <Icon name="check" size={20} color={colors.success} strokeWidth={2} />
                        </Pressable>
                        <Pressable onPress={() => onRespond(r.id, false)} hitSlop={8} style={styles.iconAction}>
                          <Icon name="close" size={20} color={colors.danger} strokeWidth={2} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {outgoing.length > 0 && (
              <>
                <SectionHeader title="Sent" />
                <Card style={{ padding: 0, marginBottom: spacing.lg }}>
                  {outgoing.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 && <Divider />}
                      <View style={styles.row}>
                        <Avatar profile={r.addressee} />
                        <Text style={styles.rowName}>@{r.addressee.username}</Text>
                        <Text style={styles.pending}>Pending</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}

            <SectionHeader title={`Friends (${friends.length})`} />
            {friends.length === 0 ? (
              <EmptyState icon="🤝" title="No friends yet" subtitle="Add someone by their username to start comparing lifts." />
            ) : (
              <Card style={{ padding: 0 }}>
                {friends.map((f, i) => (
                  <View key={f.friendshipId}>
                    {i > 0 && <Divider />}
                    <Pressable
                      style={styles.row}
                      onPress={() => navigation.navigate('Compare', { friend: f.profile })}
                      onLongPress={() => onRemoveFriend(f)}
                    >
                      <Avatar profile={f.profile} />
                      <Text style={styles.rowName}>@{f.profile.username}</Text>
                      <Icon name="chevron" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}
          </>
        ) : (
          <>
            <SectionHeader title="Create a group" />
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                value={groupNameInput}
                onChangeText={setGroupNameInput}
                placeholder="e.g. Gym Bros"
                placeholderTextColor={colors.textFaint}
              />
              <Button label="Create" onPress={onCreateGroup} loading={busy} disabled={busy} />
            </View>

            <SectionHeader title="Join with a code" />
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                value={joinCodeInput}
                onChangeText={(t) => setJoinCodeInput(t.toUpperCase())}
                placeholder="e.g. K7QX2M"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Button label="Join" onPress={onJoinGroup} loading={busy} disabled={busy} />
            </View>

            <SectionHeader title={`Your groups (${groups.length})`} />
            {groups.length === 0 ? (
              <EmptyState icon="👥" title="No groups yet" subtitle="Create one or join with a friend's invite code." />
            ) : (
              <Card style={{ padding: 0 }}>
                {groups.map((g, i) => (
                  <View key={g.id}>
                    {i > 0 && <Divider />}
                    <Pressable style={styles.row} onPress={() => navigation.navigate('GroupDetail', { group: g })}>
                      <Text style={styles.rowName}>{g.name}</Text>
                      <Text style={styles.rowMeta}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</Text>
                      <Icon name="chevron" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg },
  signOut: { ...typography.caption, color: c.danger, fontWeight: '600' },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  meText: { ...typography.h3, color: c.text },
  avatar: {
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: 3,
    marginBottom: spacing.xl,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: c.accent },
  segmentText: { ...typography.bodyMedium, color: c.textDim },
  segmentTextActive: { color: c.onAccent },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...typography.bodyMedium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowName: { ...typography.bodyMedium, color: c.text, flex: 1 },
  rowMeta: { ...typography.caption, color: c.textDim },
  pending: { ...typography.caption, color: c.textFaint, fontStyle: 'italic' },
  iconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
