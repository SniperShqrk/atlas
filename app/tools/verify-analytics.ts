/**
 * Headless check for the ATLAS analytics + insight engines.
 *
 * Generates a realistic training history with a deliberate, known bias
 * (press-heavy, no rear delts, no hamstrings, no calves), runs the engines
 * over it, and asserts that the numbers and the findings match what was
 * actually put in. Also emits an SVG of the muscle-balance radar so the shape
 * can be rendered and looked at rather than guessed about.
 *
 *   npx tsx tools/verify-analytics.mts
 */
import fs from 'node:fs';
import path from 'node:path';

import type { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { getExerciseById } from '../src/data/exercises';
import {
  computeRangeMetrics,
  consistency,
  liftProgress,
  muscleBalance,
  balanceScore,
  prTimeline,
  rangeWindow,
  sessionsInWindow,
  setsPerMuscle,
  trainingDays,
  variety,
  weeklyBuckets,
  REGION_ORDER,
  REGION_SHORT,
} from '../src/store/analytics';
import { buildInsights } from '../src/store/insights';
import { radarGeometry, RADAR_MAX } from '../src/components/radarGeometry';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-05T18:00:00Z').getTime();

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ------------------------------------------------------------------ */
/* A synthetic lifter                                                   */
/* ------------------------------------------------------------------ */

/**
 * Four days a week for 24 weeks. Push and pull days are deliberately
 * lopsided: plenty of pressing, one row, no rear-delt work at all. Leg day is
 * quad-only — no hinge, no curl, no calves. Bench progresses steadily; squat
 * is parked at the same load for the last two months so the plateau detector
 * has something real to find.
 */
const DAYS: { name: string; lifts: { id: string; sets: number; base: number; reps: number }[] }[] = [
  {
    name: 'Push',
    lifts: [
      { id: 'barbell_bench_press', sets: 4, base: 70, reps: 8 },
      { id: 'incline_db_press', sets: 3, base: 26, reps: 10 },
      { id: 'overhead_press', sets: 3, base: 40, reps: 8 },
      { id: 'cable_fly', sets: 3, base: 18, reps: 14 },
      { id: 'triceps_pushdown', sets: 3, base: 30, reps: 12 },
    ],
  },
  {
    name: 'Pull',
    lifts: [
      { id: 'lat_pulldown', sets: 4, base: 60, reps: 10 },
      { id: 'barbell_row', sets: 3, base: 55, reps: 10 },
      { id: 'barbell_curl', sets: 3, base: 30, reps: 10 },
      { id: 'hammer_curl', sets: 3, base: 14, reps: 12 },
    ],
  },
  {
    name: 'Legs',
    lifts: [
      { id: 'back_squat', sets: 4, base: 90, reps: 6 },
      { id: 'leg_press', sets: 3, base: 150, reps: 12 },
      { id: 'leg_extension', sets: 3, base: 45, reps: 15 },
    ],
  },
  {
    name: 'Upper',
    lifts: [
      { id: 'incline_barbell_press', sets: 4, base: 55, reps: 8 },
      { id: 'seated_cable_row', sets: 3, base: 55, reps: 10 },
      { id: 'lateral_raise', sets: 4, base: 10, reps: 15 },
      { id: 'cable_crunch', sets: 3, base: 35, reps: 15 },
    ],
  },
];

function uid(n: number) {
  return `s${n}`;
}

function buildHistory(): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  const weeks = 24;
  let counter = 0;

  for (let w = weeks - 1; w >= 0; w -= 1) {
    // Monday / Tuesday / Thursday / Friday
    const offsets = [0, 1, 3, 4];
    for (let d = 0; d < DAYS.length; d += 1) {
      const day = DAYS[d];
      const at = NOW - w * 7 * DAY - (6 - offsets[d]) * DAY - 3 * 60 * 60 * 1000;
      if (at > NOW) continue;

      const weeksIn = weeks - 1 - w;
      const entries = day.lifts.map((lift) => {
        // steady linear progress, except the squat which stalls after week 16
        const progressWeeks =
          lift.id === 'back_squat' ? Math.min(weeksIn, 16) : weeksIn;
        const step = lift.base < 25 ? 0.25 : lift.base < 60 ? 0.6 : 1.0;
        const weightKg = Math.round((lift.base + progressWeeks * step) * 2) / 2;
        const sets: SetEntry[] = [];
        for (let s = 0; s < lift.sets; s += 1) {
          sets.push({
            id: uid(counter++),
            weightKg,
            reps: lift.reps - (s > 1 ? 1 : 0),
            completed: true,
          });
        }
        return { exerciseId: lift.id, sets };
      });

      sessions.push({
        id: uid(counter++),
        name: day.name,
        startedAt: at,
        completedAt: at + 62 * 60 * 1000,
        durationSec: 62 * 60,
        entries,
      });
    }
  }
  return sessions;
}

