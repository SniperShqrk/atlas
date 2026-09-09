import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { PersonalRecord, WorkoutSession } from '@/store/workoutStore';
import { consistency } from '@/store/analytics';
import { upsertMyExerciseStats, upsertMyProfileStats } from '@/store/social';

/**
 * Called right after finishSession(), alongside the existing syncSession()
 * call to the AI-planner backend — same best-effort, fire-and-forget shape.
 * A no-op if Supabase isn't configured or nobody's signed in, so this is
 * safe to call unconditionally from WorkoutScreen.
 */
export async function syncStatsToSupabase(
  records: Record<string, PersonalRecord>,
  sessions: WorkoutSession[]
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const { weekStreak } = consistency(sessions, 7 /* days/week doesn't affect weekStreak */);
    await Promise.all([upsertMyExerciseStats(records), upsertMyProfileStats(sessions, weekStreak)]);
  } catch {
    // Friends/groups are a nice-to-have layered on top of a fully local app —
    // never let a flaky connection interrupt finishing a workout.
  }
}
