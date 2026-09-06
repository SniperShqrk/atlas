import { MuscleGroup, MUSCLE_LABELS } from '@/data/exercises';
import type { WorkoutSession } from '@/store/workoutStore';
import { computeMuscleLoads } from '@/store/recovery';
import {
  MuscleRegion,
  RegionBalance,
  REGION_LABELS,
  TimeRange,
  Window,
  balanceScore,
  computeRangeMetrics,
  consistency,
  liftProgress,
  muscleBalance,
  pctChange,
  prTimeline,
  previousWindow,
  rangeWindow,
  sessionsInWindow,
  setsPerMuscle,
  variety,
} from '@/store/analytics';

/**
 * ATLAS — the insight engine.
 *
 * Every insight here is derived arithmetically from the user's own logs. No
 * model is called: an LLM adds nothing to "your rear delts got 2 sets and your
 * front delts got 19", and calling one per screen view would cost real money
 * for a worse, less reliable answer. The model earns its keep elsewhere —
 * writing programmes, rewriting a week around an injury — where the output is
 * genuinely generative rather than a lookup.
 *
 * Each insight carries a free half and a paid half:
 *   headline + preview  — always visible, and specific enough to be credible
 *   detail + action     — Premium; the actual diagnosis and what to do
 */

export type InsightKind =
  | 'neglect'
  | 'imbalance'
  | 'volume_shift'
  | 'plateau'
  | 'progress'
  | 'consistency'
  | 'records'
  | 'programming'
  | 'recovery';

export type InsightSeverity = 'good' | 'watch' | 'warn';

export interface Insight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  /** the hook — always free */
  headline: string;
  /** one line of real substance — always free */
  preview: string;
  /** the analysis — Premium */
  detail: string[];
  /** what to actually change — Premium */
  action: string;
  /** supporting numbers — Premium */
  metrics: { label: string; value: string }[];
  /** internal ranking weight */
  weight: number;
}

export interface InsightReport {
  /** the curiosity opener: something good, then the count of what's hiding */
  headline: { praise: string; tease: string; findingCount: number } | null;
  /** revealed in full to everyone — proof the analysis is real */
  free: Insight[];
  /** headline + preview free, detail behind Premium */
  locked: Insight[];
  /** every insight, ranked, regardless of gating */
  all: Insight[];
  /** false when there simply isn't enough history to say anything */
  hasEnoughData: boolean;
  balance: RegionBalance[];
  balanceScore: number;
}

const DAY = 24 * 60 * 60 * 1000;

function kg(n: number): string {
  return `${Math.round(n).toLocaleString()}kg`;
}

