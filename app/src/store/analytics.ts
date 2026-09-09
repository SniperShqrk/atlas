import {
  Exercise,
  MuscleGroup,
  MUSCLE_LABELS,
  getExerciseById,
} from '@/data/exercises';
import type { WorkoutSession } from '@/store/workoutStore';
import { estimate1RM } from '@/store/formulas';
import { WEEKLY_SET_TARGETS } from '@/store/progression';

/**
 * ATLAS — analytics engine.
 *
 * Everything in this file is a pure function of the user's logged sessions.
 * No network, no model calls, no stored derived state: the Progress screen and
 * the insight engine both read from here, which keeps the numbers consistent
 * and keeps the running cost of "intelligence" at zero.
 */

/* ------------------------------------------------------------------ */
/* Time ranges                                                         */
/* ------------------------------------------------------------------ */

export type TimeRange = '7D' | '30D' | '90D' | '1Y' | 'ALL';

export const TIME_RANGES: TimeRange[] = ['7D', '30D', '90D', '1Y', 'ALL'];

export const RANGE_LABELS: Record<TimeRange, string> = {
  '7D': '7D',
  '30D': '30D',
  '90D': '90D',
  '1Y': '1Y',
  ALL: 'All',
};

const DAY = 24 * 60 * 60 * 1000;

export const RANGE_DAYS: Record<TimeRange, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
  ALL: Infinity,
};

export function sessionTime(s: WorkoutSession): number {
  return s.completedAt ?? s.startedAt;
}

export interface Window {
  from: number;
  to: number;
  /** length of the window in days, always finite */
  days: number;
}

/**
 * The window a range covers. For ALL this runs from the first logged session,
 * so "all time" on a two-week-old account doesn't pretend to be a year.
 */
export function rangeWindow(
  sessions: WorkoutSession[],
  range: TimeRange,
  now: number = Date.now()
): Window {
  if (range === 'ALL') {
    const first = sessions.length
      ? Math.min(...sessions.map(sessionTime))
      : now - 7 * DAY;
    return { from: first, to: now, days: Math.max(1, (now - first) / DAY) };
  }
  const days = RANGE_DAYS[range];
  return { from: now - days * DAY, to: now, days };
}

/** The equally-long window immediately before this one, for period comparison. */
export function previousWindow(w: Window): Window {
  const span = w.to - w.from;
  return { from: w.from - span, to: w.from, days: w.days };
}

export function sessionsInWindow(sessions: WorkoutSession[], w: Window): WorkoutSession[] {
  return sessions
    .filter((s) => {
      const t = sessionTime(s);
      return t >= w.from && t <= w.to;
    })
    .sort((a, b) => sessionTime(a) - sessionTime(b));
}

/* ------------------------------------------------------------------ */
/* Muscle regions — the radar's eight spokes                           */
/* ------------------------------------------------------------------ */

export type MuscleRegion =
  | 'chest'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'calves'
  | 'posterior'
  | 'quads'
  | 'back';

/**
 * Clockwise from the top. Upper-body pressing sits on the right, legs across
 * the bottom, back on the upper left — so a lopsided polygon is legible as a
 * real training bias rather than an artefact of the ordering.
 */
export const REGION_ORDER: MuscleRegion[] = [
  'chest',
  'shoulders',
  'arms',
  'core',
  'calves',
  'posterior',
  'quads',
  'back',
];

export const REGION_LABELS: Record<MuscleRegion, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  calves: 'Calves',
  posterior: 'Hams / Glutes',
  quads: 'Quads',
  back: 'Back',
};

/** Short enough that the horizontal spokes still fit inside the canvas. */
export const REGION_SHORT: Record<MuscleRegion, string> = {
  chest: 'CHEST',
  shoulders: 'DELTS',
  arms: 'ARMS',
  core: 'CORE',
  calves: 'CALF',
  posterior: 'POST',
  quads: 'QUAD',
  back: 'BACK',
};

