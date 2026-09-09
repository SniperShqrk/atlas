/**
 * Checks the achievement engine against synthetic histories rather than a
 * live log — the failure mode worth catching is a tier that never unlocks
 * (an off-by-one on the threshold, a category reading the wrong field) or
 * one that unlocks too early, both of which are invisible from reading the
 * code and only show up by actually running numbers through it.
 *
 *   npx tsx tools/verify-achievements.ts
 */
import { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { TIERS, computeAchievements, newlyUnlocked, AchievementCategory } from '../src/data/achievements';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

const DAY = 86_400_000;
const START = new Date('2026-01-01T09:00:00Z').getTime();

function set(weightKg: number, reps: number): SetEntry {
  return { id: Math.random().toString(36).slice(2), weightKg, reps, completed: true };
}

/** A session on a given day, with a given list of (exerciseId, weight, reps, sets) entries. */
function session(dayOffset: number, exercises: { id: string; weightKg: number; reps: number; sets: number }[]): WorkoutSession {
  const at = START + dayOffset * DAY;
  return {
    id: `s${dayOffset}`,
    name: 'Session',
    startedAt: at,
    completedAt: at + 45 * 60_000,
    entries: exercises.map((e) => ({
      exerciseId: e.id,
      sets: Array.from({ length: e.sets }, () => set(e.weightKg, e.reps)),
    })),
  };
}

/* ---- tier data sanity ---- */

console.log('\nTier data\n');

const allTiers = (Object.values(TIERS) as any[]).flat();
check('ids are unique', new Set(allTiers.map((t) => t.id)).size === allTiers.length);
check(
  'thresholds strictly increase within each category',
  (Object.keys(TIERS) as AchievementCategory[]).every((c) =>
    TIERS[c].every((t, i) => i === 0 || t.threshold > TIERS[c][i - 1].threshold)
  )
);
check('every tier has 6 rungs', (Object.keys(TIERS) as AchievementCategory[]).every((c) => TIERS[c].length === 6));
check(
  'every tier has non-empty label and detail',
  allTiers.every((t) => t.label.trim().length > 0 && t.detail.trim().length > 0)
);

/* ---- empty history ---- */

console.log('\nEmpty history\n');

const empty = computeAchievements([], 4);
check('nothing unlocked with no sessions', empty.unlockedCount === 0);
check('total count is 30', empty.totalCount === 30, `${empty.totalCount}`);
check('nextUp has one entry per category (5)', empty.nextUp.length === 5, `${empty.nextUp.length}`);
check(
  'the nearest next-up is the lowest rung in every category',
  empty.nextUp.every((n) => n.tier.threshold === TIERS[n.tier.category][0].threshold)
);

/* ---- sessions tier crossing ---- */

console.log('\nSessions category\n');

const tenSessions = Array.from({ length: 10 }, (_, i) => session(i, [{ id: 'back_squat', weightKg: 60, reps: 5, sets: 3 }]));
const rTen = computeAchievements(tenSessions, 4);
check('10 sessions unlocks the 10-session tier', rTen.byCategory.sessions.find((a) => a.tier.threshold === 10)!.unlocked);
check('10 sessions does not unlock the 25-session tier', !rTen.byCategory.sessions.find((a) => a.tier.threshold === 25)!.unlocked);
check(
  'the 1-session tier was crossed on session 0, not session 9',
  rTen.byCategory.sessions.find((a) => a.tier.threshold === 1)!.achievedAt === tenSessions[0].completedAt
);
check(
  'the 10-session tier was crossed on the 10th session',
  rTen.byCategory.sessions.find((a) => a.tier.threshold === 10)!.achievedAt === tenSessions[9].completedAt
);

/* ---- volume tier crossing ---- */

console.log('\nVolume category\n');

// 60kg x 5 x 3 sets = 900kg/session; 12 sessions = 10,800kg — just past the 10,000 tier
const volSessions = Array.from({ length: 12 }, (_, i) => session(i, [{ id: 'back_squat', weightKg: 60, reps: 5, sets: 3 }]));
const rVol = computeAchievements(volSessions, 4);
check('total volume computed correctly', rVol.byCategory.volume[0].current === 10_800, `${rVol.byCategory.volume[0].current}`);
check('10,000kg tier unlocked', rVol.byCategory.volume.find((a) => a.tier.threshold === 10_000)!.unlocked);
check('50,000kg tier not unlocked', !rVol.byCategory.volume.find((a) => a.tier.threshold === 50_000)!.unlocked);

/* ---- exercises (range) category ---- */

console.log('\nExercises category\n');

const rangeSessions = [
  session(0, [{ id: 'back_squat', weightKg: 60, reps: 5, sets: 1 }, { id: 'bench_press', weightKg: 40, reps: 8, sets: 1 }]),
  session(1, [{ id: 'back_squat', weightKg: 60, reps: 5, sets: 1 }, { id: 'deadlift', weightKg: 80, reps: 5, sets: 1 }]),
];
const rRange = computeAchievements(rangeSessions, 4);
check(
  'distinct exercises counted, not total logged sets',
  rRange.byCategory.exercises[0].current === 3,
  `${rRange.byCategory.exercises[0].current}`
);

/* ---- records category ---- */

console.log('\nRecords category\n');

const prSessions = [
  session(0, [{ id: 'bench_press', weightKg: 60, reps: 5, sets: 1 }]), // baseline, not a PR
  session(7, [{ id: 'bench_press', weightKg: 65, reps: 5, sets: 1 }]), // beats it → PR 1
  session(14, [{ id: 'bench_press', weightKg: 65, reps: 5, sets: 1 }]), // ties → no new PR
  session(21, [{ id: 'bench_press', weightKg: 70, reps: 5, sets: 1 }]), // beats it → PR 2
];
const rPr = computeAchievements(prSessions, 4);
// the first time a lift is ever logged is a baseline, not a record — prTimeline
// deliberately excludes it, and the achievement count has to agree
check('the first log of a lift is a baseline, not a counted record', rPr.byCategory.records[0].current === 2, `${rPr.byCategory.records[0].current}`);
check('1-PR tier unlocked', rPr.byCategory.records.find((a) => a.tier.threshold === 1)!.unlocked);
check('5-PR tier not unlocked', !rPr.byCategory.records.find((a) => a.tier.threshold === 5)!.unlocked);
check(
  'the 1st record tier is dated to the session that actually set it, not the baseline session',
  rPr.byCategory.records.find((a) => a.tier.threshold === 1)!.achievedAt === prSessions[1].completedAt
);

/* ---- streak category ---- */

console.log('\nStreak category\n');

// four consecutive weeks, one session per week, 7 days apart
const streakSessions = [0, 7, 14, 21].map((d) => session(d, [{ id: 'back_squat', weightKg: 60, reps: 5, sets: 1 }]));
const rStreak = computeAchievements(streakSessions, 4, streakSessions[3].completedAt! + DAY);
check(
  '4 consecutive weeks unlocks the 4-week tier',
  rStreak.byCategory.streak.find((a) => a.tier.threshold === 4)!.unlocked
);
check(
  '4 consecutive weeks does not unlock the 8-week tier',
  !rStreak.byCategory.streak.find((a) => a.tier.threshold === 8)!.unlocked
);
check(
  'streak tiers carry no achievedAt (documented limitation, not a bug)',
  rStreak.byCategory.streak.every((a) => a.achievedAt === null)
);

/* ---- newlyUnlocked diff ---- */

console.log('\nnewlyUnlocked\n');

const before = computeAchievements(tenSessions.slice(0, 9), 4);
const after = computeAchievements(tenSessions, 4);
const gained = newlyUnlocked(before, after);
check('finishing the 10th session surfaces exactly the 10-session tier as newly unlocked', gained.length === 1 && gained[0].tier.id === 'sessions_10', gained.map((g) => g.tier.id).join(', '));
check('running the diff against itself yields nothing', newlyUnlocked(after, after).length === 0);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