/* ------------------------------------------------------------------ */
/* Run                                                                  */
/* ------------------------------------------------------------------ */

const sessions = buildHistory();
console.log(`\nGenerated ${sessions.length} sessions across 24 weeks.\n`);

console.log('Sanity — every referenced exercise exists');
const missing = new Set<string>();
for (const s of sessions) {
  for (const e of s.entries) if (!getExerciseById(e.exerciseId)) missing.add(e.exerciseId);
}
check('all exercise ids resolve', missing.size === 0, [...missing].join(', '));

console.log('\nRange metrics');
for (const range of ['7D', '30D', '90D', 'ALL'] as const) {
  const w = rangeWindow(sessions, range, NOW);
  const m = computeRangeMetrics(sessions, w);
  console.log(
    `  ${range.padEnd(4)} ${String(m.sessionCount).padStart(3)} sessions  ` +
      `${String(m.totalSets).padStart(4)} sets  ` +
      `${m.totalVolumeKg.toLocaleString().padStart(9)}kg  ` +
      `${m.sessionsPerWeek}/wk`
  );
}

const w30 = rangeWindow(sessions, '30D', NOW);
const m30 = computeRangeMetrics(sessions, w30);
const w7 = rangeWindow(sessions, '7D', NOW);
const m7 = computeRangeMetrics(sessions, w7);
const wAll = rangeWindow(sessions, 'ALL', NOW);
const mAll = computeRangeMetrics(sessions, wAll);

check('7D holds ~4 sessions', m7.sessionCount === 4, `got ${m7.sessionCount}`);
check('30D holds 16-20 sessions', m30.sessionCount >= 16 && m30.sessionCount <= 20, `got ${m30.sessionCount}`);
check('ALL holds every session', mAll.sessionCount === sessions.length);
check('ranges nest correctly', m7.totalSets <= m30.totalSets && m30.totalSets <= mAll.totalSets);
check('volume is positive', m30.totalVolumeKg > 0);
check('sessions/week is ~4', Math.abs(m30.sessionsPerWeek - 4) < 1, `got ${m30.sessionsPerWeek}`);
check('duration averages 62 min', m30.avgDurationMin === 62, `got ${m30.avgDurationMin}`);

// hand-computed cross-check of one week's set count
const perDaySets = DAYS.map((d) => d.lifts.reduce((n, l) => n + l.sets, 0));
const expectedWeekSets = perDaySets.reduce((a, b) => a + b, 0);
check(
  `7D set total matches the plan (${expectedWeekSets})`,
  m7.totalSets === expectedWeekSets,
  `got ${m7.totalSets}`
);

console.log('\nMuscle balance (30D)');
const balance = muscleBalance(sessions, w30);
for (const b of balance) {
  const bar = '█'.repeat(Math.round(b.ratio * 18));
  console.log(
    `  ${REGION_SHORT[b.region].padEnd(7)} ${String(b.setsPerWeek).padStart(5)}/wk  ` +
      `target ${String(b.target).padStart(4)}  ratio ${b.ratio.toFixed(2).padStart(5)}  ` +
      `${b.status.padEnd(10)} ${bar}`
  );
}
const score = balanceScore(balance);
console.log(`  balance score: ${score}`);

