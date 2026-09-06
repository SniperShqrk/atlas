import {
  EXERCISES,
  Exercise,
  Equipment,
  MuscleGroup,
  getExerciseById,
} from '@/data/exercises';
import { MovementPattern, PATTERNS } from '@/data/patterns';

/**
 * ATLAS — variations, substitutions and coaching, derived rather than listed.
 *
 * Hand-writing an alternatives list per exercise means 162 lists that are wrong
 * the moment a new exercise is added, and that cannot answer the question
 * people actually ask — "the rack is taken, what else works?" — because a
 * static list knows nothing about what equipment is free. Scoring candidates
 * against the lift you are replacing solves both: the data stays correct as
 * the library grows, and the same function powers equipment-aware swaps.
 */

/* ------------------------------------------------------------------ */
/* Coaching                                                            */
/* ------------------------------------------------------------------ */

/**
 * What goes wrong on this lift. Anything specific to the exercise comes first,
 * then the errors that are true of the whole movement pattern.
 */
export function commonMistakesFor(exercise: Exercise): string[] {
  return [...(exercise.mistakes ?? []), ...PATTERNS[exercise.pattern].commonMistakes];
}

export function patternInfoFor(exercise: Exercise) {
  return PATTERNS[exercise.pattern];
}

/* ------------------------------------------------------------------ */
/* Variations                                                          */
/* ------------------------------------------------------------------ */

/** How much two muscle lists overlap, 0–1 (Jaccard). */
function overlap(a: MuscleGroup[], b: MuscleGroup[]): number {
  if (!a.length && !b.length) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let shared = 0;
  A.forEach((m) => {
    if (B.has(m)) shared += 1;
  });
  return shared / (A.size + B.size - shared || 1);
}

/**
 * Other ways to run essentially the same movement: same pattern, same primary
 * muscles. A variation is something you could swap in without changing what
 * the session is doing — an incline press is a variation of a bench press; a
 * fly is not.
 */
