import { EXERCISES, exercisesByEquipment } from '../data/exercises.js';
import { computeMuscleLoads } from './recovery.js';

const EQUIPMENT_MAP = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'smith', 'kettlebell', 'band'],
  home_dumbbells: ['dumbbell', 'bodyweight', 'band', 'kettlebell'],
  bodyweight_only: ['bodyweight'],
};

/**
 * Each split day declares which movement buckets it draws from and how many
 * exercises to pick, so a "Legs & Core" day gets legs work plus a core finisher
 * rather than five random leg machines.
 */
const SPLITS_BY_DAYS = {
  2: [
    { label: 'Day 1', focus: 'Full Body A', buckets: { push: 2, pull: 2, legs: 2 } },
    { label: 'Day 2', focus: 'Full Body B', buckets: { legs: 2, pull: 2, push: 1, core: 1 } },
  ],
  3: [
    { label: 'Day 1', focus: 'Push', buckets: { push: 5 } },
    { label: 'Day 2', focus: 'Pull', buckets: { pull: 5 } },
    { label: 'Day 3', focus: 'Legs', buckets: { legs: 4, core: 2 } },
  ],
  4: [
    { label: 'Day 1', focus: 'Upper Push', buckets: { push: 5 } },
    { label: 'Day 2', focus: 'Lower', buckets: { legs: 5 } },
    { label: 'Day 3', focus: 'Upper Pull', buckets: { pull: 5 } },
    { label: 'Day 4', focus: 'Legs & Core', buckets: { legs: 4, core: 2 } },
  ],
  5: [
    { label: 'Day 1', focus: 'Push', buckets: { push: 5 } },
    { label: 'Day 2', focus: 'Pull', buckets: { pull: 5 } },
    { label: 'Day 3', focus: 'Legs', buckets: { legs: 5 } },
    { label: 'Day 4', focus: 'Upper', buckets: { push: 3, pull: 3 } },
    { label: 'Day 5', focus: 'Lower & Core', buckets: { legs: 4, core: 2 } },
  ],
  6: [
    { label: 'Day 1', focus: 'Push', buckets: { push: 5 } },
    { label: 'Day 2', focus: 'Pull', buckets: { pull: 5 } },
    { label: 'Day 3', focus: 'Legs', buckets: { legs: 5 } },
    { label: 'Day 4', focus: 'Push', buckets: { push: 5 } },
    { label: 'Day 5', focus: 'Pull', buckets: { pull: 5 } },
    { label: 'Day 6', focus: 'Legs & Core', buckets: { legs: 4, core: 2 } },
  ],
};

function repsForGoal(goal) {
  switch (goal) {
    case 'strength':
      return '4-6';
    case 'build_muscle':
      return '8-12';
    case 'lose_fat':
      return '12-15';
    default:
      return '8-12';
  }
}

function setsForExperience(experience, mechanic) {
  const base = experience === 'beginner' ? 3 : experience === 'advanced' ? 4 : 3;
  return mechanic === 'compound' ? base + 1 : base;
}

export function generateRuleBasedPlan(profile, recentSessions = []) {
  // Profiles now carry the actual owned-equipment list (see the app's
  // UserProfile.equipment) rather than one of three coarse tiers. Fall back to
  // the old tiers only for a profile shape saved before that change.
  const allowedEquipment = Array.isArray(profile.equipment)
    ? profile.equipment
    : EQUIPMENT_MAP[profile.equipmentAccess] ?? EQUIPMENT_MAP.full_gym;
  const available = exercisesByEquipment(allowedEquipment);
  const loads = computeMuscleLoads(recentSessions);
  const template = SPLITS_BY_DAYS[profile.daysPerWeek] ?? SPLITS_BY_DAYS[4];
  const reps = repsForGoal(profile.goal);

  // avoid repeating the same exercise across the whole week where possible
  const usedCounts = {};

  const days = template.map((day) => {
    const chosen = [];
    // how many exercises already picked today hit each primary muscle
    const muscleCount = {};

    for (const [bucket, count] of Object.entries(day.buckets)) {
      const pool = available.filter((e) => e.split === bucket);

      for (let picked = 0; picked < count; picked++) {
        let best = null;
        let bestScore = -Infinity;

        for (const ex of pool) {
          if (chosen.some((c) => c.exerciseId === ex.id)) continue;

          const recoveryScores = ex.primaryMuscles.map((m) => loads[m]?.recoveryPct ?? 100);
          const avgRecovery =
            recoveryScores.reduce((a, b) => a + b, 0) / (recoveryScores.length || 1);

          // compounds lead the session
          const compoundBonus = ex.mechanic === 'compound' ? 30 : 0;
          // heavily discourage stacking the same muscle (five bench variations in a row)
          const overlap = ex.primaryMuscles.reduce((sum, m) => sum + (muscleCount[m] ?? 0), 0);
          const overlapPenalty = overlap * 55;
          // spread exercises across the week
          const repeatPenalty = (usedCounts[ex.id] ?? 0) * 70;
          // a small nudge so the first pick of a bucket is a big compound
          const orderBonus = picked === 0 && ex.mechanic === 'compound' ? 20 : 0;

          const score = avgRecovery + compoundBonus + orderBonus - overlapPenalty - repeatPenalty;
          if (score > bestScore) {
            bestScore = score;
            best = ex;
          }
        }

        if (!best) break;

        chosen.push({
          exerciseId: best.id,
          targetSets: setsForExperience(profile.experience, best.mechanic),
          targetReps: best.mechanic === 'compound' ? reps : reps === '4-6' ? '8-10' : reps,
        });
        usedCounts[best.id] = (usedCounts[best.id] ?? 0) + 1;
        for (const m of best.primaryMuscles) {
          muscleCount[m] = (muscleCount[m] ?? 0) + 1;
        }
      }
    }

    const totalSets = chosen.reduce((n, c) => n + c.targetSets, 0);
    return {
      label: day.label,
      focus: day.focus,
      estimatedMinutes: Math.round(totalSets * 3),
      exercises: chosen,
    };
  });

  return {
    id: `rb_${Date.now()}`,
    createdAt: Date.now(),
    source: 'rule_based',
    summary: `A ${profile.daysPerWeek}-day ${profile.goal.replace(
      '_',
      ' '
    )} split for ${profile.experience} level. Compounds are prioritised first in each session, and exercise selection favours muscle groups that have recovered most since your recent training.`,
    days,
  };
}
