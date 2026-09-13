import { GeneratedPlan } from '@/store/workoutStore';

/**
 * A few ready-made, sensible-by-default programs for anyone who'd rather
 * start training today than fill in Planner Settings and wait on the AI
 * generator (or who isn't Pro at all — these are free). Every exercise id
 * below is a real entry in data/exercises.ts; loadPresetProgram() in
 * workoutStore.ts turns one of these into a normal GeneratedPlan (with a
 * fresh id/createdAt), so from that point on it behaves exactly like an
 * AI-generated or imported plan — editable, saveable, startable.
 */
export type PresetProgram = Omit<GeneratedPlan, 'id' | 'createdAt' | 'source'>;

export const PREBUILT_PROGRAMS: PresetProgram[] = [
  {
    name: 'Push Pull Legs',
    summary:
      "3 days a week, split by movement — push one day, pull the next, legs the day after. The classic split for a reason: each muscle group gets a full session of focused volume and days of recovery before it's hit again.",
    days: [
      {
        label: 'Day 1',
        focus: 'Push',
        exercises: [
          { exerciseId: 'barbell_bench_press', targetSets: 4, targetReps: '6-8' },
          { exerciseId: 'incline_db_press', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'overhead_press', targetSets: 3, targetReps: '6-8' },
          { exerciseId: 'lateral_raise', targetSets: 3, targetReps: '12-15' },
          { exerciseId: 'triceps_pushdown', targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        label: 'Day 2',
        focus: 'Pull',
        exercises: [
          { exerciseId: 'deadlift', targetSets: 3, targetReps: '5' },
          { exerciseId: 'barbell_row', targetSets: 4, targetReps: '6-8' },
          { exerciseId: 'lat_pulldown', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'seated_cable_row', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'db_curl', targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        label: 'Day 3',
        focus: 'Legs',
        exercises: [
          { exerciseId: 'back_squat', targetSets: 4, targetReps: '5-8' },
          { exerciseId: 'romanian_deadlift', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'leg_press', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'leg_extension', targetSets: 3, targetReps: '12-15' },
          { exerciseId: 'standing_calf_raise', targetSets: 4, targetReps: '12-15' },
        ],
      },
    ],
  },
  {
    name: 'Upper / Lower',
    summary:
      '4 days a week, alternating upper and lower body. Twice the frequency per muscle group of a PPL split, with slightly less volume per session — a good fit if you can commit to 4 days but recover fast.',
    days: [
      {
        label: 'Day 1',
        focus: 'Upper A',
        exercises: [
          { exerciseId: 'barbell_bench_press', targetSets: 4, targetReps: '6-8' },
          { exerciseId: 'barbell_row', targetSets: 4, targetReps: '6-8' },
          { exerciseId: 'overhead_press', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'lat_pulldown', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'db_curl', targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        label: 'Day 2',
        focus: 'Lower A',
        exercises: [
          { exerciseId: 'back_squat', targetSets: 4, targetReps: '5-8' },
          { exerciseId: 'romanian_deadlift', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'leg_press', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'standing_calf_raise', targetSets: 4, targetReps: '12-15' },
        ],
      },
      {
        label: 'Day 3',
        focus: 'Upper B',
        exercises: [
          { exerciseId: 'incline_db_press', targetSets: 4, targetReps: '8-10' },
          { exerciseId: 'seated_cable_row', targetSets: 4, targetReps: '8-10' },
          { exerciseId: 'machine_shoulder_press', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'face_pull', targetSets: 3, targetReps: '12-15' },
          { exerciseId: 'hammer_curl', targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        label: 'Day 4',
        focus: 'Lower B',
        exercises: [
          { exerciseId: 'deadlift', targetSets: 3, targetReps: '5' },
          { exerciseId: 'walking_lunge', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'leg_extension', targetSets: 3, targetReps: '12-15' },
          { exerciseId: 'lying_leg_curl', targetSets: 3, targetReps: '10-12' },
        ],
      },
    ],
  },
  {
    name: 'Full Body',
    summary:
      '3 days a week, every major muscle group every session. The lowest time commitment of the three, and the most forgiving if a day gets missed — nothing goes more than a few days without training.',
    days: [
      {
        label: 'Day 1',
        focus: 'Full Body A',
        exercises: [
          { exerciseId: 'back_squat', targetSets: 3, targetReps: '6-8' },
          { exerciseId: 'barbell_bench_press', targetSets: 3, targetReps: '6-8' },
          { exerciseId: 'barbell_row', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'plank', targetSets: 3, targetReps: '30-45s' },
        ],
      },
      {
        label: 'Day 2',
        focus: 'Full Body B',
        exercises: [
          { exerciseId: 'deadlift', targetSets: 3, targetReps: '5' },
          { exerciseId: 'overhead_press', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'lat_pulldown', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'standing_calf_raise', targetSets: 3, targetReps: '12-15' },
        ],
      },
      {
        label: 'Day 3',
        focus: 'Full Body C',
        exercises: [
          { exerciseId: 'leg_press', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'incline_db_press', targetSets: 3, targetReps: '8-10' },
          { exerciseId: 'seated_cable_row', targetSets: 3, targetReps: '10-12' },
          { exerciseId: 'db_curl', targetSets: 3, targetReps: '10-12' },
        ],
      },
    ],
  },
];
