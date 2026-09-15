/**
 * Training formulas with no dependencies on the store, React or React Native,
 * so the analytics and insight layers can be exercised headlessly in tests.
 */

/**
 * Epley one-rep-max estimate. Used to compare sets across different rep
 * ranges — 100kg x 5 and 110kg x 3 are otherwise not comparable, and PR
 * detection needs them to be.
 *
 * bodyweightKg is optional and defaults to 0, so every existing call site
 * that only passes (weightKg, reps) behaves exactly as before. Pass it for a
 * bodyweight-equipment exercise — where weightKg logged is only the ADDED
 * weight (0 for a plain push-up, some extra kg for a weighted pull-up) — and
 * the estimate is built on total load (bodyweight + added weight) instead.
 * Without this, going from 8 reps to 15 reps at the same 0kg reads as zero
 * progress, which is wrong: more reps at your own bodyweight is still a real
 * strength gain, it just never shows up if "load" is always read as 0.
 */
export function estimate1RM(weightKg: number, reps: number, bodyweightKg = 0): number {
  const load = weightKg + Math.max(0, bodyweightKg);
  if (reps <= 0 || load <= 0) return 0;
  if (reps === 1) return load;
  return load * (1 + reps / 30);
}