const byRegion = Object.fromEntries(balance.map((b) => [b.region, b]));
check('radar has 8 spokes in fixed order', balance.length === REGION_ORDER.length);
check('chest is well trained', byRegion.chest.ratio > 0.7, `ratio ${byRegion.chest.ratio}`);
check(
  'calves flagged neglected (none programmed)',
  byRegion.calves.status === 'neglected' && byRegion.calves.setsPerWeek === 0
);
check(
  'hams/glutes under target (squats give glutes but no hinge or curl)',
  byRegion.posterior.ratio < 0.7 && byRegion.posterior.status !== 'on_target',
  `ratio ${byRegion.posterior.ratio}`
);
check(
  'delts and arms read as on target, not starved',
  byRegion.shoulders.status === 'on_target' && byRegion.arms.status === 'on_target',
  `delts ${byRegion.shoulders.ratio.toFixed(2)}, arms ${byRegion.arms.ratio.toFixed(2)}`
);
check('balance score is penalised', score < 75, `score ${score}`);

console.log('\nPer-muscle sets (30D, top 8)');
const perMuscle = setsPerMuscle(sessionsInWindow(sessions, w30));
Object.entries(perMuscle)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .forEach(([m, n]) => console.log(`  ${m.padEnd(14)} ${n}`));
// rows and squats feed rear delts and hamstrings indirectly, so these are not
// zero — but they should be a small fraction of the muscles they oppose
check(
  'rear delts get a fraction of front delts',
  perMuscle.rear_delts < perMuscle.front_delts / 2.5,
  `${perMuscle.rear_delts} vs ${perMuscle.front_delts}`
);
check(
  'hamstrings get a fraction of quads',
  perMuscle.hamstrings < perMuscle.quads / 2.2,
  `${perMuscle.hamstrings} vs ${perMuscle.quads}`
);
check('no calf work at all', (perMuscle.calves ?? 0) === 0, `${perMuscle.calves}`);
check('chest is the most trained muscle', perMuscle.chest === Math.max(...Object.values(perMuscle)));

console.log('\nLift progress (90D)');
const w90 = rangeWindow(sessions, '90D', NOW);
const progress = liftProgress(sessions, w90, NOW, 3);
progress
  .slice()
  .sort((a, b) => b.deltaKg - a.deltaKg)
  .slice(0, 6)
  .forEach((p) =>
    console.log(
      `  ${p.name.padEnd(24)} ${String(p.first.e1rm).padStart(4)} → ${String(p.last.e1rm).padStart(4)}kg  ` +
        `${p.deltaKg >= 0 ? '+' : ''}${p.deltaKg}kg  ${p.stalled ? 'STALLED' : ''}`
    )
  );
const squat = progress.find((p) => p.exerciseId === 'back_squat');
const bench = progress.find((p) => p.exerciseId === 'barbell_bench_press');
check('squat detected as stalled', !!squat?.stalled, squat ? `since ${squat.sessionsSinceBest} sessions` : 'not found');
check('bench detected as progressing', !!bench && bench.deltaKg > 0 && !bench.stalled);

console.log('\nPersonal records');
const prs = prTimeline(sessions);
console.log(`  ${prs.length} PR events; most recent: ${prs[0]?.name} ${prs[0]?.weightKg}kg × ${prs[0]?.reps}`);
check('PRs were detected', prs.length > 10);
check('PRs are newest-first', prs.every((e, i) => i === 0 || prs[i - 1].at >= e.at));
check(
  'a stalled squat sets no recent PRs',
  !prs.slice(0, 20).some((e) => e.exerciseId === 'back_squat')
);

console.log('\nConsistency');
const c = consistency(sessions, 4, NOW);
console.log(`  streak ${c.weekStreak}w · longest ${c.longestWeekStreak}w · adherence ${c.adherencePct}% · ${c.daysSinceLast}d since last`);
check('streak reflects 24 unbroken weeks', c.weekStreak >= 23, `got ${c.weekStreak}`);
check('adherence is high', c.adherencePct >= 90, `got ${c.adherencePct}`);

const days = trainingDays(sessions, 12, NOW);
check('training grid is a whole number of weeks', days.length % 7 === 0, `${days.length}`);
check('training grid has sessions in it', days.filter((d) => d.sets > 0).length >= 40);

