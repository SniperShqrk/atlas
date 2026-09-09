/**
 * Checks the muscle-fatigue model actually responds to training load, not
 * just to how many sets were logged. The failure mode this guards against is
 * exactly the one that was reported: a 3-set arm workout and a 3-set set of
 * back-to-failure 20-rep squats reading as identically fatiguing, because the
 * dose only ever counted sets. Every check here compares two histories that
 * differ in reps/RPE but not set count, and asserts the fatigue differs too.
 *
 *   npx tsx tools/verify-recovery.ts
 */
import './nodeAssetShim';
import { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { computeMuscleLoads } from '../src/store/recovery';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

const START = new Date('2026-01-01T09:00:00Z').getTime();

function set(reps: number, rpe?: number, weightKg = 60): SetEntry {
  return { id: Math.random().toString(36).slice(2), weightKg, reps, rpe, completed: true };
}

function warmupSet(reps: number, weightKg = 20): SetEntry {
  return { id: Math.random().toString(36).slice(2), weightKg, reps, completed: true, warmup: true };
}

/**
 * A single completed session with one exercise, completing exactly
 * `hoursAgo` before START. No added session-length offset here — this needs
 * to land at an exact hoursAgo relative to `now`, and a session that
 * "finishes" after `now` gets skipped by computeMuscleLoads as being in the
 * future.
 */
function sessionAgo(hoursAgo: number, exerciseId: string, sets: SetEntry[]): WorkoutSession {
  const at = START - hoursAgo * 60 * 60 * 1000;
  return {
    id: `s-${hoursAgo}-${Math.random().toString(36).slice(2)}`,
    name: 'Session',
    startedAt: at,
    completedAt: at,
    entries: [{ exerciseId, sets }],
  };
}

/* ---- untrained baseline ---- */

console.log('\nUntrained\n');

const untrained = computeMuscleLoads([], START);
check('nothing logged reads fully fresh', untrained.chest.recoveryPct === 100 && untrained.chest.status === 'untrained');
check('every muscle group is represented', Object.keys(untrained).length >= 16, `${Object.keys(untrained).length}`);

/* ---- reps matter, not just set count ---- */

console.log('\nReps drive dose, not just set count\n');

const threeLightSets = [set(3), set(3), set(3)];
const threeHeavySets = [set(20), set(20), set(20)];

const lightLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', threeLightSets)], START).chest;
const heavyLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', threeHeavySets)], START).chest;

check(
  'same set count, more reps per set → more fatigue',
  heavyLoad.recoveryPct < lightLoad.recoveryPct,
  `3-rep sets → ${lightLoad.recoveryPct}%, 20-rep sets → ${heavyLoad.recoveryPct}%`
);

/* ---- RPE matters ---- */

console.log('\nRPE drives dose, not just set count\n');

const easyRpe = [set(8, 6), set(8, 6), set(8, 6)];
const maxRpe = [set(8, 10), set(8, 10), set(8, 10)];

const easyLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', easyRpe)], START).chest;
const maxLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', maxRpe)], START).chest;

check(
  'same reps and sets, higher RPE → more fatigue',
  maxLoad.recoveryPct < easyLoad.recoveryPct,
  `RPE6 → ${easyLoad.recoveryPct}%, RPE10 → ${maxLoad.recoveryPct}%`
);

/* ---- missing RPE defaults to a normal working set, not zero ---- */

console.log('\nMissing RPE\n');

const noRpe = [set(8), set(8), set(8)];
const explicitBaseline = [set(8, 8), set(8, 8), set(8, 8)];
const noRpeLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', noRpe)], START).chest;
const baselineLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', explicitBaseline)], START).chest;
check(
  'an unrated set is treated the same as an explicit RPE 8 set',
  noRpeLoad.recoveryPct === baselineLoad.recoveryPct,
  `unrated → ${noRpeLoad.recoveryPct}%, RPE8 → ${baselineLoad.recoveryPct}%`
);

/* ---- calibration: ~10 baseline working sets fatigues a muscle fully ---- */

console.log('\nCalibration\n');

const tenBaselineSets = Array.from({ length: 10 }, () => set(8, 8));
const tenSetLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', tenBaselineSets)], START).chest;
check(
  '10 baseline (8 reps, RPE8) sets in one session reads as fully fatigued',
  tenSetLoad.recoveryPct <= 5,
  `${tenSetLoad.recoveryPct}%`
);

const threeBaselineSets = Array.from({ length: 3 }, () => set(8, 8));
const threeSetLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', threeBaselineSets)], START).chest;
check(
  '3 baseline sets leaves real headroom, not near-zero',
  threeSetLoad.recoveryPct > 50 && threeSetLoad.recoveryPct < 90,
  `${threeSetLoad.recoveryPct}%`
);

/* ---- primary vs secondary weighting still holds ---- */

console.log('\nPrimary vs secondary\n');

const benchSets = Array.from({ length: 5 }, () => set(8, 8));
const benchLoads = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', benchSets)], START);
check(
  'primary muscle (chest) is more fatigued than a secondary muscle (triceps) from the same sets',
  benchLoads.chest.recoveryPct < benchLoads.triceps.recoveryPct,
  `chest ${benchLoads.chest.recoveryPct}%, triceps ${benchLoads.triceps.recoveryPct}%`
);
check(
  'an untouched muscle from this exercise stays fresh',
  benchLoads.quads.recoveryPct === 100 && benchLoads.quads.status === 'untrained'
);

/* ---- decay over time ---- */

console.log('\nDecay over time\n');

const freshLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', tenBaselineSets)], START).chest;
const halfDayLoad = computeMuscleLoads([sessionAgo(18, 'barbell_bench_press', tenBaselineSets)], START).chest; // ~ chest halflife
const fullyRecoveredLoad = computeMuscleLoads([sessionAgo(24 * 10, 'barbell_bench_press', tenBaselineSets)], START).chest;

check('fatigue recovers over time', halfDayLoad.recoveryPct > freshLoad.recoveryPct, `fresh ${freshLoad.recoveryPct}% → +18h ${halfDayLoad.recoveryPct}%`);
check(
  'a session from 10 days ago no longer registers meaningfully',
  fullyRecoveredLoad.recoveryPct >= 95,
  `${fullyRecoveredLoad.recoveryPct}%`
);

/* ---- warmups and incomplete sets are excluded ---- */

console.log('\nWarmups and incomplete sets excluded\n');

const withWarmups: SetEntry[] = [warmupSet(10), warmupSet(8), set(8, 8), set(8, 8), set(8, 8)];
const withoutWarmupsEquivalent: SetEntry[] = [set(8, 8), set(8, 8), set(8, 8)];
const warmupLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', withWarmups)], START).chest;
const noWarmupLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', withoutWarmupsEquivalent)], START).chest;
check(
  'warmup sets contribute no dose',
  warmupLoad.recoveryPct === noWarmupLoad.recoveryPct,
  `with warmups ${warmupLoad.recoveryPct}%, working sets only ${noWarmupLoad.recoveryPct}%`
);

const incompleteOnly: SetEntry[] = [{ id: 'x', weightKg: 60, reps: 8, rpe: 9, completed: false }];
const incompleteLoad = computeMuscleLoads([sessionAgo(0, 'barbell_bench_press', incompleteOnly)], START).chest;
check('an incomplete set contributes no dose', incompleteLoad.recoveryPct === 100 && incompleteLoad.status === 'untrained');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
