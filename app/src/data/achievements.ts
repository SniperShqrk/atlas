import type { WorkoutSession } from '@/store/workoutStore';
import { sessionVolume } from '@/store/workoutStore';
import { consistency, prTimeline, liftSeries } from '@/store/analytics';
import { standardThreshold, StandardTier } from '@/data/strengthStandards';

/**
 * ATLAS — achievements, derived the same way everything else in this app is:
 * arithmetic on the logs, not a separate thing to remember to award. There is
 * no "unlock" event to fire and persist — every tier's unlocked state and the
 * date it was crossed are recomputed from `sessions` on demand, which means
 * they can never drift out of sync with the history screen or a corrected
 * log entry the way a stored badge list would.
 *
 * Originally a 30-tier system (six count-based tiers across five arbitrary
 * categories). Consolidated down to 12 real milestones after product-strategy
 * research on gamification for serious lifters: a badge tied to an actual
 * strength or consistency threshold gets checked and cared about, a long
 * ladder of arbitrary counts gets ignored. The headline category is now
 * strength standards (bench/squat/deadlift measured against your own
 * bodyweight) — nothing else in the counting categories is as meaningful as
 * "you can now squat 1.5x bodyweight," so that's where most of the budget
 * went; sessions/streak/volume/records keep one or two real milestones each
 * instead of six arbitrary ones apiece.
 */

export type AchievementCategory = 'strength' | 'sessions' | 'streak' | 'volume' | 'records';

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  strength: 'Strength',
  sessions: 'Sessions',
  streak: 'Consistency',
  volume: 'Volume',
  records: 'Records',
};

export interface AchievementTier {
  id: string;
  category: AchievementCategory;
  threshold: number;
  label: string;
  detail: string;
}

export interface AchievementProgress {
  tier: AchievementTier;
  unlocked: boolean;
  /** when this tier was first crossed — null when locked, or when the
   * category doesn't track a crossing date (see `streak` below) */
  achievedAt: number | null;
  /** the tier's own current value — for `strength` this is the lift's e1RM
   * as a bodyweight multiple, everything else shares one running count
   * across all tiers in its category */
  current: number;
}

export interface AchievementReport {
  byCategory: Record<AchievementCategory, AchievementProgress[]>;
  all: AchievementProgress[];
  unlockedCount: number;
  totalCount: number;
  /** the single closest-to-unlocking tier per category, nearest first */
  nextUp: (AchievementProgress & { pct: number })[];
}

/* ------------------------------------------------------------------ */
/* Tiers                                                               */
/* ------------------------------------------------------------------ */
/* eslint-disable prettier/prettier */

// The "big 3" — the only lifts with a bodyweight-multiple standard table
// (see strengthStandards.ts) and the three every serious lifter actually
// tracks. Intermediate and Advanced only: Beginner/Novice unlock almost
// immediately and Elite is rare enough that the live number on the Progress
// screen already covers it without needing a separate badge for it.
const STRENGTH_LIFTS: { exerciseId: string; name: string }[] = [
  { exerciseId: 'barbell_bench_press', name: 'Bench Press' },
  { exerciseId: 'back_squat', name: 'Squat' },
  { exerciseId: 'deadlift', name: 'Deadlift' },
];
const STRENGTH_TIERS: StandardTier[] = ['Intermediate', 'Advanced'];

const SESSIONS: [number, string, string][] = [
  [1, 'First Session', 'Logged your first completed workout'],
  [100, 'Centurion', '100 sessions completed'],
];

const VOLUME: [number, string, string][] = [
  [500_000, 'Atlas Himself — 500t Moved', '500,000kg moved in total'],
];

const STREAK: [number, string, string][] = [
  [8, 'Eight Weeks Running', 'Trained in 8 consecutive weeks'],
  [52, 'One Year Unbroken', 'Trained in 52 consecutive weeks'],
];

const RECORDS: [number, string, string][] = [
  [10, 'Ten Records', '10 personal records set'],
];
/* eslint-enable prettier/prettier */

function buildTiers(category: AchievementCategory, rows: [number, string, string][]): AchievementTier[] {
  return rows.map(([threshold, label, detail]) => ({
    id: `${category}_${threshold}`,
    category,
    threshold,
    label,
    detail,
  }));
}

