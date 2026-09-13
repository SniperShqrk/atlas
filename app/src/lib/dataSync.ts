import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { WorkoutSession, Routine, BodyweightEntry } from '@/store/workoutStore';
import type { Exercise } from '@/data/exercises';

/**
 * Full personal backup, layered on top of the leaderboard sync in
 * socialSync.ts. That file pushes small derived summaries (PRs, totals) for
 * the compare/leaderboard features; this one pushes the actual training log
 * (workout_sessions, routines, custom_exercises, bodyweight_entries — see
 * supabase/schema.sql) so it survives a phone swap instead of living only in
 * this device's AsyncStorage.
 *
 * Every function here is best-effort and fire-and-forget, same reasoning as
 * socialSync.ts: this sits on top of a fully local app, and a flaky
 * connection must never interrupt logging a set, finishing a workout, or
 * saving a routine.
 *
 * Known limitation: a delete made while offline (the delete-from-Supabase
 * call fails) can come back on the next reconcile, since pushFullBackup only
 * upserts and never deletes — it has no way to tell "never existed" apart
 * from "existed and was removed". Worth a tombstone/soft-delete column if
 * that turns out to matter in practice; not worth the complexity up front.
 */

async function signedInUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function syncSessionToSupabase(session: WorkoutSession): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('workout_sessions').upsert({
      id: session.id,
      user_id: userId,
      name: session.name,
      started_at: new Date(session.startedAt).toISOString(),
      training_started_at: session.trainingStartedAt
        ? new Date(session.trainingStartedAt).toISOString()
        : null,
      completed_at: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      duration_sec: session.durationSec ?? null,
      entries: session.entries,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // best-effort — never let a backup failure interrupt the workout flow.
  }
}

export async function syncRoutineToSupabase(routine: Routine): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('routines').upsert({
      id: routine.id,
      user_id: userId,
      name: routine.name,
      created_at: new Date(routine.createdAt).toISOString(),
      exercises: routine.exercises,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function deleteRoutineFromSupabase(id: string): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('routines').delete().eq('id', id).eq('user_id', userId);
  } catch {
    // best-effort
  }
}

export async function syncCustomExerciseToSupabase(exercise: Exercise): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('custom_exercises').upsert({
      id: exercise.id,
      user_id: userId,
      data: exercise,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function deleteCustomExerciseFromSupabase(id: string): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('custom_exercises').delete().eq('id', id).eq('user_id', userId);
  } catch {
    // best-effort
  }
}

export async function syncBodyweightToSupabase(entry: BodyweightEntry): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('bodyweight_entries').upsert({
      id: entry.id,
      user_id: userId,
      at: new Date(entry.at).toISOString(),
      weight_kg: entry.weightKg,
      note: entry.note ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function deleteBodyweightFromSupabase(id: string): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;
    await supabase.from('bodyweight_entries').delete().eq('id', id).eq('user_id', userId);
  } catch {
    // best-effort
  }
}

export interface CloudBackup {
  sessions: WorkoutSession[];
  routines: Routine[];
  customExercises: Exercise[];
  bodyweight: BodyweightEntry[];
}

/**
 * Pulls everything backed up for the signed-in user, converted back to the
 * app's local shapes. Null if not signed in, not configured, or the request
 * fails — callers treat that exactly like "nothing to hydrate", never as an
 * error worth surfacing.
 */
export async function pullCloudBackup(): Promise<CloudBackup | null> {
  try {
    const userId = await signedInUserId();
    if (!userId) return null;

    const [sessionsRes, routinesRes, exercisesRes, bodyweightRes] = await Promise.all([
      supabase.from('workout_sessions').select('*').eq('user_id', userId),
      supabase.from('routines').select('*').eq('user_id', userId),
      supabase.from('custom_exercises').select('*').eq('user_id', userId),
      supabase.from('bodyweight_entries').select('*').eq('user_id', userId),
    ]);

    const sessions: WorkoutSession[] = (sessionsRes.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      startedAt: new Date(r.started_at).getTime(),
      trainingStartedAt: r.training_started_at ? new Date(r.training_started_at).getTime() : null,
      completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
      entries: r.entries ?? [],
      durationSec: r.duration_sec ?? undefined,
    }));

    const routines: Routine[] = (routinesRes.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      createdAt: new Date(r.created_at).getTime(),
      exercises: r.exercises ?? [],
    }));

    const customExercises: Exercise[] = (exercisesRes.data ?? []).map((r: any) => r.data as Exercise);

    const bodyweight: BodyweightEntry[] = (bodyweightRes.data ?? []).map((r: any) => ({
      id: r.id,
      at: new Date(r.at).getTime(),
      weightKg: Number(r.weight_kg),
      note: r.note ?? undefined,
    }));

    return { sessions, routines, customExercises, bodyweight };
  } catch {
    return null;
  }
}

/**
 * Bulk-upserts the full current local state. Used once per app launch (see
 * App.tsx's useCloudBackupSync) as a reconcile pass: it backs up whatever a
 * signed-in user already had locally before this feature existed, and
 * catches anything a per-action sync call above missed (failed while
 * offline, app was killed mid-request, etc). Safe to call repeatedly —
 * every write is an upsert on the row's own id, never a delete.
 */
export async function pushFullBackup(data: CloudBackup): Promise<void> {
  try {
    const userId = await signedInUserId();
    if (!userId) return;

    const jobs: Promise<unknown>[] = [];

    if (data.sessions.length) {
      jobs.push(
        supabase.from('workout_sessions').upsert(
          data.sessions.map((s) => ({
            id: s.id,
            user_id: userId,
            name: s.name,
            started_at: new Date(s.startedAt).toISOString(),
            training_started_at: s.trainingStartedAt
              ? new Date(s.trainingStartedAt).toISOString()
              : null,
            completed_at: s.completedAt ? new Date(s.completedAt).toISOString() : null,
            duration_sec: s.durationSec ?? null,
            entries: s.entries,
            updated_at: new Date().toISOString(),
          }))
        )
      );
    }

    if (data.routines.length) {
      jobs.push(
        supabase.from('routines').upsert(
          data.routines.map((r) => ({
            id: r.id,
            user_id: userId,
            name: r.name,
            created_at: new Date(r.createdAt).toISOString(),
            exercises: r.exercises,
            updated_at: new Date().toISOString(),
          }))
        )
      );
    }

    if (data.customExercises.length) {
      jobs.push(
        supabase.from('custom_exercises').upsert(
          data.customExercises.map((e) => ({
            id: e.id,
            user_id: userId,
            data: e,
            updated_at: new Date().toISOString(),
          }))
        )
      );
    }

    if (data.bodyweight.length) {
      jobs.push(
        supabase.from('bodyweight_entries').upsert(
          data.bodyweight.map((b) => ({
            id: b.id,
            user_id: userId,
            at: new Date(b.at).toISOString(),
            weight_kg: b.weightKg,
            note: b.note ?? null,
            updated_at: new Date().toISOString(),
          }))
        )
      );
    }

    await Promise.all(jobs);
  } catch {
    // best-effort — this is a safety-net reconcile, not something the app
    // should ever block or alert on.
  }
}
