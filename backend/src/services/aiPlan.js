import Anthropic from '@anthropic-ai/sdk';
import { EXERCISES } from '../data/exercises.js';
import { computeMuscleLoads } from './recovery.js';
import { generateRuleBasedPlan } from './ruleBasedPlan.js';

const EXERCISE_ID_SET = new Set(EXERCISES.map((e) => e.id));

/** Haiku: fast and cheap enough to regenerate a plan whenever the user wants. */
const MODEL = 'claude-haiku-4-5-20251001';

const EQUIPMENT_MAP = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'smith', 'kettlebell', 'band'],
  home_dumbbells: ['dumbbell', 'bodyweight', 'band', 'kettlebell'],
  bodyweight_only: ['bodyweight'],
};

/** Weekly working-set targets, mirrored from the app's volume landmarks. */
const WEEKLY_TARGETS = {
  chest: [10, 20], lats: [10, 22], traps: [8, 20], front_delts: [6, 16], side_delts: [12, 26],
  rear_delts: [10, 24], biceps: [8, 20], triceps: [8, 20], forearms: [4, 16], abs: [6, 20],
  obliques: [4, 16], lower_back: [4, 12], quads: [10, 20], hamstrings: [8, 16],
  glutes: [6, 16], calves: [8, 20],
};

function weeklySets(sessions) {
  const counts = {};
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const s of sessions) {
    const when = s.completedAt ?? s.startedAt;
    if (when < since) continue;
    for (const entry of s.entries ?? []) {
      const ex = EXERCISES.find((e) => e.id === entry.exerciseId);
      if (!ex) continue;
      const n = (entry.sets ?? []).filter((x) => x.completed && !x.warmup).length;
      if (!n) continue;
      for (const m of ex.primaryMuscles) counts[m] = (counts[m] ?? 0) + n;
      for (const m of ex.secondaryMuscles) counts[m] = (counts[m] ?? 0) + n * 0.5;
    }
  }
  return counts;
}