function buildStrengthTiers(): AchievementTier[] {
  const tiers: AchievementTier[] = [];
  STRENGTH_LIFTS.forEach(({ exerciseId, name }) => {
    STRENGTH_TIERS.forEach((tier, i) => {
      tiers.push({
        id: `strength_${exerciseId}_${tier}`,
        category: 'strength',
        // rank, not a real unit — only used to order nextUp/pct math
        threshold: i + 1,
        label: `${name} — ${tier}`,
        detail: `Reach ${tier}-level ${name}, relative to your own bodyweight`,
      });
    });
  });
  return tiers;
}

export const TIERS: Record<AchievementCategory, AchievementTier[]> = {
  strength: buildStrengthTiers(),
  sessions: buildTiers('sessions', SESSIONS),
  streak: buildTiers('streak', STREAK),
  volume: buildTiers('volume', VOLUME),
  records: buildTiers('records', RECORDS),
};

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

function sessionTime(s: WorkoutSession): number {
  return s.completedAt ?? s.startedAt;
}

/**
 * Walks cumulative categories (sessions, volume) once in chronological order
 * and records the timestamp each tier was first crossed — the same walk a
 * person would do by hand with a highlighter and their own history, just
 * done once instead of remembered.
 */
function deriveCumulative(
  category: AchievementCategory,
  sessions: WorkoutSession[],
  valueAfter: (running: { count: number; volume: number }, s: WorkoutSession) => number
): { current: number; crossedAt: Map<number, number> } {
  const ordered = [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b));
  const running = { count: 0, volume: 0 };
  const crossedAt = new Map<number, number>();
  const tiers = TIERS[category];
  let current = 0;

  for (const s of ordered) {
    running.count += 1;
    running.volume += sessionVolume(s);
    current = valueAfter(running, s);

    for (const t of tiers) {
      if (!crossedAt.has(t.threshold) && current >= t.threshold) {
        crossedAt.set(t.threshold, sessionTime(s));
      }
    }
  }

  return { current, crossedAt };
}

function deriveRecords(sessions: WorkoutSession[]): { current: number; crossedAt: Map<number, number> } {
  // prTimeline returns most-recent-first — flip it before indexing by
  // "the Nth record", or every threshold date comes out wrong
  const events = [...prTimeline(sessions)].sort((a, b) => a.at - b.at);
  const crossedAt = new Map<number, number>();
  for (const t of TIERS.records) {
    if (events.length >= t.threshold) crossedAt.set(t.threshold, events[t.threshold - 1].at);
  }
  return { current: events.length, crossedAt };
}

/**
 * One progress entry per (lift, tier) combination. `current` on each entry
 * is that lift's own bodyweight-multiple ratio (same number across both of
 * a lift's tiers) rather than a shared category-wide count, since unlike
 * every other category here a "Squat — Advanced" badge and a "Bench —
 * Advanced" badge have nothing to do with the same underlying number.
 */
function deriveStrength(
  sessions: WorkoutSession[],
  bodyweightKg: number | null | undefined,
  gender: 'male' | 'female'
): AchievementProgress[] {
  const out: AchievementProgress[] = [];
  for (const tier of TIERS.strength) {
    const lift = STRENGTH_LIFTS.find((l) => tier.id.startsWith(`strength_${l.exerciseId}_`));
    if (!lift) continue;
    const tierName = tier.label.split(' — ')[1] as StandardTier;
    const requiredRatio = standardThreshold(lift.exerciseId, tierName, gender);

    if (!bodyweightKg || bodyweightKg <= 0 || requiredRatio == null) {
      out.push({ tier, unlocked: false, achievedAt: null, current: 0 });
      continue;
    }

    const series = liftSeries(sessions, lift.exerciseId);
    const currentRatio = series.length ? series[series.length - 1].e1rm / bodyweightKg : 0;
    // Approximates historical bodyweight with today's — good enough for a
    // milestone date, and consistent with how the Progress screen's own
    // live strength-standard reading already treats bodyweight as current,
    // not historical.
    const crossing = series.find((p) => p.e1rm / bodyweightKg >= requiredRatio);

    out.push({
      tier,
      unlocked: currentRatio >= requiredRatio,
      achievedAt: crossing?.at ?? null,
      current: currentRatio,
    });
  }
  return out;
}

function toProgress(category: AchievementCategory, current: number, crossedAt: Map<number, number> | null): AchievementProgress[] {
  return TIERS[category].map((tier) => {
    const unlocked = current >= tier.threshold;
    return {
      tier,
      unlocked,
      achievedAt: unlocked ? crossedAt?.get(tier.threshold) ?? null : null,
      current,
    };
  });
}

