import { MuscleGroup } from '@/data/exercises';
import type { WorkoutSession } from '@/store/workoutStore';
import { getExerciseById } from '@/data/exercises';

// Recovery half-life per muscle group, in hours. Larger/compound muscles recover slower.
export const RECOVERY_HALFLIFE_HOURS: Record<MuscleGroup, number> = {
  chest: 36,
  front_delts: 30,
  side_delts: 24,
  rear_delts: 24,
  lats: 36,
  traps: 30,
  lower_back: 48,
  biceps: 24,
  triceps: 28,
  forearms: 20,
  abs: 18,
  obliques: 18,
  quads: 48,
  hamstrings: 44,
  glutes: 40,
  calves: 24,
};

// A "normal" working set — 8 reps taken to RPE 8 — is the calibration point
// where a set contributes exactly 1.0 unit of dose, so the fatiguePct scale
// below (totalDose / 10) means what it always meant: roughly ten normal
// working sets to fully fatigue a muscle in one session.
const BASELINE_REPS = 8;
const BASELINE_RPE = 8;

/**
 * How much fatigue a single set actually applies, versus just counting it as
 * "one set" regardless of what happened in it. Two inputs, both already
 * logged per set and both meaningful on their own:
 *
 * - reps: a 20-rep set is not the same stimulus as a 3-rep set. Fatigue rises
 *   with reps but sublinearly — going from 8 to 16 reps roughly doubles the
 *   time under tension and metabolic stress, not the fatigue cost outright —
 *   so this scales by sqrt(reps / 8) rather than reps / 8 directly.
 * - rpe: how close to failure the set was taken. A set left at RPE 6 (a few
 *   reps in reserve) is doing real but lighter work; one taken to RPE 10 is
 *   maximal. Each point away from the RPE 8 baseline is worth about 15% more
 *   or less dose, which is roughly what a rep-in-reserve is worth in practice.
 *
 * Neither input needs load (weightKg) at all, which matters because
 * bodyweight sets routinely log weightKg as 0 — an intensity model built on
 * e1RM or volume-load would silently zero out every bodyweight exercise.
 * Reps and RPE are logged the same way regardless of whether a set is
 * weighted, so this works for both.
 *
 * When RPE wasn't logged, it defaults to the baseline rather than to 0 or the
 * lowest value — an unrated set is assumed to be a normal working set, not an
 * easy one, so fatigue tracking doesn't quietly understate itself just
 * because the user skipped a field.
 */
function setEffort(reps: number, rpe: number | undefined): number {
  const clampedReps = Math.min(30, Math.max(1, reps));
  const repsFactor = Math.sqrt(clampedReps / BASELINE_REPS);

  const effectiveRpe = Math.min(10, Math.max(5, rpe ?? BASELINE_RPE));
  const rpeFactor = Math.pow(1.15, effectiveRpe - BASELINE_RPE);

  return repsFactor * rpeFactor;
}

export interface MuscleLoad {
  muscle: MuscleGroup;
  effectiveSets: number; // weighted by primary/secondary + recency
  lastTrainedAt: number | null; // epoch ms
  recoveryPct: number; // 0-100, 100 = fully recovered/fresh
  status: 'fresh' | 'ready' | 'moderate' | 'fatigued' | 'untrained';
}

export function computeMuscleLoads(
  sessions: WorkoutSession[],
  now: number = Date.now()
): Record<MuscleGroup, MuscleLoad> {
  const doses: Record<string, { totalDose: number; lastTrainedAt: number; setCount: number }> = {};

  for (const session of sessions) {
    const sessionTime = session.completedAt ?? session.startedAt;
    const hoursAgo = (now - sessionTime) / (1000 * 60 * 60);
    if (hoursAgo < 0 || hoursAgo > 24 * 14) continue;

    for (const entry of session.entries) {
      const exercise = getExerciseById(entry.exerciseId);
      if (!exercise) continue;
      const completedSets = entry.sets.filter((s) => s.completed && !s.warmup);
      if (completedSets.length === 0) continue;

      // Effort, not just count: a set's contribution depends on how many reps
      // it was and how hard it was taken (see setEffort above), then summed
      // across the sets actually done on this exercise this session.
      const exerciseEffort = completedSets.reduce((sum, s) => sum + setEffort(s.reps, s.rpe), 0);

      const applyDose = (muscle: MuscleGroup, weight: number) => {
        const halflife = RECOVERY_HALFLIFE_HOURS[muscle];
        const decay = Math.pow(0.5, hoursAgo / halflife);
        const doseNow = exerciseEffort * weight * decay;
        const key = muscle;
        if (!doses[key]) doses[key] = { totalDose: 0, lastTrainedAt: sessionTime, setCount: 0 };
        doses[key].totalDose += doseNow;
        doses[key].setCount += completedSets.length * weight;
        doses[key].lastTrainedAt = Math.max(doses[key].lastTrainedAt, sessionTime);
      };

      for (const m of exercise.primaryMuscles) applyDose(m, 1.0);
      for (const m of exercise.secondaryMuscles) applyDose(m, 0.5);
    }
  }

  const result = {} as Record<MuscleGroup, MuscleLoad>;
  for (const muscle of Object.keys(RECOVERY_HALFLIFE_HOURS) as MuscleGroup[]) {
    const d = doses[muscle];
    if (!d) {
      result[muscle] = { muscle, effectiveSets: 0, lastTrainedAt: null, recoveryPct: 100, status: 'untrained' };
      continue;
    }
    const fatiguePct = Math.min(100, (d.totalDose / 10) * 100);
    const recoveryPct = Math.round(100 - fatiguePct);
    let status: MuscleLoad['status'];
    if (recoveryPct >= 90) status = 'fresh';
    else if (recoveryPct >= 65) status = 'ready';
    else if (recoveryPct >= 35) status = 'moderate';
    else status = 'fatigued';

    result[muscle] = {
      muscle,
      effectiveSets: Math.round(d.setCount * 10) / 10,
      lastTrainedAt: d.lastTrainedAt,
      recoveryPct,
      status,
    };
  }
  return result;
}
