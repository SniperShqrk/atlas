import type { WorkoutSession } from '@/store/workoutStore';
import { getExerciseById } from '@/data/exercises';
import {
  PrEvent,
  RegionBalance,
  TimeRange,
  balanceScore,
  computeRangeMetrics,
  consistency,
  liftProgress,
  muscleBalance,
  prTimeline,
  rangeWindow,
  sessionTotals,
  sessionsInWindow,
} from '@/store/analytics';

/**
 * ATLAS — shareable progress cards.
 *
 * The model a trading app uses for a P&L card: one number that means
 * something, the context that makes it legible, and a mark that says where it
 * came from. The card is the marketing asset and the retention hook at the
 * same time — people post them because the number is theirs, and every post
 * carries the wordmark.
 *
 * This file is the data half and is deliberately pure: it turns store state
 * into a `ShareCard`, and knows nothing about how the card is drawn. That
 * keeps the copy testable and lets the same payload drive the in-app renderer,
 * the browser preview and anything added later.
 */

export type CardKind = 'pr' | 'session' | 'week' | 'balance' | 'streak';

export type CardFormat = 'square' | 'portrait' | 'story';

export const CARD_FORMATS: Record<CardFormat, { w: number; h: number; label: string; note: string }> = {
  square: { w: 1080, h: 1080, label: 'Square', note: 'Feed posts' },
  portrait: { w: 1080, h: 1350, label: 'Portrait', note: 'Instagram feed' },
  story: { w: 1080, h: 1920, label: 'Story', note: 'Stories, Reels, Shorts' },
};

export interface CardStat {
  label: string;
  value: string;
}

export interface ShareCard {
  kind: CardKind;
  /** small uppercase line above the headline — what kind of moment this is */
  eyebrow: string;
  /** the number, as large as it will go */
  hero: string;
  /** unit or qualifier printed next to the hero at small size */
  heroUnit?: string;
  /** what the number is */
  title: string;
  /** one line of context under the title */
  subtitle?: string;
  /** up to three supporting figures along the bottom */
  stats: CardStat[];
  /** when the moment happened */
  at: number;
  /** which backdrop this card asks for — see share/artwork.ts */
  artworkId: string;
  /** true when the card is generated from example data rather than real logs */
  sample?: boolean;
}