const buckets = weeklyBuckets(sessions, w90);
console.log(`  weekly buckets: ${buckets.length}, last = ${buckets[buckets.length - 1]?.sessions} sessions`);
check('weekly buckets are contiguous and ordered', buckets.every((b, i) => i === 0 || b.weekStart > buckets[i - 1].weekStart));

const v = variety(sessionsInWindow(sessions, w30));
console.log(`  variety: ${v.distinctExercises} exercises, top5 ${v.top5SharePct}%, compound ${v.compoundSharePct}%`);
check('variety counts every programmed exercise', v.distinctExercises === new Set(DAYS.flatMap((d) => d.lifts.map((l) => l.id))).size);

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

console.log('\nInsights (30D)');
const report = buildInsights(sessions, { range: '30D', targetDaysPerWeek: 4, now: NOW });
check('report has enough data', report.hasEnoughData);
check('there is a curiosity headline', !!report.headline);
check(
  'exactly one finding is revealed free',
  report.free.filter((i) => i.severity !== 'good').length === 1,
  `${report.free.filter((i) => i.severity !== 'good').length}`
);
check(
  'all good news is free — praise is never paywalled',
  report.all.filter((i) => i.severity === 'good').every((i) => report.free.includes(i))
);
check(
  'nothing good is in the locked set',
  report.locked.every((i) => i.severity !== 'good')
);
check('there are locked insights to sell', report.locked.length >= 3, `${report.locked.length}`);
check(
  'free + locked accounts for everything',
  report.free.length + report.locked.length === report.all.length
);
check('the free insight is the most severe finding', report.free[0].severity !== 'good');

console.log(`\n  HEADLINE: ${report.headline?.praise}.`);
console.log(`  However — ${report.headline?.tease}\n`);
for (const i of report.all) {
  const gate = report.free.includes(i) ? 'free  ' : 'LOCKED';
  console.log(`  [${gate}] ${i.severity.toUpperCase().padEnd(5)} ${i.headline}`);
  console.log(`           ${i.preview}`);
}

const ids = report.all.map((i) => i.id);
console.log();
check('neglect detected for calves or posterior', ids.some((id) => id.startsWith('neglect:')));
check(
  'no false push/pull alarm — this lifter does row and curl',
  !ids.includes('ratio:push_pull')
);
check('front/rear delt imbalance detected', ids.includes('ratio:delts'));
check('quad/hamstring imbalance detected', ids.includes('ratio:legs'));
check('squat plateau surfaced', ids.some((id) => id.startsWith('plateau:')));
check('every insight carries a paid payload', report.all.every((i) => i.detail.length > 0 && i.action.length > 0));
check('ids are unique', new Set(ids).size === ids.length);
check('insights are ranked by weight', report.all.every((i, n) => n === 0 || report.all[n - 1].weight >= i.weight));

console.log('\nSecond fixture — a press-only lifter');
const pressOnly: WorkoutSession[] = [];
for (let i = 0; i < 16; i += 1) {
  const at = NOW - i * 2 * DAY - 3 * 60 * 60 * 1000;
  pressOnly.push({
    id: `p${i}`,
    name: 'Push',
    startedAt: at,
    completedAt: at + 3600 * 1000,
    durationSec: 3600,
    entries: ['barbell_bench_press', 'incline_db_press', 'overhead_press', 'triceps_pushdown'].map(
      (id) => ({
        exerciseId: id,
        sets: [0, 1, 2, 3].map((n) => ({
          id: `${id}-${i}-${n}`,
          weightKg: 60,
          reps: 8,
          completed: true,
        })),
      })
    ),
  });
}
const pressReport = buildInsights(pressOnly, { range: '30D', targetDaysPerWeek: 4, now: NOW });
const pressIds = pressReport.all.map((i) => i.id);
console.log(`  ${pressIds.join(', ')}`);
check('push/pull imbalance detected on a press-only lifter', pressIds.includes('ratio:push_pull'));
check('back neglect detected on a press-only lifter', pressIds.includes('neglect:back'));
const pushPull = pressReport.all.find((i) => i.id === 'ratio:push_pull');
console.log(`  "${pushPull?.headline}" — ${pushPull?.preview}`);
check(
  'the push/pull preview quotes a ratio, or names the zero-pull case',
  /\d+(\.\d+)?:1/.test(pushPull?.preview ?? '') ||
    /no pulling work at all/.test(pushPull?.preview ?? '')
);

