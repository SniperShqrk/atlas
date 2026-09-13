/**
 * ATLAS — bodyweight-relative strength standards.
 *
 * A raw e1RM number ("your bench is 82.5kg") means nothing on its own — it
 * means something once it's put next to your own bodyweight. This is the
 * same idea every strength calculator in the sport uses: express the lift as
 * a multiple of bodyweight, then place that multiple on a five-tier ladder
 * (Beginner → Novice → Intermediate → Advanced → Elite).
 *
 * The multiples below are ROUGH, commonly-cited figures synthesized from the
 * kind of bodyweight-ratio tables strength calculators publish generally —
 * not pulled from one specific proprietary source, and deliberately framed
 * in the UI as an estimate, not a verdict. They only cover the handful of
 * barbell lifts where a bodyweight-multiple standard is actually meaningful;
 * everything else (isolation work, machines) has no table and returns null.
 */

export type StandardTier = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Elite';

const TIER_LABELS: StandardTier[] = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

/** Each tuple is the bodyweight multiple that crosses into that tier, ascending. */
const MALE_STANDARDS: Record<string, [number, number, number, number, number]> = {
  barbell_bench_press: [0.5, 0.75, 1.0, 1.5, 2.0],
  back_squat: [0.75, 1.0, 1.5, 2.0, 2.5],
  deadlift: [1.0, 1.25, 1.75, 2.25, 2.75],
  overhead_press: [0.35, 0.5, 0.75, 1.0, 1.25],
};

const FEMALE_STANDARDS: Record<string, [number, number, number, number, number]> = {
  barbell_bench_press: [0.27, 0.4, 0.6, 0.9, 1.2],
  back_squat: [0.5, 0.7, 1.05, 1.5, 1.9],
  deadlift: [0.65, 0.9, 1.3, 1.75, 2.25],
  overhead_press: [0.2, 0.3, 0.45, 0.65, 0.85],
};

export interface StandardProgress {
  /** null when the lift is below even the Beginner threshold */
  tier: StandardTier | null;
  /** current e1RM as a multiple of bodyweight, e.g. 1.4 */
  ratio: number;
  nextTier: StandardTier | null;
  /** 0-100, progress from the current tier's floor toward nextTier — or
   *  from zero toward Beginner when tier is null */
  pctToNext: number | null;
}

/** Null when this lift has no standard table, or bodyweight isn't known yet. */
export function strengthStandard(
  exerciseId: string,
  e1rmKg: number,
  bodyweightKg: number | null | undefined,
  gender: 'male' | 'female' = 'male'
): StandardProgress | null {
  if (!bodyweightKg || bodyweightKg <= 0 || e1rmKg <= 0) return null;
  const table = gender === 'female' ? FEMALE_STANDARDS : MALE_STANDARDS;
  const tiers = table[exerciseId];
  if (!tiers) return null;

  const ratio = e1rmKg / bodyweightKg;
  let idx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (ratio >= tiers[i]) idx = i;
  }

  if (idx === -1) {
    return {
      tier: null,
      ratio,
      nextTier: TIER_LABELS[0],
      pctToNext: Math.round(Math.min(100, (ratio / tiers[0]) * 100)),
    };
  }

  const isLast = idx === tiers.length - 1;
  return {
    tier: TIER_LABELS[idx],
    ratio,
    nextTier: isLast ? null : TIER_LABELS[idx + 1],
    pctToNext: isLast
      ? null
      : Math.round(
          Math.min(100, ((ratio - tiers[idx]) / (tiers[idx + 1] - tiers[idx])) * 100)
        ),
  };
}
