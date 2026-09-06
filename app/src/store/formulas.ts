/**
 * Training formulas with no dependencies on the store, React or React Native,
 * so the analytics and insight layers can be exercised headlessly in tests.
 */

/**
 * Epley one-rep-max estimate. Used to compare sets across different rep
 * ranges — 100kg x 5 and 110kg x 3 are otherwise not comparable, and PR
 * detection needs them to be.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
