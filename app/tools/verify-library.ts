/**
 * Checks the exercise library and — more importantly — the relations derived
 * from it. Derived data is convenient right up until it starts confidently
 * recommending a calf raise as a substitute for a bench press, so every
 * substitution and variation is checked for muscle overlap rather than assumed
 * correct because the scoring function looked reasonable.
 *
 *   npx tsx tools/verify-library.ts
 */
import {
  EXERCISES,
  Exercise,
  MuscleGroup,
  MUSCLE_LABELS,
  EQUIPMENT_LABELS,
  Equipment,
  ALL_EQUIPMENT,
  getExerciseById,
} from '../src/data/exercises';
import { PATTERNS, PATTERN_GROUPS, MovementPattern } from '../src/data/patterns';
import {
  commonMistakesFor,
  substitutionsFor,
  variationsOf,
  filterExercises,
} from '../src/data/exerciseRelations';
// Legacy 3-tier equipment mapping, kept only for these dev preview/verify
// scripts after the app switched to a granular Equipment[] list on the
// profile (see workoutStore's v1 migration for the canonical mapping).
function equipmentFor(tier: string): Equipment[] {
  return tier === 'bodyweight_only'
    ? ['band']
    : tier === 'home_dumbbells'
    ? ['dumbbell', 'kettlebell', 'band']
    : ALL_EQUIPMENT;
}


let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

function shares(a: MuscleGroup[], b: MuscleGroup[]): boolean {
  return a.some((m) => b.includes(m));
}

/* ------------------------------------------------------------------ */

console.log(`\nLibrary — ${EXERCISES.length} exercises\n`);

check('ids are unique', new Set(EXERCISES.map((e) => e.id)).size === EXERCISES.length);
check('names are unique', new Set(EXERCISES.map((e) => e.name)).size === EXERCISES.length);
check(
  'every exercise has a movement pattern',
  EXERCISES.every((e) => !!PATTERNS[e.pattern]),
  EXERCISES.filter((e) => !PATTERNS[e.pattern]).map((e) => e.id).join(', ')
);
check(
  'every exercise has at least one primary muscle',
  EXERCISES.every((e) => e.primaryMuscles.length > 0)
);
check(
  'no muscle is both primary and secondary on the same lift',
  EXERCISES.every((e) => !shares(e.primaryMuscles, e.secondaryMuscles)),
  EXERCISES.filter((e) => shares(e.primaryMuscles, e.secondaryMuscles)).map((e) => e.id).join(', ')
);
check(
  'every exercise has instructions and coaching notes',
  EXERCISES.every((e) => e.instructions.length >= 2 && e.tips.length >= 1)
);
check(
  'every pattern in the taxonomy is used by at least one exercise',
  (Object.keys(PATTERNS) as MovementPattern[]).every((p) => EXERCISES.some((e) => e.pattern === p)),
  (Object.keys(PATTERNS) as MovementPattern[])
    .filter((p) => !EXERCISES.some((e) => e.pattern === p))
    .join(', ')
);
check(
  'every pattern appears in exactly one filter group',
  (Object.keys(PATTERNS) as MovementPattern[]).every(
    (p) => PATTERN_GROUPS.filter((g) => g.patterns.includes(p)).length === 1
  ),
  (Object.keys(PATTERNS) as MovementPattern[])
    .filter((p) => PATTERN_GROUPS.filter((g) => g.patterns.includes(p)).length !== 1)
    .join(', ')
);

/* ---- pattern assignment sanity: the muscles must match the movement ---- */

console.log('\nPattern assignment\n');