function buildPrompt(profile, recentSessions, loads) {
  // Profiles now carry the actual owned-equipment list (see the app's
  // UserProfile.equipment) rather than one of three coarse tiers. Fall back to
  // the old tiers only for a profile shape saved before that change.
  const allowed = Array.isArray(profile.equipment)
    ? profile.equipment
    : EQUIPMENT_MAP[profile.equipmentAccess] ?? EQUIPMENT_MAP.full_gym;
  const catalog = EXERCISES.filter((e) => allowed.includes(e.equipment))
    .map((e) => {
      const sec = e.secondaryMuscles.length ? ` | also ${e.secondaryMuscles.join(',')}` : '';
      return `${e.id} :: ${e.name} [${e.split}/${e.mechanic}/${e.equipment}] hits ${e.primaryMuscles.join(',')}${sec}`;
    })
    .join('\n');

  const recovery = Object.values(loads)
    .sort((a, b) => a.recoveryPct - b.recoveryPct)
    .map((l) => `${l.muscle}: ${l.recoveryPct}% recovered`)
    .join('; ');

  const volume = weeklySets(recentSessions);
  const volumeLines = Object.entries(WEEKLY_TARGETS)
    .map(([m, [lo, hi]]) => {
      const done = volume[m] ?? 0;
      const flag = done < lo ? 'UNDER' : done > hi ? 'OVER' : 'ok';
      return `${m}: ${done} sets last 7d (target ${lo}-${hi}) ${flag}`;
    })
    .join('\n');

  const history = recentSessions
    .slice(0, 8)
    .map((s) => {
      const date = new Date(s.completedAt ?? s.startedAt).toISOString().slice(0, 10);
      const items = (s.entries ?? [])
        .map((e) => {
          const sets = (e.sets ?? []).filter((x) => x.completed);
          if (!sets.length) return null;
          const top = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a), sets[0]);
          return `${e.exerciseId} ${sets.length}x${top.reps}@${top.weightKg}kg`;
        })
        .filter(Boolean)
        .join(', ');
      return `- ${date}: ${items || '(nothing completed)'}`;
    })
    .join('\n');

  const limitations = profile.limitations?.trim()
    ? profile.limitations.trim()
    : 'none reported';

  // Left as prose ("roughly 3 minutes per set, so cap accordingly") a small,
  // cheap model like Haiku reliably undershoots this — e.g. a 90-minute
  // session coming back with 4 exercises and maybe 12 working sets, less
  // than half the session actually used. Doing the arithmetic here and
  // handing over a concrete target number (with an explicit minimum) fixes
  // that far more reliably than trusting the model to divide it out itself.
  const sessionMinutes = profile.sessionMinutes ?? 60;
  const targetSets = Math.max(6, Math.round(sessionMinutes / 3));
  const minSets = Math.max(4, Math.round(targetSets * 0.85));
  const minExercises = Math.max(3, Math.round(targetSets / 5));
  const maxExercises = Math.max(minExercises + 1, Math.round(targetSets / 3));

  return `You are an experienced strength coach writing a training week for one lifter.

LIFTER
- Goal: ${profile.goal}
- Experience: ${profile.experience}
- Training days per week: ${profile.daysPerWeek}
- Time available per session: ${sessionMinutes} minutes — that's a budget of about ${targetSets} total working sets per day at ~3 min/set including rest
- Equipment: ${allowed.join(', ')}
- Preferred split: ${profile.preferredSplit ?? 'no preference — choose what fits the day count'}
- Wants extra emphasis on: ${(profile.emphasis ?? []).join(', ') || 'nothing in particular'}
- Injuries / things to work around: ${limitations}
- Bodyweight: ${profile.weightKg ? profile.weightKg + 'kg' : 'not given'}

CURRENT RECOVERY (from their logged sets)
${recovery || 'no training logged yet'}

WEEKLY VOLUME vs TARGETS
${volumeLines}

RECENT SESSIONS
${history || '(no history yet)'}

EXERCISE CATALOG — you may ONLY use these ids
${catalog}

RULES
1. Use exactly ${profile.daysPerWeek} training days.
2. Every exerciseId must come from the catalog above, spelled exactly.
3. Each day must total ${minSets}-${targetSets} working sets (warm-up sets don't count) to actually fill the ${sessionMinutes}-minute session — do not undershoot this. That usually means ${minExercises}-${maxExercises} exercises per day, mixing compounds (3-5 sets each) with accessories/isolation (2-4 sets each); use the low end of that exercise range for a short session and the high end for a long one, not a flat 4-5 exercises regardless of time.
4. Open each day with its heaviest compound, then accessories, then isolation.
5. Push muscles marked UNDER toward their target; ease off anything marked OVER.
6. Respect the injury notes — leave out anything that would aggravate them and say so in the summary.
7. Do not put the same muscle group under heavy load on consecutive days.
8. Vary rep ranges to suit the goal: strength 3-6, hypertrophy 6-12, endurance 12-20.

Reply with ONLY valid JSON in exactly this shape. No prose, no markdown fences.
{
  "summary": "2-3 sentences on the logic of the week and any adjustments made for injuries or volume",
  "days": [
    {
      "label": "Day 1",
      "focus": "short name, e.g. Push",
      "estimatedMinutes": 55,
      "exercises": [
        { "exerciseId": "barbell_bench_press", "targetSets": 4, "targetReps": "6-8", "note": "optional one-line cue" }
      ]
    }
  ]
}`;
}

function tryParsePlanJSON(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');
  const parsed = JSON.parse(cleaned);
  if (!parsed.days || !Array.isArray(parsed.days)) throw new Error('malformed plan: missing days');

  for (const day of parsed.days) {
    if (!Array.isArray(day.exercises)) throw new Error('malformed plan: day missing exercises');
    // drop anything the model invented
    day.exercises = day.exercises.filter((ex) => EXERCISE_ID_SET.has(ex.exerciseId));
  }
  const withWork = parsed.days.filter((d) => d.exercises.length > 0);
  if (!withWork.length) throw new Error('plan had no usable exercises');
  parsed.days = withWork;
  return parsed;
}

export async function generatePlan(profile, recentSessions = []) {
  const loads = computeMuscleLoads(recentSessions);

  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRuleBasedPlan(profile, recentSessions);
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      // a low temperature keeps exercise selection sane and repeatable
      temperature: 0.4,
      messages: [{ role: 'user', content: buildPrompt(profile, recentSessions, loads) }],
    });

    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const parsed = tryParsePlanJSON(text);

    return {
      id: `ai_${Date.now()}`,
      createdAt: Date.now(),
      source: 'ai',
      model: MODEL,
      summary: parsed.summary,
      days: parsed.days,
    };
  } catch (err) {
    console.error('AI plan generation failed, falling back to the built-in generator:', err.message);
    return generateRuleBasedPlan(profile, recentSessions);
  }
}