export const REGION_MUSCLES: Record<MuscleRegion, MuscleGroup[]> = {
  chest: ['chest'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abs', 'obliques'],
  calves: ['calves'],
  posterior: ['hamstrings', 'glutes'],
  quads: ['quads'],
  back: ['lats', 'traps', 'lower_back'],
};

export const MUSCLE_TO_REGION: Record<MuscleGroup, MuscleRegion> = (() => {
  const map = {} as Record<MuscleGroup, MuscleRegion>;
  for (const region of REGION_ORDER) {
    for (const m of REGION_MUSCLES[region]) map[m] = region;
  }
  return map;
})();

/**
 * Weekly working-set target per region.
 *
 * These are set by hand rather than summed from the per-muscle landmarks,
 * because set counting is not additive across a region: one barbell row feeds
 * lats, traps and rear delts at the same time, so adding those three targets
 * together asks for roughly twice the volume any real programme contains and
 * would show almost every lifter as under-trained everywhere. Each figure
 * below is the midpoint of what a region actually needs per week counting
 * primary work as one set and secondary as half.
 */
export const REGION_WEEKLY_TARGET: Record<MuscleRegion, number> = {
  chest: 15,
  shoulders: 20,
  arms: 22,
  core: 12,
  calves: 12,
  posterior: 18,
  quads: 15,
  back: 22,
};

/* ------------------------------------------------------------------ */
/* Set / volume accounting                                             */
/* ------------------------------------------------------------------ */

/** A completed, non-warm-up set. Warm-ups are logged but never counted. */
function isWorkingSet(s: { completed: boolean; warmup?: boolean }): boolean {
  return s.completed && !s.warmup;
}

export interface SessionTotals {
  sets: number;
  reps: number;
  volumeKg: number;
  exercises: number;
}

export function sessionTotals(session: WorkoutSession): SessionTotals {
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  for (const entry of session.entries) {
    for (const s of entry.sets) {
      if (!isWorkingSet(s)) continue;
      sets += 1;
      reps += s.reps;
      volumeKg += s.weightKg * s.reps;
    }
  }
  return { sets, reps, volumeKg, exercises: session.entries.length };
}

/**
 * Working sets per muscle across a window. Secondary involvement counts as
 * half a set — the usual convention, and the one the volume landmarks assume.
 */
export function setsPerMuscle(sessions: WorkoutSession[]): Record<MuscleGroup, number> {
  const counts = {} as Record<MuscleGroup, number>;
  for (const m of Object.keys(WEEKLY_SET_TARGETS) as MuscleGroup[]) counts[m] = 0;

  for (const session of sessions) {
    for (const entry of session.entries) {
      const ex = getExerciseById(entry.exerciseId);
      if (!ex) continue;
      const sets = entry.sets.filter(isWorkingSet).length;
      if (!sets) continue;
      for (const m of ex.primaryMuscles) counts[m] = (counts[m] ?? 0) + sets;
      for (const m of ex.secondaryMuscles) counts[m] = (counts[m] ?? 0) + sets * 0.5;
    }
  }
  for (const k of Object.keys(counts) as MuscleGroup[]) {
    counts[k] = Math.round(counts[k] * 10) / 10;
  }
  return counts;
}

export function setsPerRegion(
  perMuscle: Record<MuscleGroup, number>
): Record<MuscleRegion, number> {
  const out = {} as Record<MuscleRegion, number>;
  for (const region of REGION_ORDER) {
    out[region] =
      Math.round(
        REGION_MUSCLES[region].reduce((sum, m) => sum + (perMuscle[m] ?? 0), 0) * 10
      ) / 10;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The radar                                                           */
/* ------------------------------------------------------------------ */

export interface RegionBalance {
  region: MuscleRegion;
  label: string;
  /** working sets per week, averaged across the window */
  setsPerWeek: number;
  /** the weekly target this region is measured against */
  target: number;
  /** setsPerWeek / target — 1.0 means squarely in the growth range */
  ratio: number;
  status: 'neglected' | 'light' | 'on_target' | 'high';
}

/**
 * The muscle-balance polygon. Values are normalised against each region's own
 * weekly target, so the shape is directly readable: a smooth octagon touching
 * the target ring is balanced training, and a spike or a dent is a real bias
 * rather than an artefact of some regions simply being bigger.
 */
export function muscleBalance(
  sessions: WorkoutSession[],
  w: Window
): RegionBalance[] {
  const inWindow = sessionsInWindow(sessions, w);
  const weeks = Math.max(w.days / 7, 1 / 7);
  const perMuscle = setsPerMuscle(inWindow);
  const perRegion = setsPerRegion(perMuscle);

  return REGION_ORDER.map((region) => {
    const setsPerWeek = Math.round((perRegion[region] / weeks) * 10) / 10;
    const target = REGION_WEEKLY_TARGET[region];
    const ratio = target > 0 ? setsPerWeek / target : 0;
    const status: RegionBalance['status'] =
      ratio < 0.35 ? 'neglected' : ratio < 0.7 ? 'light' : ratio <= 1.3 ? 'on_target' : 'high';
    return { region, label: REGION_LABELS[region], setsPerWeek, target, ratio, status };
  });
}

/** How even the training is, 0–100. 100 means every region sits on target. */
export function balanceScore(balance: RegionBalance[]): number {
  if (!balance.length) return 0;
  // distance from 1.0, but overshooting is penalised less than neglect
  const penalty =
    balance.reduce((sum, b) => {
      const d = b.ratio < 1 ? 1 - b.ratio : (b.ratio - 1) * 0.5;
      return sum + Math.min(1, d);
    }, 0) / balance.length;
  return Math.max(0, Math.round((1 - penalty) * 100));
}

/* ------------------------------------------------------------------ */
/* Cold-start preview                                                  */
/* ------------------------------------------------------------------ */

/**
 * Example data for the Progress screen before the user has logged enough
 * (or any) sessions. Same shapes the real analytics produce, so the preview
 * renders through the exact same chart components rather than a bespoke
 * mock — it just never reaches a caller that treats it as real, and the
 * screen labels it EXAMPLE everywhere it's shown.
 */
const SAMPLE_RATIOS: Record<MuscleRegion, number> = {
  chest: 1.1,
  shoulders: 0.65,
  arms: 0.9,
  core: 0.7,
  calves: 0.5,
  posterior: 1.2,
  quads: 1.05,
  back: 0.95,
};

export function sampleBalance(): RegionBalance[] {
  return REGION_ORDER.map((region) => {
    const ratio = SAMPLE_RATIOS[region];
    const target = REGION_WEEKLY_TARGET[region];
    const setsPerWeek = Math.round(ratio * target * 10) / 10;
    const status: RegionBalance['status'] =
      ratio < 0.35 ? 'neglected' : ratio < 0.7 ? 'light' : ratio <= 1.3 ? 'on_target' : 'high';
    return { region, label: REGION_LABELS[region], setsPerWeek, target, ratio, status };
  });
}

/** A steady four-week strength climb, for the Strength Trend preview. */
export function sampleTrendPoints(now = Date.now()): { at: number; e1rm: number }[] {
  const day = 86_400_000;
  const values = [100, 103, 104, 108, 112];
  return values.map((e1rm, i) => ({ at: now - (values.length - 1 - i) * 7 * day, e1rm }));
}

/** Six weeks of rising, slightly uneven volume, for the Volume by Week preview. */
export function sampleVolumeBars(): { label: string; value: number }[] {
  return [3200, 3600, 3400, 4100, 4400, 4300].map((value, i) => ({ label: `W${i + 1}`, value }));
}

/* ------------------------------------------------------------------ */
/* Headline metrics                                                    */
/* ------------------------------------------------------------------ */

export interface RangeMetrics {
  window: Window;
  sessionCount: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  /** distinct calendar days with a logged session */
  activeDays: number;
  sessionsPerWeek: number;
  avgSetsPerSession: number;
  avgVolumePerSession: number;
  avgDurationMin: number;
  /** the heaviest single set logged in the window */
  topSet: { exerciseId: string; weightKg: number; reps: number; at: number } | null;
}

export function computeRangeMetrics(sessions: WorkoutSession[], w: Window): RangeMetrics {
  const inWindow = sessionsInWindow(sessions, w);
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;
  let durationSum = 0;
  let durationCount = 0;
  const days = new Set<string>();
  let topSet: RangeMetrics['topSet'] = null;

  for (const s of inWindow) {
    const t = sessionTotals(s);
    totalSets += t.sets;
    totalReps += t.reps;
    totalVolumeKg += t.volumeKg;
    if (s.durationSec) {
      durationSum += s.durationSec;
      durationCount += 1;
    }
    days.add(new Date(sessionTime(s)).toDateString());

    for (const entry of s.entries) {
      for (const set of entry.sets) {
        if (!isWorkingSet(set)) continue;
        if (!topSet || set.weightKg > topSet.weightKg) {
          topSet = {
            exerciseId: entry.exerciseId,
            weightKg: set.weightKg,
            reps: set.reps,
            at: sessionTime(s),
          };
        }
      }
    }
  }

  const weeks = Math.max(w.days / 7, 1 / 7);
  return {
    window: w,
    sessionCount: inWindow.length,
    totalSets,
    totalReps,
    totalVolumeKg: Math.round(totalVolumeKg),
    activeDays: days.size,
    sessionsPerWeek: Math.round((inWindow.length / weeks) * 10) / 10,
    avgSetsPerSession: inWindow.length ? Math.round((totalSets / inWindow.length) * 10) / 10 : 0,
    avgVolumePerSession: inWindow.length ? Math.round(totalVolumeKg / inWindow.length) : 0,
    avgDurationMin: durationCount ? Math.round(durationSum / durationCount / 60) : 0,
    topSet,
  };
}

/** Percentage change between two numbers, guarding the zero baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/* ------------------------------------------------------------------ */
/* Frequency, streaks and consistency                                  */
/* ------------------------------------------------------------------ */

export interface WeekBucket {
  /** midnight Monday of the week */
  weekStart: number;
  label: string;
  sessions: number;
  sets: number;
  volumeKg: number;
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** Sessions bucketed by week, oldest first — the frequency and volume charts. */
export function weeklyBuckets(
  sessions: WorkoutSession[],
  w: Window,
  maxWeeks = 26
): WeekBucket[] {
  const inWindow = sessionsInWindow(sessions, w);
  const firstWeek = startOfWeek(w.from);
  const lastWeek = startOfWeek(w.to);
  const buckets = new Map<number, WeekBucket>();

  for (let t = firstWeek; t <= lastWeek; t += 7 * DAY) {
    buckets.set(t, {
      weekStart: t,
      label: new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      sessions: 0,
      sets: 0,
      volumeKg: 0,
    });
  }

  for (const s of inWindow) {
    const key = startOfWeek(sessionTime(s));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const totals = sessionTotals(s);
    bucket.sessions += 1;
    bucket.sets += totals.sets;
    bucket.volumeKg += totals.volumeKg;
  }

  const all = [...buckets.values()].sort((a, b) => a.weekStart - b.weekStart);
  return all.slice(Math.max(0, all.length - maxWeeks));
}

export interface ConsistencyStats {
  /** consecutive weeks, ending with this one, containing at least one session */
  weekStreak: number;
  /** consecutive days since the last session */
  daysSinceLast: number | null;
  /** share of the last 8 weeks that hit the user's target days/week */
  adherencePct: number;
  /** longest run of weeks ever trained */
  longestWeekStreak: number;
}

export function consistency(
  sessions: WorkoutSession[],
  targetDaysPerWeek: number,
  now: number = Date.now()
): ConsistencyStats {
  if (!sessions.length) {
    return { weekStreak: 0, daysSinceLast: null, adherencePct: 0, longestWeekStreak: 0 };
  }

  const weeks = new Map<number, number>();
  for (const s of sessions) {
    const key = startOfWeek(sessionTime(s));
    weeks.set(key, (weeks.get(key) ?? 0) + 1);
  }

  // current streak, walking back from this week
  const thisWeek = startOfWeek(now);
  let weekStreak = 0;
  for (let t = thisWeek; ; t -= 7 * DAY) {
    if (weeks.has(t)) weekStreak += 1;
    // the current week is allowed to be empty without breaking the streak
    else if (t !== thisWeek) break;
    else continue;
  }

  // longest streak ever
  const keys = [...weeks.keys()].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of keys) {
    run = prev !== null && k - prev === 7 * DAY ? run + 1 : 1;
    prev = k;
    longest = Math.max(longest, run);
  }

  const lastAt = Math.max(...sessions.map(sessionTime));
  const daysSinceLast = Math.floor((now - lastAt) / DAY);

  // adherence over the last 8 complete weeks
  let hit = 0;
  let counted = 0;
  for (let i = 1; i <= 8; i += 1) {
    const wk = thisWeek - i * 7 * DAY;
    if (wk < startOfWeek(Math.min(...sessions.map(sessionTime)))) break;
    counted += 1;
    if ((weeks.get(wk) ?? 0) >= targetDaysPerWeek) hit += 1;
  }

  return {
    weekStreak,
    daysSinceLast,
    adherencePct: counted ? Math.round((hit / counted) * 100) : 0,
    longestWeekStreak: longest,
  };
}

/** Day-by-day training dots for the calendar heatmap, oldest first. */
export function trainingDays(
  sessions: WorkoutSession[],
  weeksBack: number,
  now: number = Date.now()
): { at: number; sets: number }[] {
  const byDay = new Map<number, number>();
  for (const s of sessions) {
    const d = new Date(sessionTime(s));
    d.setHours(0, 0, 0, 0);
    byDay.set(d.getTime(), (byDay.get(d.getTime()) ?? 0) + sessionTotals(s).sets);
  }

  const out: { at: number; sets: number }[] = [];
  const start = startOfWeek(now) - (weeksBack - 1) * 7 * DAY;
  for (let i = 0; i < weeksBack * 7; i += 1) {
    const at = start + i * DAY;
    if (at > now + DAY) break;
    out.push({ at, sets: byDay.get(at) ?? 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Strength                                                            */
/* ------------------------------------------------------------------ */

export interface LiftPoint {
  at: number;
  e1rm: number;
  bestWeightKg: number;
  bestReps: number;
}

/** Best estimated 1RM per session for one lift, oldest first. */
export function liftSeries(sessions: WorkoutSession[], exerciseId: string): LiftPoint[] {
  return sessions
    .map((session) => {
      const entry = session.entries.find((e) => e.exerciseId === exerciseId);
      if (!entry) return null;
      let best: LiftPoint | null = null;
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue;
        const e1rm = estimate1RM(s.weightKg, s.reps);
        if (!best || e1rm > best.e1rm) {
          best = {
            at: sessionTime(session),
            e1rm: Math.round(e1rm),
            bestWeightKg: s.weightKg,
            bestReps: s.reps,
          };
        }
      }
      return best;
    })
    .filter((p): p is LiftPoint => p !== null)
    .sort((a, b) => a.at - b.at);
}

export interface LiftProgress {
  exerciseId: string;
  name: string;
  sessions: number;
  first: LiftPoint;
  last: LiftPoint;
  deltaKg: number;
  deltaPct: number;
  /** sessions since the best e1RM was set */
  sessionsSinceBest: number;
  daysSinceBest: number;
  stalled: boolean;
}

/**
 * Progress per tracked lift. A lift counts as stalled when its best estimated
 * 1RM hasn't moved in three or more sessions AND three weeks — one flat
 * session is noise, a month of them is a plateau.
 */
export function liftProgress(
  sessions: WorkoutSession[],
  w: Window,
  now: number = Date.now(),
  minSessions = 3
): LiftProgress[] {
  const inWindow = sessionsInWindow(sessions, w);
  const ids = new Set<string>();
  for (const s of inWindow) for (const e of s.entries) ids.add(e.exerciseId);

  const out: LiftProgress[] = [];
  for (const id of ids) {
    const series = liftSeries(inWindow, id);
    if (series.length < minSessions) continue;
    const ex = getExerciseById(id);
    const first = series[0];
    const last = series[series.length - 1];

    let bestIndex = 0;
    for (let i = 1; i < series.length; i += 1) {
      if (series[i].e1rm > series[bestIndex].e1rm) bestIndex = i;
    }
    const best = series[bestIndex];
    const sessionsSinceBest = series.length - 1 - bestIndex;
    const daysSinceBest = Math.floor((now - best.at) / DAY);

    out.push({
      exerciseId: id,
      name: ex?.name ?? id,
      sessions: series.length,
      first,
      last,
      deltaKg: Math.round(last.e1rm - first.e1rm),
      deltaPct: first.e1rm > 0 ? Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 100) : 0,
      sessionsSinceBest,
      daysSinceBest,
      stalled: sessionsSinceBest >= 3 && daysSinceBest >= 21,
    });
  }

  return out.sort((a, b) => b.sessions - a.sessions);
}

/** The lifts logged most often, for the strength-trend picker. */
export function trackedLifts(sessions: WorkoutSession[], limit = 10): string[] {
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    for (const e of s.entries) counts[e.exerciseId] = (counts[e.exerciseId] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Personal records                                                    */
/* ------------------------------------------------------------------ */

export interface PrEvent {
  at: number;
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
  e1rm: number;
  /** improvement over the previous best, in kg of estimated 1RM */
  gainKg: number;
}

/**
 * Replays the whole history in order and records every moment a lift's best
 * estimated 1RM was beaten. This is what makes "3 PRs this month" a real
 * number rather than a count of the current bests.
 */
export function prTimeline(sessions: WorkoutSession[]): PrEvent[] {
  const ordered = [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b));
  const best: Record<string, number> = {};
  const events: PrEvent[] = [];

  for (const session of ordered) {
    for (const entry of session.entries) {
      let top: { e1rm: number; weightKg: number; reps: number } | null = null;
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue;
        const e1rm = estimate1RM(s.weightKg, s.reps);
        if (!top || e1rm > top.e1rm) top = { e1rm, weightKg: s.weightKg, reps: s.reps };
      }
      if (!top || top.e1rm <= 0) continue;
      const previous = best[entry.exerciseId] ?? 0;
      if (top.e1rm > previous + 0.01) {
        best[entry.exerciseId] = top.e1rm;
        // the very first time a lift is logged isn't a "record", it's a baseline
        if (previous > 0) {
          events.push({
            at: sessionTime(session),
            exerciseId: entry.exerciseId,
            name: getExerciseById(entry.exerciseId)?.name ?? entry.exerciseId,
            weightKg: top.weightKg,
            reps: top.reps,
            e1rm: Math.round(top.e1rm),
            gainKg: Math.round((top.e1rm - previous) * 10) / 10,
          });
        }
      }
    }
  }

  return events.sort((a, b) => b.at - a.at);
}

/* ------------------------------------------------------------------ */
/* Exercise variety                                                    */
/* ------------------------------------------------------------------ */

export interface VarietyStats {
  distinctExercises: number;
  /** share of all working sets taken by the five most-used exercises */
  top5SharePct: number;
  compoundSharePct: number;
}

export function variety(sessions: WorkoutSession[]): VarietyStats {
  const setsById: Record<string, number> = {};
  let total = 0;
  let compound = 0;

  for (const s of sessions) {
    for (const entry of s.entries) {
      const n = entry.sets.filter(isWorkingSet).length;
      if (!n) continue;
      setsById[entry.exerciseId] = (setsById[entry.exerciseId] ?? 0) + n;
      total += n;
      const ex = getExerciseById(entry.exerciseId);
      if (ex?.mechanic === 'compound') compound += n;
    }
  }

  const top5 = Object.values(setsById)
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((a, b) => a + b, 0);

  return {
    distinctExercises: Object.keys(setsById).length,
    top5SharePct: total ? Math.round((top5 / total) * 100) : 0,
    compoundSharePct: total ? Math.round((compound / total) * 100) : 0,
  };
}

/** Muscles trained at all in a window — used to spot outright gaps. */
export function musclesTrained(sessions: WorkoutSession[]): Set<MuscleGroup> {
  const out = new Set<MuscleGroup>();
  for (const s of sessions) {
    for (const entry of s.entries) {
      if (!entry.sets.some(isWorkingSet)) continue;
      const ex = getExerciseById(entry.exerciseId);
      ex?.primaryMuscles.forEach((m) => out.add(m));
    }
  }
  return out;
}

export { MUSCLE_LABELS };
export type { Exercise };