/** A pattern implies certain muscles. If none of them are involved, it is wrong. */
const PATTERN_EXPECTS: Partial<Record<MovementPattern, MuscleGroup[]>> = {
  horizontal_press: ['chest', 'front_delts', 'triceps'],
  vertical_press: ['front_delts', 'side_delts', 'triceps'],
  chest_fly: ['chest'],
  dip: ['chest', 'triceps'],
  vertical_pull: ['lats', 'biceps'],
  horizontal_pull: ['lats', 'traps', 'rear_delts', 'biceps'],
  straight_arm_pull: ['lats', 'chest'],
  rear_delt: ['rear_delts', 'traps'],
  shrug: ['traps'],
  lateral_raise: ['side_delts', 'traps'],
  front_raise: ['front_delts'],
  elbow_flexion: ['biceps', 'forearms'],
  elbow_extension: ['triceps'],
  wrist: ['forearms'],
  squat: ['quads', 'glutes'],
  leg_press: ['quads', 'glutes'],
  lunge: ['quads', 'glutes'],
  hinge: ['hamstrings', 'glutes', 'lower_back', 'quads'],
  knee_flexion: ['hamstrings'],
  knee_extension: ['quads'],
  hip_thrust: ['glutes'],
  hip_abduction: ['glutes', 'hamstrings'],
  calf_raise: ['calves'],
  back_extension: ['lower_back', 'glutes', 'hamstrings'],
  trunk_flexion: ['abs', 'obliques'],
  anti_extension: ['abs', 'obliques'],
  rotation: ['obliques', 'abs'],
  anti_rotation: ['abs', 'obliques'],
  anti_lateral_flexion: ['obliques', 'abs', 'hamstrings'],
  carry: ['forearms', 'traps', 'obliques', 'abs'],
};

const misassigned = EXERCISES.filter((e) => {
  const expects = PATTERN_EXPECTS[e.pattern];
  if (!expects) return false;
  return !shares(e.primaryMuscles, expects) && !shares(e.secondaryMuscles, expects);
});
check(
  'every pattern matches the muscles the exercise actually trains',
  misassigned.length === 0,
  misassigned.map((e) => `${e.id} → ${e.pattern}`).join(', ')
);

/* ---- coaching ---- */

console.log('\nCoaching\n');

check(
  'every exercise yields at least three common mistakes',
  EXERCISES.every((e) => commonMistakesFor(e).length >= 3)
);
check(
  'lift-specific mistakes come first',
  EXERCISES.filter((e) => e.mistakes?.length).every(
    (e) => commonMistakesFor(e)[0] === e.mistakes![0]
  )
);
const withSpecific = EXERCISES.filter((e) => e.mistakes?.length).length;
console.log(`  ${withSpecific} lifts carry mistakes specific to them, on top of their pattern's`);
check(
  'no mistake text is duplicated within one exercise',
  EXERCISES.every((e) => {
    const all = commonMistakesFor(e);
    return new Set(all).size === all.length;
  })
);

/* ---- relations ---- */

console.log('\nVariations and substitutions\n');

let noVariations: Exercise[] = [];
let noSubs: Exercise[] = [];
let badVariation: string[] = [];
let badSub: string[] = [];
let selfRef = 0;

for (const e of EXERCISES) {
  const vars = variationsOf(e);
  const subs = substitutionsFor(e);

  if (!vars.length) noVariations.push(e);
  if (!subs.length) noSubs.push(e);
  if (vars.some((v) => v.id === e.id) || subs.some((s) => s.exercise.id === e.id)) selfRef += 1;

  for (const v of vars) {
    if (v.pattern !== e.pattern) badVariation.push(`${e.id} → ${v.id} (different pattern)`);
    if (!shares(v.primaryMuscles, e.primaryMuscles)) {
      badVariation.push(`${e.id} → ${v.id} (no shared primary)`);
    }
  }
  for (const s of subs) {
    if (!shares(s.exercise.primaryMuscles, e.primaryMuscles)) {
      badSub.push(`${e.id} → ${s.exercise.id}`);
    }
  }
}

check('nothing suggests itself', selfRef === 0, `${selfRef} self-references`);
check(
  'every variation shares the pattern and a primary muscle',
  badVariation.length === 0,
  badVariation.slice(0, 5).join('; ')
);
check(
  'every substitution shares a primary muscle',
  badSub.length === 0,
  badSub.slice(0, 5).join('; ')
);
check(
  'at least 95% of exercises have a substitution',
  noSubs.length / EXERCISES.length < 0.05,
  `${noSubs.length} without: ${noSubs.slice(0, 6).map((e) => e.id).join(', ')}`
);
console.log(
  `  ${noVariations.length} exercises have no variation (expected for one-offs): ` +
    noVariations.slice(0, 6).map((e) => e.id).join(', ')
);