function fmtKg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function dateOf(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

/**
 * A new personal record. The most shareable moment there is, because the
 * number is unambiguous and the person earned it in the last hour.
 */
export function prCard(event: PrEvent, sessions: WorkoutSession[]): ShareCard {
  const series = liftProgress(sessions, rangeWindow(sessions, 'ALL'), Date.now(), 2).find(
    (p) => p.exerciseId === event.exerciseId
  );
  const ex = getExerciseById(event.exerciseId);

  const stats: CardStat[] = [
    { label: 'e1RM', value: `${event.e1rm}kg` },
    { label: 'Gain', value: `+${fmtKg(event.gainKg)}kg` },
  ];
  if (series && series.sessions >= 2) {
    stats.push({ label: 'Sessions', value: String(series.sessions) });
  }

  return {
    kind: 'pr',
    eyebrow: 'Personal record',
    hero: fmtKg(event.weightKg),
    heroUnit: 'kg',
    title: event.name,
    subtitle: `${event.weightKg}kg × ${event.reps} · ${ex?.mechanic === 'compound' ? 'Compound' : 'Isolation'}`,
    stats,
    at: event.at,
    artworkId: 'wreath',
  };
}

/** A finished session — the everyday card, posted straight after training. */
export function sessionCard(session: WorkoutSession, sessions: WorkoutSession[]): ShareCard {
  const totals = sessionTotals(session);
  const at = session.completedAt ?? session.startedAt;
  const prs = prTimeline(sessions).filter(
    (e) => Math.abs(e.at - at) < 60 * 1000
  ).length;

  const stats: CardStat[] = [
    { label: 'Sets', value: String(totals.sets) },
    { label: 'Exercises', value: String(totals.exercises) },
  ];
  if (session.durationSec) {
    stats.push({ label: 'Duration', value: `${Math.round(session.durationSec / 60)} min` });
  }
  if (prs > 0) stats.push({ label: 'Records', value: String(prs) });

  return {
    kind: 'session',
    eyebrow: session.name,
    hero: totals.volumeKg >= 10000
      ? `${Math.round(totals.volumeKg / 1000)}k`
      : String(Math.round(totals.volumeKg)),
    heroUnit: 'kg',
    title: 'Session complete',
    subtitle: dateOf(at),
    stats: stats.slice(0, 3),
    at,
    artworkId: 'column',
  };
}

/** The weekly summary — the card that gives people a reason to post on Sundays. */
export function weekCard(sessions: WorkoutSession[], now = Date.now()): ShareCard | null {
  const w = rangeWindow(sessions, '7D', now);
  const m = computeRangeMetrics(sessions, w);
  if (m.sessionCount === 0) return null;

  return {
    kind: 'week',
    eyebrow: 'Week in training',
    hero: String(m.sessionCount),
    heroUnit: m.sessionCount === 1 ? 'session' : 'sessions',
    title: `${m.totalSets} sets, ${Math.round(m.totalVolumeKg).toLocaleString()}kg`,
    subtitle: 'Last seven days',
    stats: [
      { label: 'Sets', value: String(m.totalSets) },
      { label: 'Volume', value: `${Math.round(m.totalVolumeKg / 1000)}k kg` },
      { label: 'Avg time', value: `${m.avgDurationMin || '—'} min` },
    ],
    at: now,
    artworkId: 'column',
  };
}

/** The balance score — the card that is unique to ATLAS and hardest to copy. */
export function balanceCard(
  sessions: WorkoutSession[],
  range: TimeRange = '30D',
  now = Date.now()
): ShareCard | null {
  const w = rangeWindow(sessions, range, now);
  if (sessionsInWindow(sessions, w).length < 3) return null;

  const balance: RegionBalance[] = muscleBalance(sessions, w);
  const score = balanceScore(balance);
  const onTarget = balance.filter((b) => b.status === 'on_target').length;
  const weakest = [...balance].sort((a, b) => a.ratio - b.ratio)[0];
  const strongest = [...balance].sort((a, b) => b.ratio - a.ratio)[0];

  return {
    kind: 'balance',
    eyebrow: 'Muscle balance',
    hero: String(score),
    heroUnit: '/ 100',
    title: `${onTarget} of ${balance.length} regions on target`,
    subtitle: `Last ${range === 'ALL' ? 'all time' : range.toLowerCase()}`,
    stats: [
      { label: 'Strongest', value: strongest.label },
      { label: 'Weakest', value: weakest.label },
      { label: 'On target', value: `${onTarget}/${balance.length}` },
    ],
    at: now,
    artworkId: 'cuirass',
  };
}

/** Consistency — the card that rewards the least glamorous and most valuable thing. */
export function streakCard(
  sessions: WorkoutSession[],
  targetDaysPerWeek: number,
  now = Date.now()
): ShareCard | null {
  const c = consistency(sessions, targetDaysPerWeek, now);
  if (c.weekStreak < 2) return null;

  return {
    kind: 'streak',
    eyebrow: 'Consistency',
    hero: String(c.weekStreak),
    heroUnit: c.weekStreak === 1 ? 'week' : 'weeks',
    title: 'Trained without a gap',
    subtitle: `Best run ${c.longestWeekStreak} weeks`,
    stats: [
      { label: 'Streak', value: `${c.weekStreak}w` },
      { label: 'Best run', value: `${c.longestWeekStreak}w` },
      { label: 'Adherence', value: `${c.adherencePct}%` },
    ],
    at: now,
    artworkId: 'helmet',
  };
}

/* ------------------------------------------------------------------ */
/* Offering cards                                                      */
/* ------------------------------------------------------------------ */

export interface CardOffer {
  card: ShareCard;
  /** why this card is being offered, shown in the picker */
  reason: string;
}

/**
 * Every card worth offering right now, best first. Used by the share sheet and
 * by the post-session screen — a card is only offered when the moment behind
 * it is real, so nobody is invited to post an empty week.
 */
export function availableCards(
  sessions: WorkoutSession[],
  options: { targetDaysPerWeek?: number; now?: number } = {}
): CardOffer[] {
  const now = options.now ?? Date.now();
  const target = options.targetDaysPerWeek ?? 4;
  const offers: CardOffer[] = [];

  const recentPrs = prTimeline(sessions).filter((e) => now - e.at < 7 * 24 * 60 * 60 * 1000);
  if (recentPrs.length) {
    offers.push({ card: prCard(recentPrs[0], sessions), reason: 'New record this week' });
  }

  const last = [...sessions].sort(
    (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
  )[0];
  if (last) {
    offers.push({ card: sessionCard(last, sessions), reason: 'Your last session' });
  }

  const week = weekCard(sessions, now);
  if (week) offers.push({ card: week, reason: 'This week in total' });

  const balance = balanceCard(sessions, '30D', now);
  if (balance) offers.push({ card: balance, reason: 'Only ATLAS has this one' });

  const streak = streakCard(sessions, target, now);
  if (streak) offers.push({ card: streak, reason: 'Your current run' });

  return offers;
}

/**
 * A card built from nothing, for the empty state and the onboarding paywall.
 *
 * Marked `sample` so the renderer can label it — showing invented numbers as
 * if they were the user's own would be a lie, and the point of the card is
 * that the number is true.
 */
export function sampleCard(): ShareCard {
  return {
    kind: 'pr',
    eyebrow: 'Personal record',
    hero: '102.5',
    heroUnit: 'kg',
    title: 'Barbell Bench Press',
    subtitle: '102.5kg × 5 · Compound',
    stats: [
      { label: 'e1RM', value: '119kg' },
      { label: 'Gain', value: '+4.5kg' },
      { label: 'Sessions', value: '18' },
    ],
    at: Date.now(),
    artworkId: 'wreath',
    sample: true,
  };
}

/** Fallback share text, for platforms where an image cannot be attached. */
export function cardAsText(card: ShareCard): string {
  const stats = card.stats.map((s) => `${s.label}: ${s.value}`).join(' · ');
  return `${card.eyebrow.toUpperCase()}\n${card.hero}${card.heroUnit ? card.heroUnit : ''} — ${card.title}\n${stats}\n\nTracked with ATLAS`;
}