export function variationsOf(exercise: Exercise, limit = 6): Exercise[] {
  return EXERCISES.filter(
    (e) =>
      e.id !== exercise.id &&
      e.pattern === exercise.pattern &&
      overlap(e.primaryMuscles, exercise.primaryMuscles) >= 0.5
  )
    .map((e) => ({
      e,
      // prefer the same equipment, then the same difficulty — a variation is
      // meant to be a small step sideways, not a different exercise entirely
      score:
        (e.equipment === exercise.equipment ? 3 : 0) +
        (e.difficulty === exercise.difficulty ? 2 : 0) +
        (e.mechanic === exercise.mechanic ? 1 : 0) +
        overlap(e.secondaryMuscles, exercise.secondaryMuscles) * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

/* ------------------------------------------------------------------ */
/* Substitutions                                                       */
/* ------------------------------------------------------------------ */

export interface Substitution {
  exercise: Exercise;
  /** why this is a reasonable swap, shown under the row */
  reason: string;
}

const EQUIPMENT_FOR_ACCESS: Record<string, Equipment[]> = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith'],
  home_dumbbells: ['dumbbell', 'bodyweight', 'band', 'kettlebell'],
  bodyweight_only: ['bodyweight', 'band'],
};

export function equipmentFor(access: string): Equipment[] {
  return EQUIPMENT_FOR_ACCESS[access] ?? EQUIPMENT_FOR_ACCESS.full_gym;
}

/**
 * What to do instead. Unlike variations these deliberately reach across
 * patterns when the muscles line up, because the real question is "the bench
 * is taken" or "my shoulder hurts today", not "what else is technically a
 * horizontal press".
 *
 * @param allowed restrict to equipment actually available
 */
export function substitutionsFor(
  exercise: Exercise,
  options: { allowed?: Equipment[]; limit?: number } = {}
): Substitution[] {
  const limit = options.limit ?? 5;
  const allowed = options.allowed;

  const scored = EXERCISES.filter((e) => e.id !== exercise.id)
    .filter((e) => (allowed ? allowed.includes(e.equipment) : true))
    .map((e) => {
      const primary = overlap(e.primaryMuscles, exercise.primaryMuscles);
      if (primary < 0.34) return null;

      const samePattern = e.pattern === exercise.pattern;
      const sameEquipment = e.equipment === exercise.equipment;

      const score =
        primary * 10 +
        (samePattern ? 4 : 0) +
        overlap(e.secondaryMuscles, exercise.secondaryMuscles) * 2 +
        (e.mechanic === exercise.mechanic ? 1.5 : 0) +
        // a swap on different equipment is more useful than one that needs the
        // same rack you already cannot get on
        (sameEquipment ? -1.5 : 1.5);

      const reason = !samePattern
        ? `Same muscles, different movement`
        : sameEquipment
        ? `Closest match to the original`
        : `Same movement on ${EQUIPMENT_WORD[e.equipment]}`;

      return { exercise: e, score, reason };
    })
    .filter((x): x is { exercise: Exercise; score: number; reason: string } => x !== null)
    .sort((a, b) => b.score - a.score);

  // keep the list varied — five barbell rows is not five options
  const out: Substitution[] = [];
  const seenEquipment = new Map<Equipment, number>();
  for (const cand of scored) {
    const n = seenEquipment.get(cand.exercise.equipment) ?? 0;
    if (n >= 2) continue;
    seenEquipment.set(cand.exercise.equipment, n + 1);
    out.push({ exercise: cand.exercise, reason: cand.reason });
    if (out.length >= limit) break;
  }
  return out;
}

const EQUIPMENT_WORD: Record<Equipment, string> = {
  barbell: 'a barbell',
  dumbbell: 'dumbbells',
  machine: 'a machine',
  cable: 'cables',
  bodyweight: 'bodyweight',
  kettlebell: 'a kettlebell',
  band: 'a band',
  smith: 'the Smith machine',
};

/* ------------------------------------------------------------------ */
/* Library filtering                                                   */
/* ------------------------------------------------------------------ */

export interface LibraryFilters {
  query?: string;
  category?: string;
  equipment?: string;
  difficulty?: string;
  mechanic?: string;
  muscle?: MuscleGroup | 'all';
  patternGroup?: MovementPattern[] | null;
}

/** One place that decides what the library shows, so search and filters agree. */
export function filterExercises(
  all: Exercise[],
  f: LibraryFilters,
  muscleLabels: Record<string, string>,
  equipmentLabels: Record<string, string>
): Exercise[] {
  const q = (f.query ?? '').trim().toLowerCase();

  return all.filter((e) => {
    if (f.category && f.category !== 'all' && e.category !== f.category) return false;
    if (f.equipment && f.equipment !== 'all' && e.equipment !== f.equipment) return false;
    if (f.difficulty && f.difficulty !== 'all' && e.difficulty !== f.difficulty) return false;
    if (f.mechanic && f.mechanic !== 'all' && e.mechanic !== f.mechanic) return false;
    if (f.muscle && f.muscle !== 'all') {
      if (!e.primaryMuscles.includes(f.muscle) && !e.secondaryMuscles.includes(f.muscle)) {
        return false;
      }
    }
    if (f.patternGroup && !f.patternGroup.includes(e.pattern)) return false;
    if (!q) return true;

    return (
      e.name.toLowerCase().includes(q) ||
      e.primaryMuscles.some((m) => (muscleLabels[m] ?? '').toLowerCase().includes(q)) ||
      e.secondaryMuscles.some((m) => (muscleLabels[m] ?? '').toLowerCase().includes(q)) ||
      (equipmentLabels[e.equipment] ?? '').toLowerCase().includes(q) ||
      PATTERNS[e.pattern].label.toLowerCase().includes(q)
    );
  });
}

/** Resolve a list of ids, dropping anything that no longer exists. */
export function resolveIds(ids: string[]): Exercise[] {
  return ids.map(getExerciseById).filter((e): e is Exercise => !!e);
}
