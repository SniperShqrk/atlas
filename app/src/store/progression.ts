import type { Exercise } from '@/data/exercises';
import type { SetEntry, WorkoutSession } from '@/store/workoutStore';
import { estimate1RM } from '@/store/formulas';
import { displayWeight, WeightUnit } from '@/utils/units';

/**
 * Progression suggestions — the single most requested feature in workout
 * trackers, and the thing that turns a logger into a coach.
 *
 * The rule is the standard double-progression model: work up the rep range at
 * a given load, and once the top of the range is hit cleanly across your work
 * sets, add weight and drop back to the bottom of the range. RPE is used when
 * it is logged, because "8 reps at RPE 7" and "8 reps at RPE 10" deserve
 * different advice.
 */

export interface RepRange {
  min: number;
  max: number;
}

export type SuggestionKind = 'add_weight' | 'add_reps' | 'repeat' | 'deload' | 'first_time';

export interface Suggestion {
  kind: SuggestionKind;
  weightKg: number;
  reps: number;
  /** short line shown under the exercise in the logger */
  label: string;
}

/** Rep range for an exercise, given the training goal. */
export function repRangeFor(exercise: Exercise, goal: string): RepRange {
  if (goal === 'strength') {
    return exercise.mechanic === 'compound' ? { min: 3, max: 6 } : { min: 6, max: 10 };
  }
  if (goal === 'lose_fat') {
    return exercise.mechanic === 'compound' ? { min: 10, max: 15 } : { min: 12, max: 20 };
  }
  // build_muscle / general
  return exercise.mechanic === 'compound' ? { min: 6, max: 10 } : { min: 10, max: 15 };
}

/**
 * The smallest sensible jump for a lift. Barbells move in 2.5kg (the smallest
 * pair of plates most gyms have); dumbbells and machines usually jump in
 * bigger fixed steps, and small isolation lifts shouldn't jump 5kg at a time.
 */
export function incrementFor(exercise: Exercise): number {
  switch (exercise.equipment) {
    case 'barbell':
    case 'smith':
      return exercise.mechanic === 'compound' ? 2.5 : 2.5;
    case 'dumbbell':
      return 2; // per hand, i.e. the next dumbbell up
    case 'machine':
    case 'cable':
      return 2.5;
    case 'kettlebell':
      return 4;
    default:
      return 2.5; // bodyweight: added load
  }
}

/** The most recent completed working sets for an exercise. */
export function lastWorkingSets(
  sessions: WorkoutSession[],
  exerciseId: string
): { sets: SetEntry[]; at: number } | null {
  const sorted = [...sessions].sort(
    (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
  );
  for (const session of sorted) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    const working = entry.sets.filter((s) => s.completed && !s.warmup);
    if (working.length) return { sets: working, at: session.completedAt ?? session.startedAt };
  }
  return null;
}

