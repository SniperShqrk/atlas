import { supabase } from '@/lib/supabase';
import { SocialProfile } from '@/store/auth';
import { PersonalRecord, WorkoutSession, sessionVolume } from '@/store/workoutStore';

// Thin query/mutation layer over the Supabase tables in /supabase/schema.sql.
// No local caching here — screens call these on focus and hold the result
// in component state, since friend/group data changes on someone else's
// device and there's nothing local to optimistically show anyway.

export interface FriendRow {
  friendshipId: string;
  profile: SocialProfile;
}

export interface IncomingRequest {
  id: string;
  createdAt: string;
  requester: SocialProfile;
}

export interface OutgoingRequest {
  id: string;
  createdAt: string;
  addressee: SocialProfile;
}

export interface GroupRow {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
}

export interface ExerciseStatRow {
  exerciseId: string;
  bestWeightKg: number;
  bestReps: number;
  bestE1rm: number;
  bestSetVolumeKg: number;
  achievedAt: string;
}

export interface GroupMemberRow {
  profile: SocialProfile;
  totalVolumeKg: number;
  totalSessions: number;
  currentStreakWeeks: number;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

// ── Friends ────────────────────────────────────────────────────────────

export async function listFriends(): Promise<FriendRow[]> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id,username,display_name,avatar_emoji), addressee:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_emoji)'
    )
    .eq('status', 'accepted');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    friendshipId: row.id,
    profile: row.requester_id === uid ? row.addressee : row.requester,
  }));
}

export async function listIncomingRequests(): Promise<IncomingRequest[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, created_at, requester:profiles!friendships_requester_id_fkey(id,username,display_name,avatar_emoji)')
    .eq('status', 'pending');
  if (error) throw error;
  const uid = await requireUserId();
  return (data ?? [])
    .filter((row: any) => row.requester.id !== uid)
    .map((row: any) => ({ id: row.id, createdAt: row.created_at, requester: row.requester }));
}

export async function listOutgoingRequests(): Promise<OutgoingRequest[]> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, created_at, requester_id, addressee:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_emoji)')
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? [])
    .filter((row: any) => row.requester_id === uid)
    .map((row: any) => ({ id: row.id, createdAt: row.created_at, addressee: row.addressee }));
}

export async function sendFriendRequest(username: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('send_friend_request', { p_username: username.trim() });
  return { error: error?.message ?? null };
}

export async function respondToRequest(
  friendshipId: string,
  accept: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('respond_to_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  return { error: error?.message ?? null };
}

export async function removeFriend(friendshipId: string): Promise<void> {
  await supabase.from('friendships').delete().eq('id', friendshipId);
}

// ── Groups ─────────────────────────────────────────────────────────────

export async function listGroups(): Promise<GroupRow[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(id, name, invite_code, group_members(count))');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.group.id,
    name: row.group.name,
    inviteCode: row.group.invite_code,
    memberCount: row.group.group_members?.[0]?.count ?? 1,
  }));
}

export async function createGroup(name: string): Promise<{ error: string | null; group?: GroupRow }> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name.trim() });
  if (error) return { error: error.message };
  return { error: null, group: { id: data.id, name: data.name, inviteCode: data.invite_code, memberCount: 1 } };
}

export async function joinGroupByCode(code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('join_group_by_code', { p_code: code.trim() });
  return { error: error?.message ?? null };
}

export async function listGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('profile:profiles(id,username,display_name,avatar_emoji)')
    .eq('group_id', groupId);
  if (error) throw error;
  const profiles: SocialProfile[] = (data ?? []).map((r: any) => r.profile);
  const ids = profiles.map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: statsData } = await supabase
    .from('profile_stats')
    .select('user_id, total_volume_kg, total_sessions, current_streak_weeks')
    .in('user_id', ids);
  const statsById = new Map((statsData ?? []).map((s: any) => [s.user_id, s]));

  return profiles
    .map((profile) => {
      const s = statsById.get(profile.id);
      return {
        profile,
        totalVolumeKg: s?.total_volume_kg ?? 0,
        totalSessions: s?.total_sessions ?? 0,
        currentStreakWeeks: s?.current_streak_weeks ?? 0,
      };
    })
    .sort((a, b) => b.totalVolumeKg - a.totalVolumeKg);
}

// ── Stats: comparison ──────────────────────────────────────────────────

export async function fetchExerciseStats(userId: string): Promise<Record<string, ExerciseStatRow>> {
  const { data, error } = await supabase
    .from('exercise_stats')
    .select('exercise_id, best_weight_kg, best_reps, best_e1rm, best_set_volume_kg, achieved_at')
    .eq('user_id', userId);
  if (error) throw error;
  const out: Record<string, ExerciseStatRow> = {};
  for (const row of data ?? []) {
    out[row.exercise_id] = {
      exerciseId: row.exercise_id,
      bestWeightKg: Number(row.best_weight_kg),
      bestReps: row.best_reps,
      bestE1rm: Number(row.best_e1rm),
      bestSetVolumeKg: Number(row.best_set_volume_kg),
      achievedAt: row.achieved_at,
    };
  }
  return out;
}

// ── Pushing my own numbers up (called from src/lib/socialSync.ts) ──────

export async function upsertMyExerciseStats(records: Record<string, PersonalRecord>): Promise<void> {
  const uid = await requireUserId();
  const rows = Object.values(records).map((r) => ({
    user_id: uid,
    exercise_id: r.exerciseId,
    best_weight_kg: r.bestWeightKg,
    best_reps: r.bestReps,
    best_e1rm: r.bestE1rm,
    best_set_volume_kg: r.bestSetVolumeKg,
    achieved_at: new Date(Math.max(r.achievedAt, r.bestSetVolumeAt)).toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('exercise_stats').upsert(rows, { onConflict: 'user_id,exercise_id' });
  if (error) throw error;
}

export async function upsertMyProfileStats(
  sessions: WorkoutSession[],
  currentStreakWeeks: number
): Promise<void> {
  const uid = await requireUserId();
  const totalVolumeKg = sessions.reduce((sum, s) => sum + sessionVolume(s), 0);
  const { error } = await supabase.from('profile_stats').upsert(
    {
      user_id: uid,
      total_volume_kg: totalVolumeKg,
      total_sessions: sessions.length,
      current_streak_weeks: currentStreakWeeks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
