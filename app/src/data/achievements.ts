import type { WorkoutSession } from '@/store/workoutStore';
import { sessionVolume } from '@/store/workoutStore';
import { consistency, prTimeline } from '@/store/analytics';

/**
 * ATLAS — achievements, derived the same way everything else in this app is:
 * arithmetic on the logs, not a separate thing to remember to award. There is
 * no "unlock" event to fire and persist — every tier's unlocked state and the
 * date it was crossed are recomputed from `sessions` on demand, which means
 * they can never drift out of sync with the history screen or a corrected
 * log entry the way a stored badge list would.
 *
 * Retention research on habit apps agrees on one thing more than any other:
 * a visible streak and a small, frequent sense of forward motion outperform
 * a big reward that arrives rarely. Five categories, six tiers each, gives
 * thirty possible moments rather than one distant "you win" — most of them
 * within the first few months of real use.
 */

export type AchievementCategory = 'sessions' | 'volume' | 'streak' | 'records' | 'exercises';

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  sessions: 'Sessions',
  volume: 'Volume',
  streak: 'Consistency',
  records: 'Records',
  exercises: 'Range',
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
  /** the category's current value, same across every tier in it */
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
const SESSIONS: [number, string, string][] = [
  [1, 'First Session', 'Logged your first completed workout'],
  [10, 'Foundation', '10 sessions completed'],
  [25, 'Discipline', '25 sessions completed'],
  [50, 'Consistency', '50 sessions completed'],
  [100, 'Centurion', '100 sessions completed'],
  [250, 'Master of the Craft', '250 sessions completed'],
];

const VOLUME: [number, string, string][] = [
  [10_000, 'Foundation — 10t Moved', '10,000kg moved in total'],
  [50_000, 'Momentum — 50t Moved', '50,000kg moved in total'],
  [100_000, 'Weight of Stone — 100t Moved', '100,000kg moved in total'],
  [250_000, 'Bearing the Load — 250t Moved', '250,000kg moved in total'],
  [500_000, 'Atlas Himself — 500t Moved', '500,000kg moved in total'],
  [1_000_000, 'A Million Kilograms', '1,000,000kg moved in total'],
];

const STREAK: [number, string, string][] = [
  [2, 'Two Weeks Running', 'Trained in 2 consecutive weeks'],
  [4, 'One Month Unbroken', 'Trained in 4 consecutive weeks'],
  [8, 'Eight Weeks Running', 'Trained in 8 consecutive weeks'],
  [12, 'One Quarter', 'Trained in 12 consecutive weeks'],
  [26, 'Half a Year', 'Trained in 26 consecutive weeks'],
  [52, 'One Year Unbroken', 'Trained in 52 consecutive weeks'],
];

const RECORDS: [number, string, string][] = [
  [1, 'First Record', 'Beat a lift’s previous best'],
  [5, 'Five Records', '5 personal records set'],
  [10, 'Ten Records', '10 personal records set'],
  [25, 'Twenty-Five Records', '25 personal records set'],
  [50, 'Fifty Records', '50 personal records set'],
  [100, 'One Hundred Records', '100 personal records set'],
];

const EXERCISES: [number, string, string][] = [
  [5, 'Getting Acquainted', '5 distinct exercises logged'],
  [15, 'Building a Toolkit', '15 distinct exercises logged'],
  [30, 'Well Rounded', '30 distinct exercises logged'],
  [50, 'Wide Range', '50 distinct exercises logged'],
  [75, 'Deep Library', '75 distinct exercises logged'],
  [100, 'Every Angle', '100 distinct exercises logged'],
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

export const TIERS: Record<AchievementCategory, AchievementTier[]> = {
  sessions: buildTiers('sessions', SESSIONS),
  volume: buildTiers('volume', VOLUME),
  streak: buildTiers('streak', STREAK),
  records: buildTiers('records', RECORDS),
  exercises: buildTiers('exercises', EXERCISES),
};

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

function sessionTime(s: WorkoutSession): number {
  return s.completedAt ?? s.startedAt;
}

/**
 * Walks cumulative categories (sessions, volume, distinct exercises) once in
 * chronological order and records the timestamp each tier was first crossed
 * — the same walk a person would do by hand with a highlighter and their own
 * history, just done once instead of remembered.
 */
function deriveCumulative(
  category: AchievementCategory,
  sessions: WorkoutSession[],
  valueAfter: (running: { count: number; volume: number; exercises: Set<string> }, s: WorkoutSession) => number
): { current: number; crossedAt: Map<number, number> } {
  const ordered = [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b));
  const running = { count: 0, volume: 0, exercises: new Set<string>() };
  const crossedAt = new Map<number, number>();
  const tiers = TIERS[category];
  let current = 0;

  for (const s of ordered) {
    running.count += 1;
    running.volume += sessionVolume(s);
    for (const e of s.entries) running.exercises.add(e.exerciseId);
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
 * Streak is the one category without crossing dates: `consistency` reports
 * the longest run ever achieved, not a week-by-week ledger, so reconstructing
 * exactly when a 12-week streak first happened would mean re-deriving the
 * whole week-bucket calculation a second time for a date nobody is likely to
 * ask for. `achievedAt` is left `null` there rather than guessed.
 */
export function computeAchievements(
  sessions: WorkoutSession[],
  targetDaysPerWeek: number,
  now: number = Date.now()
): AchievementReport {
  const sessionsD = deriveCumulative('sessions', sessions, (r) => r.count);
  const volumeD = deriveCumulative('volume', sessions, (r) => Math.round(r.volume));
  const exercisesD = deriveCumulative('exercises', sessions, (r) => r.exercises.size);
  const recordsD = deriveRecords(sessions);
  const { longestWeekStreak } = consistency(sessions, targetDaysPerWeek, now);

  const byCategory: Record<AchievementCategory, AchievementProgress[]> = {
    sessions: toProgress('sessions', sessionsD.current, sessionsD.crossedAt),
    volume: toProgress('volume', volumeD.current, volumeD.crossedAt),
    exercises: toProgress('exercises', exercisesD.current, exercisesD.crossedAt),
    records: toProgress('records', recordsD.current, recordsD.crossedAt),
    streak: toProgress('streak', longestWeekStreak, null),
  };

  const all = ([...byCategory.sessions, ...byCategory.volume, ...byCategory.streak, ...byCategory.records, ...byCategory.exercises]);
  const unlockedCount = all.filter((a) => a.unlocked).length;

  const nextUp = (Object.keys(byCategory) as AchievementCategory[])
    .map((cat) => {
      const locked = byCategory[cat].find((a) => !a.unlocked);
      if (!locked) return null;
      return { ...locked, pct: Math.min(99, Math.round((locked.current / locked.tier.threshold) * 100)) };
    })
    .filter((x): x is AchievementProgress & { pct: number } => x !== null)
    .sort((a, b) => b.pct - a.pct);

  return { byCategory, all, unlockedCount, totalCount: all.length, nextUp };
}

/** Tiers unlocked in `after` that were not unlocked in `before` — the
 * moment worth celebrating, computed by running the engine twice rather
 * than tracking a "just unlocked" flag anywhere in state. */
export function newlyUnlocked(before: AchievementReport, after: AchievementReport): AchievementProgress[] {
  const wasUnlocked = new Set(before.all.filter((a) => a.unlocked).map((a) => a.tier.id));
  return after.all.filter((a) => a.unlocked && !wasUnlocked.has(a.tier.id));
}