export function suggestNext(
  exercise: Exercise,
  sessions: WorkoutSession[],
  goal: string,
  unit: WeightUnit = 'kg'
): Suggestion {
  // increments are computed in kg throughout — a 2.5kg barbell jump is a real
  // plate, and converting the increment itself (rather than just the number
  // shown) would need a separate lb step size, not just a unit conversion.
  // Only the text shown to the lifter switches units.
  const fmtU = (kg: number) => `${displayWeight(kg, unit)}${unit}`;
  const range = repRangeFor(exercise, goal);
  const last = lastWorkingSets(sessions, exercise.id);

  if (!last) {
    return {
      kind: 'first_time',
      weightKg: 0,
      reps: range.min,
      label: `First time — find a weight you can hold for ${range.min}–${range.max} reps`,
    };
  }

  const step = incrementFor(exercise);
  // the top set is the heaviest; ties broken by reps
  const top = [...last.sets].sort(
    (a, b) => b.weightKg - a.weightKg || b.reps - a.reps
  )[0];
  const minReps = Math.min(...last.sets.map((s) => s.reps));
  const loggedRpe = last.sets.map((s) => s.rpe).filter((r): r is number => typeof r === 'number');
  const avgRpe = loggedRpe.length
    ? loggedRpe.reduce((a, b) => a + b, 0) / loggedRpe.length
    : null;

  // grinding at the top of the range: back off rather than pile on
  if (avgRpe !== null && avgRpe >= 9.5 && minReps < range.min) {
    const weight = Math.max(step, roundToStep(top.weightKg * 0.9, step));
    return {
      kind: 'deload',
      weightKg: weight,
      reps: range.min,
      label: `Last set was a grind — drop to ${fmtU(weight)} and rebuild`,
    };
  }

  // hit the top of the range on every work set: add weight
  if (minReps >= range.max) {
    const weight = roundToStep(top.weightKg + step, step);
    return {
      kind: 'add_weight',
      weightKg: weight,
      reps: range.min,
      label: `You cleared ${range.max} reps on every set — go up to ${fmtU(weight)}`,
    };
  }

  // room left in the range: chase reps at the same load
  if (top.reps < range.max) {
    return {
      kind: 'add_reps',
      weightKg: top.weightKg,
      reps: Math.min(range.max, top.reps + 1),
      label: `Aim for ${Math.min(range.max, top.reps + 1)} reps at ${fmtU(top.weightKg)}`,
    };
  }

  return {
    kind: 'repeat',
    weightKg: top.weightKg,
    reps: range.max,
    label: `Match ${fmtU(top.weightKg)} × ${range.max} across all sets`,
  };
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function fmt(n: number): string {
  // plate sizes like 1.25 must not be rounded to 1.3
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

/* ------------------------------------------------------------------ */
/* Plate calculator                                                    */
/* ------------------------------------------------------------------ */

/** Plates available in a typical gym, heaviest first, in kg. */
export const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateBreakdown {
  /** plates for ONE side of the bar */
  perSide: number[];
  barKg: number;
  /** weight that could not be made up with available plates */
  remainderKg: number;
  achievableKg: number;
}

/**
 * Works out what to load on each side of the bar. Lifters ask for this
 * constantly — doing the arithmetic mid-session with a bar on your back is
 * exactly the kind of friction that breaks training flow.
 */
export function platesFor(targetKg: number, barKg = 20): PlateBreakdown {
  const perSideTarget = (targetKg - barKg) / 2;
  const perSide: number[] = [];

  if (perSideTarget <= 0) {
    return { perSide, barKg, remainderKg: Math.max(0, targetKg - barKg), achievableKg: barKg };
  }

  let remaining = perSideTarget;
  for (const plate of PLATE_SIZES) {
    while (remaining >= plate - 0.001) {
      perSide.push(plate);
      remaining -= plate;
    }
  }

  const loaded = perSide.reduce((a, b) => a + b, 0);
  return {
    perSide,
    barKg,
    remainderKg: Math.round(remaining * 100) / 100,
    achievableKg: barKg + loaded * 2,
  };
}

/** "20kg bar + 2×20, 1×5 per side" */
export function describePlates(b: PlateBreakdown): string {
  if (!b.perSide.length) return `Empty ${b.barKg}kg bar`;
  const counts = new Map<number, number>();
  for (const p of b.perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
  const parts = [...counts.entries()].map(([plate, n]) => `${n}×${fmt(plate)}`);
  return `${b.barKg}kg bar + ${parts.join(', ')} per side`;
}

/* ------------------------------------------------------------------ */
/* Volume landmarks                                                    */
/* ------------------------------------------------------------------ */

/**
 * Weekly working-set targets per muscle, in the spirit of the widely used
 * MEV / MAV framework: below maintenance you lose ground, above the top of the
 * range you accumulate more fatigue than you can recover from.
 */
export const WEEKLY_SET_TARGETS: Record<string, { maintenance: number; growth: [number, number] }> = {
  chest: { maintenance: 6, growth: [10, 20] },
  lats: { maintenance: 8, growth: [10, 22] },
  traps: { maintenance: 4, growth: [8, 20] },
  front_delts: { maintenance: 4, growth: [6, 16] },
  side_delts: { maintenance: 6, growth: [12, 26] },
  rear_delts: { maintenance: 4, growth: [10, 24] },
  biceps: { maintenance: 5, growth: [8, 20] },
  triceps: { maintenance: 5, growth: [8, 20] },
  forearms: { maintenance: 2, growth: [4, 16] },
  abs: { maintenance: 0, growth: [6, 20] },
  obliques: { maintenance: 0, growth: [4, 16] },
  lower_back: { maintenance: 2, growth: [4, 12] },
  quads: { maintenance: 6, growth: [10, 20] },
  hamstrings: { maintenance: 4, growth: [8, 16] },
  glutes: { maintenance: 0, growth: [6, 16] },
  calves: { maintenance: 6, growth: [8, 20] },
};

export function weeklySetsPerMuscle(
  sessions: WorkoutSession[],
  getExercise: (id: string) => Exercise | undefined,
  since: number
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    const when = session.completedAt ?? session.startedAt;
    if (when < since) continue;
    for (const entry of session.entries) {
      const ex = getExercise(entry.exerciseId);
      if (!ex) continue;
      const sets = entry.sets.filter((s) => s.completed && !s.warmup).length;
      if (!sets) continue;
      for (const m of ex.primaryMuscles) counts[m] = (counts[m] ?? 0) + sets;
      // secondary work counts for half a set, the usual convention
      for (const m of ex.secondaryMuscles) counts[m] = (counts[m] ?? 0) + sets * 0.5;
    }
  }
  for (const k of Object.keys(counts)) counts[k] = Math.round(counts[k] * 10) / 10;
  return counts;
}

/** Best estimated 1RM per session for one exercise, oldest first — chart data. */
export function e1rmSeries(
  sessions: WorkoutSession[],
  exerciseId: string
): { at: number; e1rm: number }[] {
  return sessions
    .map((session) => {
      const entry = session.entries.find((e) => e.exerciseId === exerciseId);
      if (!entry) return null;
      const best = entry.sets
        .filter((s) => s.completed && !s.warmup)
        .reduce((max, s) => Math.max(max, estimate1RM(s.weightKg, s.reps)), 0);
      if (!best) return null;
      return { at: session.completedAt ?? session.startedAt, e1rm: Math.round(best) };
    })
    .filter((p): p is { at: number; e1rm: number } => p !== null)
    .sort((a, b) => a.at - b.at);
}