console.log('\nEmpty and thin histories');
const empty = buildInsights([], { now: NOW });
check('empty history yields no insights', !empty.hasEnoughData && empty.all.length === 0);
check('empty history still yields a radar', empty.balance.length === 8);
const thin = buildInsights(sessions.slice(-2), { now: NOW });
check('two sessions is below the bar', !thin.hasEnoughData);
const emptyMetrics = computeRangeMetrics([], rangeWindow([], '30D', NOW));
check('empty metrics do not divide by zero', Number.isFinite(emptyMetrics.avgSetsPerSession) && emptyMetrics.sessionCount === 0);

/* ------------------------------------------------------------------ */
/* Radar geometry → SVG for visual inspection                          */
/* ------------------------------------------------------------------ */

const SIZE = 320;
const geo = radarGeometry(balance.map((b) => b.ratio), SIZE, 40);
check('geometry produces one vertex per region', geo.valuePoints.length === 8);
check('geometry clips at the outer ring', geo.plotted.every((p) => p <= RADAR_MAX + 1e-9));
check(
  'a zero region sits exactly at the centre',
  (() => {
    const i = balance.findIndex((b) => b.setsPerWeek === 0);
    return i < 0 || (Math.abs(geo.valuePoints[i].x - geo.cx) < 0.01 && Math.abs(geo.valuePoints[i].y - geo.cy) < 0.01);
  })()
);
check('all vertices sit inside the canvas', geo.valuePoints.every((p) => p.x >= 0 && p.y >= 0 && p.x <= SIZE && p.y <= SIZE));

const C = {
  bg: '#0D0D0E',
  card: '#181715',
  border: '#2A2825',
  bronze: '#C08A3E',
  accent: '#B4472F',
  marbleLight: '#EDEAE3',
  marbleMid: '#C9C5BC',
  textDim: '#8C887F',
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <radialGradient id="fill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.marbleLight}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${C.marbleMid}" stop-opacity="0.08"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${C.card}"/>
  ${geo.rings
    .map(
      (r) =>
        `<polygon points="${r.points}" fill="none" stroke="${r.value === 1 ? C.bronze : C.border}" stroke-width="${r.value === 1 ? 1.1 : 1}"${r.value === 1 ? ' stroke-dasharray="3 4" opacity="0.75"' : ''}/>`
    )
    .join('\n  ')}
  ${geo.axes.map((a) => `<line x1="${geo.cx}" y1="${geo.cy}" x2="${a.x}" y2="${a.y}" stroke="${C.border}"/>`).join('\n  ')}
  <polygon points="${geo.polygon}" fill="url(#fill)" stroke="${C.marbleLight}" stroke-width="1.8" stroke-linejoin="round"/>
  ${geo.valuePoints
    .map((p, i) => {
      const s = balance[i].status;
      const tone = s === 'neglected' ? C.accent : s === 'high' ? C.bronze : C.marbleLight;
      return `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="${tone}"/>`;
    })
    .join('\n  ')}
  ${geo.axes
    .map(
      (a, i) =>
        `<text x="${a.labelX}" y="${a.labelY + 3.5}" fill="${balance[i].status === 'neglected' ? C.accent : C.textDim}" font-size="9.5" font-weight="700" font-family="system-ui,sans-serif" text-anchor="${a.anchor}">${REGION_SHORT[balance[i].region]}</text>`
    )
    .join('\n  ')}
</svg>`;

const outDir = path.resolve(process.cwd(), '../.verify');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'radar.svg'), svg);
fs.writeFileSync(
  path.join(outDir, 'radar.json'),
  JSON.stringify({ balance, score, geometry: geo }, null, 2)
);
console.log(`\nWrote ${path.join(outDir, 'radar.svg')}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