function sets(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r} ${r === 1 ? 'set' : 'sets'}`;
}

/* ------------------------------------------------------------------ */
/* Individual detectors                                                */
/* ------------------------------------------------------------------ */

/** Regions getting so little work they are actively losing ground. */
function detectNeglect(balance: RegionBalance[]): Insight[] {
  return balance
    .filter((b) => b.status === 'neglected' && b.ratio < 0.35)
    // biggest absolute shortfall first — a region missing 20 sets a week is a
    // bigger problem than one missing 8, even if the ratios are similar
    .sort((a, b) => b.target - b.setsPerWeek - (a.target - a.setsPerWeek))
    .slice(0, 2)
    .map((b) => {
      const pct = Math.round(b.ratio * 100);
      return {
        id: `neglect:${b.region}`,
        kind: 'neglect' as const,
        severity: 'warn' as const,
        headline: `${b.label} is falling behind`,
        preview:
          b.setsPerWeek === 0
            ? `No direct ${b.label.toLowerCase()} work logged in this period.`
            : `${sets(b.setsPerWeek)}/week — roughly ${pct}% of what this region needs.`,
        detail: [
          `You are averaging ${sets(b.setsPerWeek)} per week on ${b.label.toLowerCase()}, against a growth target of about ${b.target} sets.`,
          `Below roughly a third of target, a muscle group is at or under maintenance — you are holding position at best, and more likely losing size and strength there over a training block.`,
          `Left alone this becomes a visible asymmetry and, for the posterior chain and rear delts specifically, a shoulder and lower-back injury risk as the trained side keeps getting stronger.`,
        ],
        action: `Add ${Math.max(2, Math.round((b.target * 0.7 - b.setsPerWeek) / 2))} sets of direct ${b.label.toLowerCase()} work to two sessions a week. Put it at the start of a session, not tacked onto the end where it gets dropped.`,
        metrics: [
          { label: 'Current', value: `${b.setsPerWeek}/wk` },
          { label: 'Target', value: `${b.target}/wk` },
          { label: 'Gap', value: `${Math.round((1 - b.ratio) * 100)}%` },
        ],
        weight: 100 - pct,
      };
    });
}

/** Regions taking far more than they can recover from. */
function detectOveremphasis(balance: RegionBalance[]): Insight[] {
  return balance
    .filter((b) => b.ratio > 1.45)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 1)
    .map((b) => ({
      id: `over:${b.region}`,
      kind: 'imbalance' as const,
      severity: 'watch' as const,
      headline: `${b.label} is taking a large share of your week`,
      preview: `${sets(b.setsPerWeek)}/week — about ${Math.round(b.ratio * 100)}% of the productive range.`,
      detail: [
        `${b.label} is getting ${sets(b.setsPerWeek)} per week against a target of around ${b.target}.`,
        `Past roughly 150% of the growth range the extra sets stop adding much: the fatigue accumulates faster than the adaptation, and it is usually taken out of the recovery budget of everything else you train.`,
        `This is almost always a preference problem rather than a programming one — the sets you enjoy expand to fill the session.`,
      ],
      action: `Cut ${Math.round(b.setsPerWeek - b.target)} sets a week from ${b.label.toLowerCase()} and move them to whichever region the balance chart shows dented. You will not lose anything.`,
      metrics: [
        { label: 'Current', value: `${b.setsPerWeek}/wk` },
        { label: 'Target', value: `${b.target}/wk` },
        { label: 'Over', value: `+${Math.round((b.ratio - 1) * 100)}%` },
      ],
      weight: 40 + (b.ratio - 1) * 30,
    }));
}

/** Classic opposing-group ratios — the imbalances that actually cause problems. */
function detectRatioImbalance(perMuscle: Record<MuscleGroup, number>): Insight[] {
  const out: Insight[] = [];
  const get = (m: MuscleGroup) => perMuscle[m] ?? 0;

  // pressing vs pulling
  const push = get('chest') + get('front_delts') + get('triceps');
  const pull = get('lats') + get('traps') + get('rear_delts') + get('biceps');
  // a floor rather than a `pull > 0` guard: someone who pulls nothing at all is
  // the most imbalanced lifter there is, and must not fall through the check
  const pullFloor = Math.max(pull, 0.5);
  if (push >= 10 && push / pullFloor >= 1.4) {
    const ratio = Math.round((push / pullFloor) * 10) / 10;
    out.push({
      id: 'ratio:push_pull',
      kind: 'imbalance',
      severity: 'warn',
      headline:
        pull === 0
          ? 'You are pressing and never pulling'
          : 'You are pressing far more than you are pulling',
      preview:
        pull === 0
          ? `${sets(push)} of pressing and no pulling work at all.`
          : `Push to pull is running at ${ratio}:1.`,
      detail: [
        pull === 0
          ? `${sets(push)} of pressing work and not one pulling set in this period.`
          : `${sets(push)} of pressing work against ${sets(pull)} of pulling — a ratio of ${ratio}:1.`,
        `A balanced programme sits near 1:1, and most lifters are better served by slightly favouring the pull side, because pressing volume tends to arrive for free from other movements while pulling does not.`,
        `Sustained press-dominance pulls the shoulders forward, limits how much you can eventually bench, and is the single most common cause of shoulder pain in people who otherwise train sensibly.`,
      ],
      action: `Match every pressing set with a pulling set for the next four weeks. In practice that means adding ${Math.round(push - pull)} pulling sets — rows first, then face pulls.`,
      metrics: [
        { label: 'Push', value: `${Math.round(push)}` },
        { label: 'Pull', value: `${Math.round(pull)}` },
        { label: 'Ratio', value: pull === 0 ? 'no pulling' : `${ratio}:1` },
      ],
      weight: 70 + Math.min(30, (push / pullFloor) * 10),
    });
  }

  // front vs rear delts
  const front = get('front_delts');
  const rear = get('rear_delts');
  if (front >= 6 && front / Math.max(rear, 0.5) >= 2.5) {
    const ratio = Math.round((front / Math.max(rear, 0.5)) * 10) / 10;
    out.push({
      id: 'ratio:delts',
      kind: 'imbalance',
      severity: 'warn',
      headline: 'Your rear delts are being left behind your front delts',
      preview: `Front-to-rear delt work is at roughly ${ratio}:1.`,
      detail: [
        `Front delts: ${sets(front)}. Rear delts: ${sets(rear)}.`,
        `Front delts are hit by every press you do, so they accumulate volume whether you plan it or not. Rear delts get almost nothing unless you deliberately train them.`,
        `This is the most common imbalance in people who train hard, and it is the one that most visibly changes how a physique reads from the side — plus it is a direct contributor to impingement.`,
      ],
      action: 'Two dedicated rear-delt sets at the start of every upper-body session. Reverse flyes or face pulls, 12–20 reps, taken close to failure — this is not a movement to go heavy on.',
      metrics: [
        { label: 'Front', value: `${Math.round(front)}` },
        { label: 'Rear', value: `${Math.round(rear)}` },
        { label: 'Ratio', value: `${ratio}:1` },
      ],
      weight: 75,
    });
  }

  // quads vs hamstrings
  const quads = get('quads');
  const hams = get('hamstrings');
  if (quads >= 6 && quads / Math.max(hams, 0.5) >= 2.2) {
    const ratio = Math.round((quads / Math.max(hams, 0.5)) * 10) / 10;
    out.push({
      id: 'ratio:legs',
      kind: 'imbalance',
      severity: 'watch',
      headline: 'Quad-dominant leg training',
      preview: `Quads to hamstrings is running ${ratio}:1.`,
      detail: [
        `Quads: ${sets(quads)}. Hamstrings: ${sets(hams)}.`,
        `Squats and presses cover the quads thoroughly and the hamstrings barely at all — hamstrings need their own hinge and curl work to grow.`,
        `A weak posterior chain caps how much you can squat and deadlift long before your quads become the limit, and hamstring strength relative to quad strength is one of the better-supported knee-injury predictors.`,
      ],
      action: `Add a dedicated hinge (Romanian deadlift or good morning) plus a curl variation twice a week — around ${Math.round((quads - hams) / 2)} sets.`,
      metrics: [
        { label: 'Quads', value: `${Math.round(quads)}` },
        { label: 'Hams', value: `${Math.round(hams)}` },
        { label: 'Ratio', value: `${ratio}:1` },
      ],
      weight: 55,
    });
  }

  return out;
}

/** Week-on-week volume movement, in either direction. */
function detectVolumeShift(
  sessions: WorkoutSession[],
  w: Window,
  now: number
): Insight[] {
  const current = computeRangeMetrics(sessions, w);
  const prev = computeRangeMetrics(sessions, previousWindow(w));
  if (prev.sessionCount < 2 || current.sessionCount < 2) return [];

  const change = pctChange(current.totalVolumeKg, prev.totalVolumeKg);
  if (change === null || Math.abs(change) < 15) return [];

  const up = change > 0;
  return [
    {
      id: 'volume_shift',
      kind: 'volume_shift',
      severity: up ? (change > 60 ? 'watch' : 'good') : 'watch',
      headline: up
        ? `Training volume is up ${change}% on the previous period`
        : `Training volume has dropped ${Math.abs(change)}%`,
      preview: `${kg(current.totalVolumeKg)} moved, against ${kg(prev.totalVolumeKg)} before.`,
      detail: up
        ? [
            `You moved ${kg(current.totalVolumeKg)} this period against ${kg(prev.totalVolumeKg)} in the one before — a ${change}% increase.`,
            change > 60
              ? 'That is a steep jump. Volume rising faster than about 20% per block usually outruns your ability to recover from it, and shows up two or three weeks later as stalled lifts rather than as soreness.'
              : 'That is a healthy rate of progression — enough to drive adaptation without outrunning recovery.',
            `Sessions: ${current.sessionCount} vs ${prev.sessionCount}. Average sets per session: ${current.avgSetsPerSession} vs ${prev.avgSetsPerSession}.`,
          ]
        : [
            `You moved ${kg(current.totalVolumeKg)} this period against ${kg(prev.totalVolumeKg)} before — down ${Math.abs(change)}%.`,
            current.sessionCount < prev.sessionCount
              ? `The drop is mostly attendance: ${current.sessionCount} sessions against ${prev.sessionCount}.`
              : 'You trained a similar number of times, so the drop is inside the sessions — either fewer sets or lighter loads.',
            'A single down period is nothing. Two in a row is the point where lifts start going backwards.',
          ],
      action: up
        ? change > 60
          ? 'Hold this volume rather than adding to it for the next two weeks, and watch whether your top sets keep moving. If they flatten, take a deload week.'
          : 'Keep the progression rate where it is. Add sets to lagging regions rather than to what is already working.'
        : 'Get the session count back first — three complete sessions beat five half-finished ones. Rebuild volume from your previous baseline rather than jumping straight back to peak.',
      metrics: [
        { label: 'This period', value: kg(current.totalVolumeKg) },
        { label: 'Previous', value: kg(prev.totalVolumeKg) },
        { label: 'Change', value: `${change > 0 ? '+' : ''}${change}%` },
      ],
      weight: up ? 35 : 60,
    },
  ];
}

/** Lifts whose best estimated 1RM has stopped moving. */
function detectPlateau(sessions: WorkoutSession[], w: Window, now: number): Insight[] {
  const progress = liftProgress(sessions, w, now, 4);
  const stalled = progress.filter((p) => p.stalled).sort((a, b) => b.sessions - a.sessions);
  if (!stalled.length) return [];
  const p = stalled[0];

  return [
    {
      id: `plateau:${p.exerciseId}`,
      kind: 'plateau',
      severity: 'warn',
      headline: `${p.name} has stopped progressing`,
      preview: `No new best in ${p.sessionsSinceBest} sessions — ${p.daysSinceBest} days.`,
      detail: [
        `Your best estimated 1RM on ${p.name} is ${p.last.e1rm}kg, set ${p.daysSinceBest} days and ${p.sessionsSinceBest} sessions ago.`,
        stalled.length > 1
          ? `${stalled.length} of your tracked lifts are stalled at once, which points at a recovery or programming problem rather than at any single exercise.`
          : 'Only this lift is stalled — the rest are still moving, which usually means the problem is specific to how this movement is being loaded rather than systemic.',
        'A plateau at four-plus sessions is not bad luck. It is the point where the stimulus has stopped being novel enough, the load is being pushed past what technique supports, or recovery is not keeping up.',
      ],
      action:
        stalled.length > 1
          ? 'Take a deload: same exercises, two-thirds of the load, half the sets, for one week. Then resume from the load you were stuck at.'
          : `Drop ${p.name} to 90% of your stuck load and rebuild with strict double progression, or swap to a close variation for four weeks and come back to it.`,
      metrics: [
        { label: 'Best e1RM', value: `${p.last.e1rm}kg` },
        { label: 'Sessions since', value: `${p.sessionsSinceBest}` },
        { label: 'Stalled lifts', value: `${stalled.length}` },
      ],
      weight: 80,
    },
  ];
}

/** The lift moving fastest — the piece of good news that earns the bad news. */
function detectProgress(sessions: WorkoutSession[], w: Window, now: number): Insight[] {
  const progress = liftProgress(sessions, w, now, 3)
    .filter((p) => p.deltaKg > 0)
    .sort((a, b) => b.deltaPct - a.deltaPct);
  if (!progress.length) return [];
  const p = progress[0];

  return [
    {
      id: `progress:${p.exerciseId}`,
      kind: 'progress',
      severity: 'good',
      headline: `${p.name} is your fastest-moving lift`,
      preview: `Estimated 1RM up ${p.deltaKg}kg (${p.deltaPct}%) across ${p.sessions} sessions.`,
      detail: [
        `${p.first.e1rm}kg to ${p.last.e1rm}kg estimated 1RM over ${p.sessions} logged sessions — ${p.deltaPct}% in this period.`,
        `Your best working set was ${p.last.bestWeightKg}kg × ${p.last.bestReps}.`,
        progress.length > 1
          ? `${progress.length} tracked lifts improved in this window. The gap between your fastest and slowest mover is where your programming is uneven.`
          : 'This is the only tracked lift that improved in this window, which is worth understanding — whatever you are doing here is worth copying across.',
      ],
      action: `Do not change anything about how you are running ${p.name}. Copy its set and rep scheme onto whichever lift the plateau analysis flagged.`,
      metrics: [
        { label: 'Gain', value: `+${p.deltaKg}kg` },
        { label: 'Change', value: `+${p.deltaPct}%` },
        { label: 'Sessions', value: `${p.sessions}` },
      ],
      weight: 30,
    },
  ];
}

/** Attendance against the user's own stated target. */
function detectConsistency(
  sessions: WorkoutSession[],
  w: Window,
  targetDays: number,
  now: number
): Insight[] {
  const stats = consistency(sessions, targetDays, now);
  const metrics = computeRangeMetrics(sessions, w);
  const out: Insight[] = [];

  if (stats.weekStreak >= 3) {
    out.push({
      id: 'consistency:streak',
      kind: 'consistency',
      severity: 'good',
      headline: `${stats.weekStreak} weeks trained without a gap`,
      preview: `Averaging ${metrics.sessionsPerWeek} sessions a week over this period.`,
      detail: [
        `${stats.weekStreak} consecutive weeks with at least one session — your longest run is ${stats.longestWeekStreak}.`,
        `You hit your ${targetDays}-day target in ${stats.adherencePct}% of the last eight weeks.`,
        'Consistency compounds in a way that programme design does not. The lifter who trains three times a week for two years beats the one who trains six times a week for three months, every time.',
      ],
      action:
        stats.adherencePct < 60
          ? `You are showing up but not hitting ${targetDays} days. Either lower the target to what you actually do, or find the one day each week that keeps slipping and move it.`
          : 'Protect the streak over the individual session. A short session beats a skipped one.',
      metrics: [
        { label: 'Streak', value: `${stats.weekStreak}w` },
        { label: 'Best', value: `${stats.longestWeekStreak}w` },
        { label: 'Adherence', value: `${stats.adherencePct}%` },
      ],
      weight: 25,
    });
  }

  if (stats.daysSinceLast !== null && stats.daysSinceLast >= 6) {
    out.push({
      id: 'consistency:gap',
      kind: 'consistency',
      severity: 'warn',
      headline: `${stats.daysSinceLast} days since your last session`,
      preview: 'Strength holds for about three weeks. Muscle holds longer. Habit holds days.',
      detail: [
        `Your last logged session was ${stats.daysSinceLast} days ago.`,
        'Detraining is slower than most people fear: measurable strength loss takes roughly three weeks off, and you regain it far faster than you built it.',
        'The real cost of a gap is the habit, not the muscle. The longer the gap runs the larger the first session back feels, which is what turns a week off into a month off.',
      ],
      action:
        'Make the session back deliberately easy — same exercises, two-thirds the weight, stop well short of failure. The point is to be in the building, not to prove anything.',
      metrics: [
        { label: 'Days out', value: `${stats.daysSinceLast}` },
        { label: 'Streak was', value: `${stats.longestWeekStreak}w` },
      ],
      weight: 65,
    });
  }

  return out;
}

/** PRs are the thing people open the app for. */
function detectRecords(sessions: WorkoutSession[], w: Window): Insight[] {
  const events = prTimeline(sessions).filter((e) => e.at >= w.from && e.at <= w.to);
  if (events.length < 2) return [];
  const top = events.slice(0, 3);

  return [
    {
      id: 'records',
      kind: 'records',
      severity: 'good',
      headline: `${events.length} personal records in this period`,
      preview: `Most recent: ${top[0].name} at ${top[0].weightKg}kg × ${top[0].reps}.`,
      detail: [
        `${events.length} lifts beat their previous best estimated 1RM in this window.`,
        ...top.map(
          (e) =>
            `${e.name} — ${e.weightKg}kg × ${e.reps} (e1RM ${e.e1rm}kg, up ${e.gainKg}kg).`
        ),
      ],
      action:
        'Records cluster around lifts you are running well. Note which of these share a rep range and use it as the default for lifts that are stuck.',
      metrics: [
        { label: 'PRs', value: `${events.length}` },
        { label: 'Best gain', value: `+${Math.max(...events.map((e) => e.gainKg))}kg` },
      ],
      weight: 28,
    },
  ];
}

/** Structural gaps: no compound work, or the same handful of movements forever. */
function detectProgramming(sessions: WorkoutSession[], w: Window): Insight[] {
  const inWindow = sessionsInWindow(sessions, w);
  if (inWindow.length < 4) return [];
  const v = variety(inWindow);
  const out: Insight[] = [];

  if (v.compoundSharePct < 40) {
    out.push({
      id: 'programming:compounds',
      kind: 'programming',
      severity: 'watch',
      headline: 'Your training is running light on compound work',
      preview: `Only ${v.compoundSharePct}% of your working sets are compound movements.`,
      detail: [
        `${v.compoundSharePct}% of your sets in this period were compound lifts, across ${v.distinctExercises} distinct exercises.`,
        'Compounds are where the load lives. They drive most of the systemic adaptation per unit of time, and they are the lifts whose numbers actually track whether you are getting stronger.',
        'Isolation work is not wasted — it is how you fix the gaps compounds leave — but as the bulk of a programme it produces a lot of fatigue for a small return.',
      ],
      action:
        'Open each session with a compound: a press, a row or pull-up, a squat or hinge. Isolation afterwards, not instead.',
      metrics: [
        { label: 'Compound', value: `${v.compoundSharePct}%` },
        { label: 'Exercises', value: `${v.distinctExercises}` },
      ],
      weight: 45,
    });
  }

  if (v.top5SharePct > 70 && v.distinctExercises >= 6) {
    out.push({
      id: 'programming:variety',
      kind: 'programming',
      severity: 'watch',
      headline: 'Five exercises are carrying almost your whole programme',
      preview: `${v.top5SharePct}% of your sets come from just five movements.`,
      detail: [
        `Your top five exercises account for ${v.top5SharePct}% of all working sets across ${v.distinctExercises} exercises used.`,
        'Consistency on a core lift is good. Total concentration on five is how blind spots form — the ranges of motion and joint angles those five happen to miss simply never get trained.',
        'It also makes plateaus harder to break, because you have no adjacent variation to rotate to when a lift stalls.',
      ],
      action:
        'Keep your main lifts. Rotate one accessory per session on a four-week cycle so the supporting work moves while the core stays fixed.',
      metrics: [
        { label: 'Top 5 share', value: `${v.top5SharePct}%` },
        { label: 'Exercises', value: `${v.distinctExercises}` },
      ],
      weight: 38,
    });
  }

  return out;
}

/** Training into a muscle that hasn't recovered. */
function detectRecovery(sessions: WorkoutSession[], now: number): Insight[] {
  const loads = computeMuscleLoads(sessions, now);
  const fatigued = (Object.values(loads) as { muscle: MuscleGroup; recoveryPct: number }[])
    .filter((l) => l.recoveryPct < 35)
    .sort((a, b) => a.recoveryPct - b.recoveryPct);
  if (fatigued.length < 2) return [];

  const names = fatigued.slice(0, 3).map((l) => MUSCLE_LABELS[l.muscle]);
  return [
    {
      id: 'recovery:fatigued',
      kind: 'recovery',
      severity: 'watch',
      headline: `${fatigued.length} muscle groups are still deep in fatigue`,
      preview: `${names.join(', ')} — all under 35% recovered right now.`,
      detail: [
        `${fatigued.map((l) => `${MUSCLE_LABELS[l.muscle]} ${l.recoveryPct}%`).join(', ')}.`,
        'Recovery here is modelled from the fatigue each set applies and how fast that muscle clears it — big muscles take roughly two days, small ones under one.',
        'Training a group below about 35% recovered mostly buys fatigue rather than adaptation, and it is how sessions start feeling heavier week to week for no visible reason.',
      ],
      action: `Train around them today. Pick movements for whatever the recovery map shows bright, and come back to ${names[0].toLowerCase()} in a day or two.`,
      metrics: fatigued
        .slice(0, 3)
        .map((l) => ({ label: MUSCLE_LABELS[l.muscle], value: `${l.recoveryPct}%` })),
      weight: 50,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Report assembly                                                     */
/* ------------------------------------------------------------------ */

const MIN_SESSIONS_FOR_INSIGHTS = 3;

/**
 * Runs every detector, ranks the results, and splits them into the free
 * preview and the Premium reveal.
 *
 * The first free insight is always a genuinely useful complete analysis — the
 * paywall works because the user can see the quality of what is behind it, not
 * because they are guessing.
 */
export function buildInsights(
  sessions: WorkoutSession[],
  options: {
    range?: TimeRange;
    targetDaysPerWeek?: number;
    now?: number;
    /** how many insights to reveal in full on the free tier */
    freeCount?: number;
  } = {}
): InsightReport {
  const now = options.now ?? Date.now();
  const range = options.range ?? '30D';
  const targetDays = options.targetDaysPerWeek ?? 4;
  const freeCount = options.freeCount ?? 1;

  const w = rangeWindow(sessions, range, now);
  const inWindow = sessionsInWindow(sessions, w);
  const balance = muscleBalance(sessions, w);
  const score = balanceScore(balance);

  if (inWindow.length < MIN_SESSIONS_FOR_INSIGHTS) {
    return {
      headline: null,
      free: [],
      locked: [],
      all: [],
      hasEnoughData: false,
      balance,
      balanceScore: score,
    };
  }

  const perMuscle = setsPerMuscle(inWindow);

  const all: Insight[] = [
    ...detectNeglect(balance),
    ...detectOveremphasis(balance),
    ...detectRatioImbalance(perMuscle),
    ...detectVolumeShift(sessions, w, now),
    ...detectPlateau(sessions, w, now),
    ...detectProgress(sessions, w, now),
    ...detectConsistency(sessions, w, targetDays, now),
    ...detectRecords(sessions, w),
    ...detectProgramming(sessions, w),
    ...detectRecovery(sessions, now),
  ].sort((a, b) => b.weight - a.weight);

  // the opener: praise something real, then say how much is being withheld
  const good = all.find((i) => i.severity === 'good');
  const findings = all.filter((i) => i.severity !== 'good');
  const headline =
    good && findings.length
      ? {
          praise: good.headline,
          tease: `ATLAS found ${findings.length} thing${findings.length === 1 ? '' : 's'} in your training that ${findings.length === 1 ? 'is' : 'are'} holding you back.`,
          findingCount: findings.length,
        }
      : findings.length
      ? {
          praise: `${inWindow.length} sessions logged this period.`,
          tease: `ATLAS found ${findings.length} thing${findings.length === 1 ? '' : 's'} in your training that ${findings.length === 1 ? 'is' : 'are'} holding you back.`,
          findingCount: findings.length,
        }
      : good
      ? { praise: good.headline, tease: 'Nothing is flagged. This is what a clean block looks like.', findingCount: 0 }
      : null;

  // What is free: every piece of good news, plus the single most severe
  // finding shown completely. Charging for praise reads as petty and teaches
  // people that opening the app costs money; charging for the diagnosis and
  // the fix is the thing that is actually worth paying for. It also sharpens
  // the pitch — ATLAS tells you for free what is working, and asks to be paid
  // for what is not.
  const goodNews = all.filter((i) => i.severity === 'good');
  const free = [...findings.slice(0, freeCount), ...goodNews];
  const locked = findings.slice(freeCount);

  return { headline, free, locked, all, hasEnoughData: true, balance, balanceScore: score };
}

/** Whether this insight's detail and action are visible on the current tier. */
export function isUnlocked(report: InsightReport, insight: Insight, isPro: boolean): boolean {
  return isPro || report.free.some((i) => i.id === insight.id);
}

/**
 * A worked example, for the empty state and the Day-0 paywall.
 *
 * The failure mode this exists to avoid is the one that kills AI fitness apps:
 * the analysis only becomes valuable after weeks of logging, so a new user
 * sees an empty screen, concludes there is nothing here, and leaves before the
 * engine ever has data. Showing a real, fully-formed insight up front — built
 * from example numbers and labelled as such — demonstrates the product on day
 * one without ever passing invented figures off as the user's own.
 */
export function sampleInsight(): Insight {
  return {
    id: 'sample',
    kind: 'imbalance',
    severity: 'warn',
    headline: 'Your rear delts are being left behind your front delts',
    preview: 'Front-to-rear delt work is at roughly 2.7:1.',
    detail: [
      'Front delts: 54 sets. Rear delts: 20 sets.',
      'Front delts are hit by every press you do, so they accumulate volume whether you plan it or not. Rear delts get almost nothing unless you deliberately train them.',
      'This is the most common imbalance in people who train hard, and the one that most visibly changes how a physique reads from the side.',
    ],
    action:
      'Two dedicated rear-delt sets at the start of every upper-body session. Reverse flyes or face pulls, 12–20 reps, taken close to failure.',
    metrics: [
      { label: 'Front', value: '54' },
      { label: 'Rear', value: '20' },
      { label: 'Ratio', value: '2.7:1' },
    ],
    weight: 75,
  };
}

/** Sessions still needed before the engine has anything worth saying. */
export function sessionsUntilInsights(sessions: WorkoutSession[], now = Date.now()): number {
  const w = rangeWindow(sessions, '30D', now);
  return Math.max(0, MIN_SESSIONS_FOR_INSIGHTS - sessionsInWindow(sessions, w).length);
}

export { REGION_LABELS };
export type { MuscleRegion, RegionBalance };
