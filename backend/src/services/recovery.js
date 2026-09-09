import { getExerciseById } from '../data/exercises.js';

export const RECOVERY_HALFLIFE_HOURS = {
  chest: 36, front_delts: 30, side_delts: 24, rear_delts: 24, lats: 36,
  traps: 30, lower_back: 48, biceps: 24, triceps: 28, forearms: 20,
  abs: 18, obliques: 18, quads: 48, hamstrings: 44, glutes: 40, calves: 24,
};

export function computeMuscleLoads(sessions, now = Date.now()) {
  const doses = {};

  for (const session of sessions) {
    const sessionTime = session.completedAt ?? session.startedAt;
    const hoursAgo = (now - sessionTime) / (1000 * 60 * 60);
    if (hoursAgo < 0 || hoursAgo > 24 * 14) continue;

    for (const entry of session.entries ?? []) {
      const exercise = getExerciseById(entry.exerciseId);
      if (!exercise) continue;
      const setCount = (entry.sets ?? []).filter((s) => s.completed && !s.warmup).length;
      if (setCount === 0) continue;

      const applyDose = (muscle, weight) => {
        const halflife = RECOVERY_HALFLIFE_HOURS[muscle];
        const decay = Math.pow(0.5, hoursAgo / halflife);
        const doseNow = setCount * weight * decay;
        if (!doses[muscle]) doses[muscle] = { totalDose: 0, lastTrainedAt: sessionTime, setCount: 0 };
        doses[muscle].totalDose += doseNow;
        doses[muscle].setCount += setCount * weight;
        doses[muscle].lastTrainedAt = Math.max(doses[muscle].lastTrainedAt, sessionTime);
      };

      for (const m of exercise.primaryMuscles) applyDose(m, 1.0);
      for (const m of exercise.secondaryMuscles) applyDose(m, 0.5);
    }
  }

  const result = {};
  for (const muscle of Object.keys(RECOVERY_HALFLIFE_HOURS)) {
    const d = doses[muscle];
    if (!d) {
      result[muscle] = { muscle, effectiveSets: 0, lastTrainedAt: null, recoveryPct: 100, status: 'untrained' };
      continue;
    }
    const fatiguePct = Math.min(100, (d.totalDose / 10) * 100);
    const recoveryPct = Math.round(100 - fatiguePct);
    let status;
    if (recoveryPct >= 90) status = 'fresh';
    else if (recoveryPct >= 65) status = 'ready';
    else if (recoveryPct >= 35) status = 'moderate';
    else status = 'fatigued';

    result[muscle] = {
      muscle,
      effectiveSets: Math.round(d.setCount * 10) / 10,
      lastTrainedAt: d.lastTrainedAt,
      recoveryPct,
      status,
    };
  }
  return result;
}