/**
 * The full report. `targetDaysPerWeek` only affects the streak category
 * indirectly (via `consistency`'s window math) — the streak tiers themselves
 * are about weeks-with-a-session, not weeks that hit the target, so someone
 * training three days against a five-day goal still builds a real streak.
 *
 * Streak is the one non-strength category without crossing dates:
 * `consistency` reports the longest run ever achieved, not a week-by-week
 * ledger, so reconstructing exactly when a 52-week streak first happened
 * would mean re-deriving the whole week-bucket calculation a second time for
 * a date nobody is likely to ask for. `achievedAt` is left `null` there
 * rather than guessed.
 *
 * `bodyweightKg`/`gender` feed the strength category only — pass
 * `profile.weightKg`/`profile.gender` from the caller. Without a bodyweight
 * on file, strength tiers simply show as locked (same as any other
 * not-yet-reached milestone) rather than erroring.
 */
export function computeAchievements(
  sessions: WorkoutSession[],
  targetDaysPerWeek: number,
  options: { bodyweightKg?: number; gender?: 'male' | 'female' } = {},
  now: number = Date.now()
): AchievementReport {
  const sessionsD = deriveCumulative('sessions', sessions, (r) => r.count);
  const volumeD = deriveCumulative('volume', sessions, (r) => Math.round(r.volume));
  const recordsD = deriveRecords(sessions);
  const { longestWeekStreak } = consistency(sessions, targetDaysPerWeek, now);

  const byCategory: Record<AchievementCategory, AchievementProgress[]> = {
    strength: deriveStrength(sessions, options.bodyweightKg, options.gender ?? 'male'),
    sessions: toProgress('sessions', sessionsD.current, sessionsD.crossedAt),
    volume: toProgress('volume', volumeD.current, volumeD.crossedAt),
    records: toProgress('records', recordsD.current, recordsD.crossedAt),
    streak: toProgress('streak', longestWeekStreak, null),
  };

  const all = ([...byCategory.strength, ...byCategory.sessions, ...byCategory.streak, ...byCategory.volume, ...byCategory.records]);
  const unlockedCount = all.filter((a) => a.unlocked).length;

  // strength's pct is handled separately below (its "threshold" is a rank,
  // not a real unit, so the shared count/threshold math doesn't apply to it)
  const nextUp = (Object.keys(byCategory) as AchievementCategory[])
    .filter((cat) => cat !== 'strength')
    .map((cat) => {
      const locked = byCategory[cat].find((a) => !a.unlocked);
      if (!locked) return null;
      return { ...locked, pct: Math.min(99, Math.round((locked.current / locked.tier.threshold) * 100)) };
    })
    .filter((x): x is AchievementProgress & { pct: number } => x !== null);

  // Strength's own "next up": the first locked strength tier, with pct
  // computed against its real bodyweight-multiple requirement rather than
  // the tier's rank number (which deriveStrength uses only for ordering).
  const lockedStrength = byCategory.strength.find((a) => !a.unlocked);
  if (lockedStrength && options.bodyweightKg) {
    const lift = STRENGTH_LIFTS.find((l) => lockedStrength.tier.id.startsWith(`strength_${l.exerciseId}_`));
    const tierName = lockedStrength.tier.label.split(' — ')[1] as StandardTier;
    const requiredRatio = lift ? standardThreshold(lift.exerciseId, tierName, options.gender ?? 'male') : null;
    if (requiredRatio) {
      nextUp.push({
        ...lockedStrength,
        pct: Math.min(99, Math.round((lockedStrength.current / requiredRatio) * 100)),
      });
    }
  }

  nextUp.sort((a, b) => b.pct - a.pct);

  return { byCategory, all, unlockedCount, totalCount: all.length, nextUp };
}

/** Tiers unlocked in `after` that were not unlocked in `before` — the
 * moment worth celebrating, computed by running the engine twice rather
 * than tracking a "just unlocked" flag anywhere in state. */
export function newlyUnlocked(before: AchievementReport, after: AchievementReport): AchievementProgress[] {
  const wasUnlocked = new Set(before.all.filter((a) => a.unlocked).map((a) => a.tier.id));
  return after.all.filter((a) => a.unlocked && !wasUnlocked.has(a.tier.id));
}
