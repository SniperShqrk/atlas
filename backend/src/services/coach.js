import Anthropic from '@anthropic-ai/sdk';
import { EXERCISES } from '../data/exercises.js';

const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Same cheap/fast model as the planner — a bottom-sheet chat needs low
 *  latency more than the planner does, so this is the more important place
 *  to stay on Haiku, not less. */
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * The whole discipline of this feature in one file: the model never computes
 * anything about the user's training (no plateau detection, no 1RM math) and
 * never invents an exercise. It explains, and it proposes bounded, structured
 * edits to the plan that the app validates and the user approves — see
 * validateMutation below and the propose_* schemas.
 */
const SYSTEM_PROMPT = `You are the ATLAS training coach — a calm, direct strength-training assistant embedded in a workout app. Tone rules, non-negotiable:
- Second person, no name, no persona. Never introduce yourself.
- Direct and plain. No exclamation marks, no emoji, no hype, no praise for just showing up.
- Never restate numbers you weren't given. Every stat you cite must come from the CONTEXT block below, verbatim or trivially reworded — you do not compute 1RM, volume, or plateau status yourself. When INSIGHTS ENGINE FLAGS are present, those are the only source of truth for "is this stalled/imbalanced/neglected" — cite their numbers, don't re-derive your own.
- You are not a doctor. On stated pain or discomfort, you may substitute an exercise that avoids the stated movement, but you never name a condition, diagnose, or suggest treatment. If asked something medical, say plainly that's outside what you can help with and suggest they see a professional.
- If asked about nutrition, supplements, or anything outside this user's own logged training and current plan, give a short, honest deflection back to training — you are not a general chatbot.
- You cannot generate a brand-new multi-week program from scratch. If the user wants that, tell them to use the plan generator on the Plan tab.

You can propose exactly two kinds of change to the user's current plan, using the tools provided: swapping one exercise for another on a specific day, and time-boxing a day down to fewer exercises to fit less time. Always explain the reasoning in plain text alongside the tool call. Never claim a change was made — the app shows the user a diff and they decide to apply it or not.

If nothing in the message calls for a plan change, just reply in text — do not force a tool call.`;

const TOOLS = [
  {
    name: 'propose_exercise_swap',
    description:
      "Propose swapping one exercise on a specific day of the user's current plan for a different one from the catalog — e.g. because of stated discomfort, lack of equipment, or boredom with a lift.",
    input_schema: {
      type: 'object',
      properties: {
        dayIndex: { type: 'integer', description: 'Index into the current plan\'s days array (0-based).' },
        exerciseIndex: {
          type: 'integer',
          description: "Index of the exercise within that day's exercises array (0-based).",
        },
        toExerciseId: {
          type: 'string',
          description: 'Replacement exercise id, spelled exactly as it appears in the CATALOG.',
        },
        reason: { type: 'string', description: 'One sentence on why this swap fits what the user asked for.' },
      },
      required: ['dayIndex', 'exerciseIndex', 'toExerciseId', 'reason'],
    },
  },
  {
    name: 'propose_session_timebox',
    description:
      "Propose cutting a specific day of the user's current plan down to fewer exercises so it fits a shorter time budget, keeping the heaviest compounds and dropping accessories/isolation first.",
    input_schema: {
      type: 'object',
      properties: {
        dayIndex: { type: 'integer', description: '0-based index into the current plan\'s days array.' },
        removeExerciseIndexes: {
          type: 'array',
          items: { type: 'integer' },
          description: "0-based indexes (into that day's exercises array) of the exercises to drop.",
        },
        estimatedMinutes: { type: 'integer', description: 'Rough new session length after the cut.' },
        reason: { type: 'string', description: 'One sentence on what was dropped and why.' },
      },
      required: ['dayIndex', 'removeExerciseIndexes', 'estimatedMinutes', 'reason'],
    },
  },
];

function formatSession(s) {
  const date = new Date(s.completedAt ?? s.startedAt).toISOString().slice(0, 10);
  const items = (s.entries ?? [])
    .map((e) => {
      const sets = (e.sets ?? []).filter((x) => x.completed && !x.warmup);
      if (!sets.length) return null;
      const top = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a), sets[0]);
      return `${e.exerciseId} ${sets.length}x${top.reps}@${top.weightKg}kg`;
    })
    .filter(Boolean)
    .join(', ');
  return `- ${date}: ${items || '(nothing completed)'}`;
}

function formatPlan(plan) {
  if (!plan) return '(no active plan)';
  return plan.days
    .map(
      (day, i) =>
        `Day ${i} — "${day.label}" (${day.focus}${day.estimatedMinutes ? `, ~${day.estimatedMinutes}min` : ''}):\n` +
        day.exercises
          .map((ex, j) => `  [${j}] ${ex.exerciseId} — ${ex.targetSets}x${ex.targetReps}`)
          .join('\n')
    )
    .join('\n');
}

const ENTRY_POINT_NOTE = {
  plan: 'Opened from the Plan screen — the user is looking at their whole plan.',
  exercise:
    'Opened from an in-progress workout, from the overflow menu on one specific exercise (see FOCUSED EXERCISE below).',
  insight: 'Opened from a flagged insight card (see FLAGGED INSIGHT below).',
  weekly_checkin: 'Opened from the weekly check-in card.',
};

