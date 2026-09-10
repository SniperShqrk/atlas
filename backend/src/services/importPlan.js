import Anthropic from '@anthropic-ai/sdk';
import { EXERCISES } from '../data/exercises.js';

/** Same model as the AI planner — cheap and fast enough for a one-off parse,
 *  and it reads images fine for a photo of a whiteboard/printout/screenshot. */
const MODEL = 'claude-haiku-4-5-20251001';

const CATEGORIES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full_body'];
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith'];
const MUSCLES = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'lats', 'traps', 'lower_back',
  'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves',
];
const PATTERNS = [
  'horizontal_press', 'vertical_press', 'dip', 'chest_fly',
  'vertical_pull', 'horizontal_pull', 'straight_arm_pull', 'rear_delt', 'shrug',
  'lateral_raise', 'front_raise', 'elbow_flexion', 'elbow_extension', 'wrist',
  'squat', 'leg_press', 'lunge', 'hinge', 'knee_flexion', 'knee_extension',
  'hip_thrust', 'hip_abduction', 'calf_raise', 'back_extension',
  'trunk_flexion', 'anti_extension', 'rotation', 'anti_rotation', 'anti_lateral_flexion', 'carry',
];

const EXERCISE_ID_SET = new Set(EXERCISES.map((e) => e.id));

function buildPrompt() {
  const catalog = EXERCISES.map((e) => `${e.id} :: ${e.name} [${e.equipment}] hits ${e.primaryMuscles.join(',')}`).join('\n');

  return `You are reading a lifter's own workout plan (a photo of handwriting/a printout/a screenshot, or pasted text) and converting it into ATLAS's structured format.

For every exercise the plan mentions, try hard to match it to the EXACT id of an equivalent exercise in the catalog below (synonyms, abbreviations and slightly different names all count as a match — e.g. "DB shoulder press" matches a dumbbell overhead/shoulder press in the catalog, "Romanian DL" matches a Romanian deadlift). Only when there is genuinely no equivalent in the catalog should you invent a new custom exercise.

CATALOG — match against these ids when you can
${catalog}

ALLOWED VALUES for anything you invent
- category: ${CATEGORIES.join(', ')}
- equipment: ${EQUIPMENT.join(', ')}
- muscles: ${MUSCLES.join(', ')}
- pattern: ${PATTERNS.join(', ')}
- mechanic: compound, isolation

RULES
1. Preserve the plan's own structure and order — same number of days, same exercise order, same sets/reps if given (if reps are a range like "8-12" keep it as a string; if only one number is given, use it as-is, e.g. "10"). If sets or reps are missing for an exercise, make a sensible estimate for the apparent goal/experience level rather than leaving it blank.
2. Give each day a short focus label (e.g. "Push", "Legs", "Upper A") inferred from its exercises, even if the source didn't name it.
3. For an exercise matched to the catalog, set "exerciseId" to that exact catalog id and omit "newExercise".
4. For an exercise with no catalog equivalent, invent a stable "tempId" (lowercase, underscores, prefixed "new_", e.g. "new_landmine_press") and reference that same string as its "exerciseId" in the day's exercise list, AND include a full definition for it in "newExercises" using only the allowed values above.
5. Never invent an exerciseId that isn't either a real catalog id or one of your own newExercises tempIds.
6. If the source is illegible, empty, or clearly isn't a workout plan, return zero days and explain why in "summary".

Reply with ONLY valid JSON in exactly this shape. No prose, no markdown fences.
{
  "summary": "1-2 sentences on what you found and any exercises you couldn't match",
  "days": [
    {
      "label": "Day 1",
      "focus": "short name",
      "exercises": [
        { "exerciseId": "barbell_bench_press", "targetSets": 4, "targetReps": "6-8", "note": "optional one-line note, e.g. if you guessed the sets/reps" }
      ]
    }
  ],
  "newExercises": [
    {
      "tempId": "new_landmine_press",
      "name": "Landmine Press",
      "category": "shoulders",
      "equipment": "barbell",
      "primaryMuscles": ["front_delts"],
      "secondaryMuscles": ["triceps"],
      "pattern": "vertical_press",
      "mechanic": "compound"
    }
  ]
}`;
}

function sanitize(parsed) {
  if (!parsed || !Array.isArray(parsed.days)) throw new Error('malformed import: missing days');

  const newExercises = Array.isArray(parsed.newExercises) ? parsed.newExercises : [];
  const validNew = newExercises.filter(
    (e) =>
      e &&
      typeof e.tempId === 'string' &&
      typeof e.name === 'string' &&
      CATEGORIES.includes(e.category) &&
      EQUIPMENT.includes(e.equipment) &&
      Array.isArray(e.primaryMuscles) &&
      e.primaryMuscles.every((m) => MUSCLES.includes(m)) &&
      PATTERNS.includes(e.pattern)
  );
  for (const e of validNew) {
    if (!Array.isArray(e.secondaryMuscles)) e.secondaryMuscles = [];
    else e.secondaryMuscles = e.secondaryMuscles.filter((m) => MUSCLES.includes(m));
    if (e.mechanic !== 'isolation') e.mechanic = 'compound';
  }
  const validIdSet = new Set([...EXERCISE_ID_SET, ...validNew.map((e) => e.tempId)]);

  for (const day of parsed.days) {
    if (!Array.isArray(day.exercises)) throw new Error('malformed import: day missing exercises');
    day.exercises = day.exercises.filter((ex) => ex && validIdSet.has(ex.exerciseId));
  }
  parsed.days = parsed.days.filter((d) => d.exercises.length > 0);
  // only keep invented exercises that a surviving day actually references
  const usedIds = new Set(parsed.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
  parsed.newExercises = validNew.filter((e) => usedIds.has(e.tempId));

  return parsed;
}

function tryParseJSON(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');
  return JSON.parse(cleaned);
}

/**
 * text and/or up to a few images (base64 + media type) describing a workout
 * plan in the user's own words/handwriting/screenshot. Returns a
 * GeneratedPlan-shaped object plus any brand-new exercises the app needs to
 * create locally before the plan's exerciseIds will resolve (see tempId in
 * newExercises).
 */
export async function importWorkout({ text, images }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('Import Workouts needs ANTHROPIC_API_KEY set on the backend — there is no offline fallback for reading arbitrary photos/text.');
    err.code = 'NO_API_KEY';
    throw err;
  }
  if (!text?.trim() && !images?.length) {
    throw new Error('Provide either pasted text or a photo to import.');
  }

  const content = [];
  for (const img of images ?? []) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType || 'image/jpeg', data: img.base64 },
    });
  }
  content.push({ type: 'text', text: text?.trim() ? `Pasted plan text:\n${text.trim()}` : 'Read the plan from the attached photo(s).' });
  content.push({ type: 'text', text: buildPrompt() });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    temperature: 0.2,
    messages: [{ role: 'user', content }],
  });

  const responseText = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const parsed = sanitize(tryParseJSON(responseText));

  return {
    id: `import_${Date.now()}`,
    createdAt: Date.now(),
    source: 'imported',
    model: MODEL,
    summary: parsed.summary,
    days: parsed.days,
    newExercises: parsed.newExercises,
  };
}
