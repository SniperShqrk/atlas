/**
 * Dumps everything the ATLAS Progress screen renders, for every time range,
 * as JSON — so the browser preview shows the real output of the real engine
 * rather than a designer's guess at what it might say.
 *
 *   npx tsx tools/dump-preview.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import type { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { getExerciseById, MUSCLE_LABELS, MuscleGroup } from '../src/data/exercises';
import { WEEKLY_SET_TARGETS } from '../src/store/progression';
import {
  TIME_RANGES,
  RANGE_LABELS,
  TimeRange,
  computeRangeMetrics,
  consistency,
  liftProgress,
  liftSeries,
  muscleBalance,
  balanceScore,
  pctChange,
  prTimeline,
  previousWindow,
  rangeWindow,
  sessionsInWindow,
  setsPerMuscle,
  trackedLifts,
  trainingDays,
  variety,
  weeklyBuckets,
  REGION_SHORT,
} from '../src/store/analytics';
import { buildInsights } from '../src/store/insights';
import { radarGeometry } from '../src/components/radarGeometry';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-05T18:00:00Z').getTime();

/**
 * The same fixture the verification harness uses: 24 weeks, four days a week,
 * press-heavy, no rear delts, no hinge, no calves, and a squat parked at the
 * same load since week 16.
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

function buildHistory(): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  const weeks = 24;
  let counter = 0;
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const offsets = [0, 1, 3, 4];
    for (let d = 0; d < DAYS.length; d += 1) {
      const day = DAYS[d];
      const at = NOW - w * 7 * DAY - (6 - offsets[d]) * DAY - 3 * 60 * 60 * 1000;
      if (at > NOW) continue;
      const weeksIn = weeks - 1 - w;
      const entries = day.lifts.map((lift) => {
        const progressWeeks = lift.id === 'back_squat' ? Math.min(weeksIn, 16) : weeksIn;
        const step = lift.base < 25 ? 0.25 : lift.base < 60 ? 0.6 : 1.0;
        const weightKg = Math.round((lift.base + progressWeeks * step) * 2) / 2;
        const sets: SetEntry[] = [];
        for (let s = 0; s < lift.sets; s += 1) {
          sets.push({
            id: `s${counter++}`,
            weightKg,
            reps: lift.reps - (s > 1 ? 1 : 0),
            completed: true,
          });
        }
        return { exerciseId: lift.id, sets };
      });
      sessions.push({
        id: `s${counter++}`,
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

const sessions = buildHistory();
const TARGET_DAYS = 4;
const RADAR_SIZE = 272;

const payload: Record<string, unknown> = {
  now: NOW,
  ranges: TIME_RANGES,
  rangeLabels: RANGE_LABELS,
  regionShort: REGION_SHORT,
  consistency: consistency(sessions, TARGET_DAYS, NOW),
  trainingDays: trainingDays(sessions, 12, NOW),
  byRange: {},
};

for (const range of TIME_RANGES as TimeRange[]) {
  const w = rangeWindow(sessions, range, NOW);
  const inWindow = sessionsInWindow(sessions, w);
  const metrics = computeRangeMetrics(sessions, w);
  const prev = computeRangeMetrics(sessions, previousWindow(w));
  const balance = muscleBalance(sessions, w);
  const perMuscle = setsPerMuscle(inWindow);
  const weeks = Math.max(w.days / 7, 1 / 7);
  const lifts = trackedLifts(inWindow, 8);

  (payload.byRange as Record<string, unknown>)[range] = {
    metrics,
    deltas: {
      volume: pctChange(metrics.totalVolumeKg, prev.totalVolumeKg),
      sets: pctChange(metrics.totalSets, prev.totalSets),
    },
    balance,
    balanceScore: balanceScore(balance),
    radar: radarGeometry(
      balance.map((b) => b.ratio),
      RADAR_SIZE
    ),
    insights: buildInsights(sessions, { range, targetDaysPerWeek: TARGET_DAYS, now: NOW }),
    movers: liftProgress(sessions, w, NOW, 3)
      .slice()
      .sort((a, b) => b.deltaKg - a.deltaKg)
      .slice(0, 5),
    weekly: weeklyBuckets(sessions, w),
    prs: prTimeline(sessions)
      .filter((e) => e.at >= w.from && e.at <= w.to)
      .slice(0, 6),
    landmarks: (Object.keys(WEEKLY_SET_TARGETS) as MuscleGroup[])
      .map((m) => ({
        muscle: m,
        label: MUSCLE_LABELS[m],
        sets: Math.round(((perMuscle[m] ?? 0) / weeks) * 10) / 10,
        maintenance: WEEKLY_SET_TARGETS[m].maintenance,
        growth: WEEKLY_SET_TARGETS[m].growth,
      }))
      .sort((a, b) => b.sets - a.sets),
    lifts: lifts.map((id) => ({
      id,
      name: getExerciseById(id)?.name ?? id,
      series: liftSeries(inWindow, id),
    })),
    variety: variety(inWindow),
  };
}

const out = path.resolve(process.cwd(), '../preview/atlas-progress-data.json');
fs.writeFileSync(out, JSON.stringify(payload));
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