/* ---- equipment-aware substitution ---- */

console.log('\nEquipment-aware substitution\n');

for (const access of ['full_gym', 'home_dumbbells', 'bodyweight_only']) {
  const allowed = equipmentFor(access);
  let covered = 0;
  let leaked = 0;
  for (const e of EXERCISES) {
    const subs = substitutionsFor(e, { allowed });
    if (subs.length) covered += 1;
    if (subs.some((s) => !allowed.includes(s.exercise.equipment))) leaked += 1;
  }
  check(
    `${access}: never suggests unavailable equipment`,
    leaked === 0,
    `${leaked} leaks`
  );
  console.log(
    `        ${covered}/${EXERCISES.length} exercises have a swap on ${access.replace('_', ' ')}`
  );
}

/* ---- a worked example, so the output can be eyeballed ---- */

console.log('\nWorked example — Barbell Bench Press, dumbbells only\n');
const bench = getExerciseById('barbell_bench_press')!;
substitutionsFor(bench, { allowed: equipmentFor('home_dumbbells') }).forEach((s) =>
  console.log(`  ${s.exercise.name.padEnd(30)} ${s.reason}`)
);
console.log('\n  Variations:');
variationsOf(bench, 5).forEach((v) => console.log(`  ${v.name}`));

/* ---- filtering ---- */

console.log('\nFiltering\n');

const all = filterExercises(EXERCISES, {}, MUSCLE_LABELS, EQUIPMENT_LABELS);
check('no filters returns everything', all.length === EXERCISES.length);

const compounds = filterExercises(EXERCISES, { mechanic: 'compound' }, MUSCLE_LABELS, EQUIPMENT_LABELS);
check('mechanic filter works', compounds.every((e) => e.mechanic === 'compound') && compounds.length > 0);

const beginner = filterExercises(EXERCISES, { difficulty: 'beginner' }, MUSCLE_LABELS, EQUIPMENT_LABELS);
check('difficulty filter works', beginner.every((e) => e.difficulty === 'beginner') && beginner.length > 0);

const press = filterExercises(
  EXERCISES,
  { patternGroup: PATTERN_GROUPS.find((g) => g.label === 'Press')!.patterns },
  MUSCLE_LABELS,
  EQUIPMENT_LABELS
);
check('movement filter works', press.length > 0 && press.every((e) => e.pattern.includes('press') || e.pattern === 'dip' || e.pattern === 'chest_fly'));

const search = filterExercises(EXERCISES, { query: 'hamstring' }, MUSCLE_LABELS, EQUIPMENT_LABELS);
check(
  'search reaches secondary muscles',
  search.length > 0 && search.some((e) => e.secondaryMuscles.includes('hamstrings')),
  `${search.length} hits`
);

const combined = filterExercises(
  EXERCISES,
  { category: 'legs', equipment: 'dumbbell', difficulty: 'beginner' },
  MUSCLE_LABELS,
  EQUIPMENT_LABELS
);
check(
  'filters combine',
  combined.every((e) => e.category === 'legs' && e.equipment === 'dumbbell' && e.difficulty === 'beginner'),
  `${combined.length} results`
);

/* ---- coverage ---- */

console.log('\nCoverage\n');
const byMuscle: Record<string, number> = {};
for (const e of EXERCISES) for (const m of e.primaryMuscles) byMuscle[m] = (byMuscle[m] ?? 0) + 1;
const thin = Object.entries(MUSCLE_LABELS).filter(([m]) => (byMuscle[m] ?? 0) < 3);
check(
  'every muscle has at least three exercises training it directly',
  thin.length === 0,
  thin.map(([m, l]) => `${l} ${byMuscle[m] ?? 0}`).join(', ')
);
Object.entries(byMuscle)
  .sort((a, b) => b[1] - a[1])
  .forEach(([m, n]) => console.log(`  ${(MUSCLE_LABELS as any)[m].padEnd(14)} ${n}`));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