function formatInsightsDigest(digest) {
  if (!digest?.length) return '(none computed, or not enough training history yet)';
  return digest
    .map((i) => {
      const metrics = (i.metrics ?? []).map((m) => `${m.label}: ${m.value}`).join(', ');
      return `- [${i.severity}/${i.kind}] ${i.headline} — ${i.preview}${metrics ? ` (${metrics})` : ''}`;
    })
    .join('\n');
}

function buildContextBlock({ profile, recentSessions, currentPlan, entryPoint, seed, insightsDigest }) {
  const limitations = profile?.limitations?.trim() || 'none reported';
  const catalogNote = `Exercise catalog has ${EXERCISES.length} entries; use get by id, never invent one.`;

  let focusLine = '';
  if (entryPoint === 'exercise' && seed?.exerciseId) {
    const ex = EXERCISE_BY_ID.get(seed.exerciseId);
    focusLine = `\nFOCUSED EXERCISE: ${seed.exerciseId}${ex ? ` (${ex.name})` : ''}, day index ${seed.dayIndex ?? 'unknown'}`;
  }
  if (entryPoint === 'insight' && seed) {
    focusLine = `\nFLAGGED INSIGHT (the reason this conversation opened): ${JSON.stringify(seed)}`;
  }
  if (entryPoint === 'weekly_checkin' && seed) {
    focusLine = `\nWEEKLY CHECK-IN (the reason this conversation opened): ${seed.sessionCount} of ${seed.targetDaysPerWeek} sessions this week, vs ${seed.previousSessionCount} last week${seed.volumeChangePct !== null && seed.volumeChangePct !== undefined ? `, volume ${seed.volumeChangePct > 0 ? '+' : ''}${seed.volumeChangePct}% vs last week` : ''}.`;
  }

  return `CONTEXT
${ENTRY_POINT_NOTE[entryPoint] ?? ''}${focusLine}

LIFTER
- Goal: ${profile?.goal}
- Experience: ${profile?.experience}
- Equipment: ${(profile?.equipment ?? []).join(', ')}
- Injuries / things to work around: ${limitations}

CURRENT PLAN
${formatPlan(currentPlan)}

RECENT SESSIONS (most recent first)
${(recentSessions ?? []).slice(0, 10).map(formatSession).join('\n') || '(no history yet)'}

INSIGHTS ENGINE FLAGS (already computed — cite these numbers verbatim, never recompute)
${formatInsightsDigest(insightsDigest)}

${catalogNote}`;
}

/** Every propose_* result is checked against the actual plan and catalog
 *  before it ever reaches the client — a hallucinated index or exercise id
 *  becomes a rejected proposal, never a corrupted plan. */
function validateMutation(toolUse, currentPlan) {
  if (!currentPlan) return { error: 'No active plan to edit.' };
  const { name, input } = toolUse;

  if (name === 'propose_exercise_swap') {
    const day = currentPlan.days[input.dayIndex];
    if (!day) return { error: 'That day is not in the current plan.' };
    const exercise = day.exercises[input.exerciseIndex];
    if (!exercise) return { error: 'That exercise is not on that day.' };
    if (!EXERCISE_BY_ID.has(input.toExerciseId)) return { error: 'Unknown replacement exercise.' };
    return {
      mutation: {
        type: 'exercise_swap',
        dayIndex: input.dayIndex,
        exerciseIndex: input.exerciseIndex,
        fromExerciseId: exercise.exerciseId,
        toExerciseId: input.toExerciseId,
        reason: input.reason,
      },
    };
  }

  if (name === 'propose_session_timebox') {
    const day = currentPlan.days[input.dayIndex];
    if (!day) return { error: 'That day is not in the current plan.' };
    const indexes = [...new Set(input.removeExerciseIndexes)].filter(
      (i) => i >= 0 && i < day.exercises.length
    );
    if (!indexes.length) return { error: 'Nothing valid to remove.' };
    if (indexes.length >= day.exercises.length) return { error: "Can't remove the whole day." };
    return {
      mutation: {
        type: 'session_timebox',
        dayIndex: input.dayIndex,
        removeExerciseIndexes: indexes,
        removedNames: indexes.map((i) => day.exercises[i].exerciseId),
        estimatedMinutes: input.estimatedMinutes,
        reason: input.reason,
      },
    };
  }

  return { error: 'Unknown tool.' };
}

export async function generateCoachTurn({
  profile,
  recentSessions = [],
  currentPlan = null,
  entryPoint = 'plan',
  seed = null,
  insightsDigest = [],
  conversation = [],
  userMessage,
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      message:
        "The coach needs an API key configured on the backend — ask whoever runs this server to set ANTHROPIC_API_KEY.",
      proposal: null,
    };
  }

  const contextBlock = buildContextBlock({ profile, recentSessions, currentPlan, entryPoint, seed, insightsDigest });

  const messages = [
    { role: 'user', content: contextBlock },
    { role: 'assistant', content: "Understood — I'll use only that context. What's the question?" },
    ...conversation.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const toolUse = response.content.find((b) => b.type === 'tool_use');

  let proposal = null;
  let message = textBlock?.text?.trim() || '';

  if (toolUse) {
    const { mutation, error } = validateMutation(toolUse, currentPlan);
    if (mutation) {
      proposal = mutation;
    } else if (error) {
      message = message || `I tried to propose a change but it didn't check out: ${error}`;
    }
  }

  if (!message) message = "I didn't have anything useful to add there.";

  return { message, proposal };
}
