import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getExerciseById,
  setCustomExercises,
  Exercise,
  Category,
  Equipment,
  MuscleGroup,
} from '@/data/exercises';
import { MovementPattern } from '@/data/patterns';
import { estimate1RM } from '@/store/formulas';

export { estimate1RM };

export interface SetEntry {
  id: string;
  weightKg: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  /** warmup sets are logged but excluded from volume and recovery load */
  warmup?: boolean;
}

export interface ExerciseEntry {
  exerciseId: string;
  sets: SetEntry[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  startedAt: number;
  completedAt: number | null;
  entries: ExerciseEntry[];
  /** total seconds the session lasted, set on finish */
  durationSec?: number;
}

export type SplitPreference =
  | 'auto'
  | 'full_body'
  | 'upper_lower'
  | 'push_pull_legs'
  | 'bro_split';

export interface UserProfile {
  name: string;
  goal: 'build_muscle' | 'lose_fat' | 'strength' | 'general_fitness';
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  equipmentAccess: 'full_gym' | 'home_dumbbells' | 'bodyweight_only';
  defaultRestSec: number;
  unit: 'kg' | 'lb';
  /** minutes available per session — the planner sizes days to fit */
  sessionMinutes: number;
  preferredSplit: SplitPreference;
  /** muscle groups to bias the plan toward */
  emphasis: string[];
  /** free text: injuries, niggles, movements to avoid */
  limitations: string;
  weightKg?: number;
  heightCm?: number;
  barKg: number;
}

export interface BodyweightEntry {
  id: string;
  at: number;
  weightKg: number;
  note?: string;
}

export interface Routine {
  id: string;
  name: string;
  createdAt: number;
  exercises: { exerciseId: string; targetSets: number; targetReps: string }[];
}

export interface GeneratedPlan {
  id: string;
  createdAt: number;
  source: 'ai' | 'rule_based';
  /** model id, when the plan came from the AI planner */
  model?: string;
  summary: string;
  days: {
    label: string;
    focus: string;
    estimatedMinutes?: number;
    exercises: {
      exerciseId: string;
      targetSets: number;
      targetReps: string;
      note?: string;
    }[];
  }[];
}

export interface PersonalRecord {
  exerciseId: string;
  bestWeightKg: number;
  bestReps: number;
  bestE1rm: number;
  achievedAt: number;
  /** heaviest single-set weight*reps, tracked separately from e1RM — a
   *  high-rep set can out-volume a heavier low-rep set that wins on e1RM */
  bestSetVolumeKg: number;
  bestSetVolumeAt: number;
}

export interface CustomExerciseInput {
  name: string;
  category: Category;
  equipment: Equipment;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  pattern: MovementPattern;
  mechanic?: 'compound' | 'isolation';
}

/** Rough split bucket per category, only used if a custom exercise ever
 *  flows through code that reasons about push/pull/legs — the planner does
 *  not draw on custom exercises today, so this is a sensible default rather
 *  than something the user has to think about. */
const SPLIT_BY_CATEGORY: Record<Category, Exercise['split']> = {
  chest: 'push',
  shoulders: 'push',
  arms: 'push',
  back: 'pull',
  legs: 'legs',
  core: 'core',
  full_body: 'full_body',
};

interface WorkoutStoreState {
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  profile: UserProfile;
  currentPlan: GeneratedPlan | null;
  records: Record<string, PersonalRecord>;
  bodyweight: BodyweightEntry[];
  routines: Routine[];
  customExercises: Exercise[];
  /** Exercise ids the user has opened, most-recent-first, capped at 10 —
   *  powers the Home screen's "Recently Viewed" row. */
  recentlyViewed: string[];

  // rest timer
  restEndsAt: number | null;
  restTotalSec: number;

  startSession: (name?: string) => void;
  addExerciseToActive: (exerciseId: string) => void;
  removeExerciseFromActive: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, patch: Partial<SetEntry>) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  finishSession: () => WorkoutSession | null;
  discardActiveSession: () => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  setCurrentPlan: (plan: GeneratedPlan) => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;

  logBodyweight: (weightKg: number, note?: string) => void;
  removeBodyweight: (id: string) => void;

  saveRoutine: (name: string, exercises: Routine['exercises']) => Routine;
  saveActiveAsRoutine: (name: string) => Routine | null;
  deleteRoutine: (id: string) => void;
  startFromRoutine: (id: string) => void;

  addCustomExercise: (input: CustomExerciseInput) => Exercise;
  deleteCustomExercise: (id: string) => void;

  addRecentlyViewed: (exerciseId: string) => void;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}



export const useWorkoutStore = create<WorkoutStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSession: null,
      records: {},
      bodyweight: [],
      routines: [],
      customExercises: [],
      recentlyViewed: [],
      profile: {
        name: 'Hugo',
        goal: 'build_muscle',
        experience: 'intermediate',
        daysPerWeek: 4,
        equipmentAccess: 'full_gym',
        defaultRestSec: 120,
        unit: 'kg',
        sessionMinutes: 60,
        preferredSplit: 'auto',
        emphasis: [],
        limitations: '',
        barKg: 20,
      },
      currentPlan: null,
      restEndsAt: null,
      restTotalSec: 120,

      startSession: (name) => {
        const hour = new Date().getHours();
        const defaultName =
          hour < 12 ? 'Morning Workout' : hour < 17 ? 'Afternoon Workout' : 'Evening Workout';
        set({
          activeSession: {
            id: uid(),
            name: name ?? defaultName,
            startedAt: Date.now(),
            completedAt: null,
            entries: [],
          },
        });
      },

      addExerciseToActive: (exerciseId) => {
        const active = get().activeSession;
        if (!active) return;
        if (active.entries.some((e) => e.exerciseId === exerciseId)) return;
        set({
          activeSession: {
            ...active,
            // seed one empty set so the table is immediately usable
            entries: [
              ...active.entries,
              { exerciseId, sets: [{ id: uid(), weightKg: 0, reps: 0, completed: false }] },
            ],
          },
        });
      },

      removeExerciseFromActive: (exerciseId) => {
        const active = get().activeSession;
        if (!active) return;
        set({
          activeSession: {
            ...active,
            entries: active.entries.filter((e) => e.exerciseId !== exerciseId),
          },
        });
      },

      addSet: (exerciseId) => {
        const active = get().activeSession;
        if (!active) return;
        const entries = active.entries.map((e) => {
          if (e.exerciseId !== exerciseId) return e;
          const last = e.sets[e.sets.length - 1];
          return {
            ...e,
            sets: [
              ...e.sets,
              {
                id: uid(),
                weightKg: last?.weightKg ?? 0,
                reps: last?.reps ?? 0,
                completed: false,
              },
            ],
          };
        });
        set({ activeSession: { ...active, entries } });
      },

      updateSet: (exerciseId, setId, patch) => {
        const active = get().activeSession;
        if (!active) return;
        const entries = active.entries.map((e) =>
          e.exerciseId === exerciseId
            ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
            : e
        );
        set({ activeSession: { ...active, entries } });
      },

      toggleSetComplete: (exerciseId, setId) => {
        const active = get().activeSession;
        if (!active) return;
        let nowCompleted = false;
        const entries = active.entries.map((e) =>
          e.exerciseId === exerciseId
            ? {
                ...e,
                sets: e.sets.map((s) => {
                  if (s.id !== setId) return s;
                  nowCompleted = !s.completed;
                  return { ...s, completed: nowCompleted };
                }),
              }
            : e
        );
        set({ activeSession: { ...active, entries } });
        // completing a set kicks off the rest timer, like every good logger does
        if (nowCompleted) get().startRest();
      },

      removeSet: (exerciseId, setId) => {
        const active = get().activeSession;
        if (!active) return;
        const entries = active.entries.map((e) =>
          e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e
        );
        set({ activeSession: { ...active, entries } });
      },

      finishSession: () => {
        const active = get().activeSession;
        if (!active) return null;

        // drop exercises where nothing was actually completed
        const entries = active.entries
          .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
          .filter((e) => e.sets.length > 0);

        const completed: WorkoutSession = {
          ...active,
          entries,
          completedAt: Date.now(),
          durationSec: Math.round((Date.now() - active.startedAt) / 1000),
        };

        // update personal records — e1RM and best-set-volume are tracked
        // independently, since a high-rep set can out-volume a heavier
        // low-rep set that wins on estimated 1RM
        const records = { ...get().records };
        const now = Date.now();
        for (const entry of entries) {
          for (const s of entry.sets) {
            if (s.warmup) continue;
            const e1rm = estimate1RM(s.weightKg, s.reps);
            const setVolume = s.weightKg * s.reps;
            const existing = records[entry.exerciseId];
            // records saved before bestSetVolumeKg existed won't have it —
            // treat that as "no set volume recorded yet" rather than crash
            const existingSetVolume = existing?.bestSetVolumeKg ?? 0;
            const existingSetVolumeAt = existing?.bestSetVolumeAt ?? existing?.achievedAt ?? now;

            const beatsE1rm = !existing || e1rm > existing.bestE1rm;
            const beatsSetVolume = setVolume > existingSetVolume;
            if (!beatsE1rm && !beatsSetVolume) continue;

            records[entry.exerciseId] = {
              exerciseId: entry.exerciseId,
              bestWeightKg: beatsE1rm ? s.weightKg : existing.bestWeightKg,
              bestReps: beatsE1rm ? s.reps : existing.bestReps,
              bestE1rm: beatsE1rm ? e1rm : existing.bestE1rm,
              achievedAt: beatsE1rm ? now : existing.achievedAt,
              bestSetVolumeKg: beatsSetVolume ? setVolume : existingSetVolume,
              bestSetVolumeAt: beatsSetVolume ? now : existingSetVolumeAt,
            };
          }
        }

        set({
          sessions: [...get().sessions, completed],
          activeSession: null,
          records,
          restEndsAt: null,
        });
        return completed;
      },

      discardActiveSession: () => set({ activeSession: null, restEndsAt: null }),

      setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),

      setCurrentPlan: (plan) => set({ currentPlan: plan }),

      startRest: (seconds) => {
        const secs = seconds ?? get().profile.defaultRestSec;
        set({ restEndsAt: Date.now() + secs * 1000, restTotalSec: secs });
      },

      stopRest: () => set({ restEndsAt: null }),

      logBodyweight: (weightKg, note) => {
        const today = new Date().setHours(0, 0, 0, 0);
        // one entry per day — logging again replaces the day's reading
        const rest = get().bodyweight.filter(
          (e) => new Date(e.at).setHours(0, 0, 0, 0) !== today
        );
        set({
          bodyweight: [...rest, { id: uid(), at: Date.now(), weightKg, note }].sort(
            (a, b) => a.at - b.at
          ),
        });
      },

      removeBodyweight: (id) => set({ bodyweight: get().bodyweight.filter((e) => e.id !== id) }),

      saveRoutine: (name, exercises) => {
        const routine: Routine = { id: uid(), name, createdAt: Date.now(), exercises };
        set({ routines: [...get().routines, routine] });
        return routine;
      },

      saveActiveAsRoutine: (name) => {
        const active = get().activeSession;
        if (!active) return null;
        const exercises = active.entries
          .filter((e) => e.sets.length > 0)
          .map((e) => ({
            exerciseId: e.exerciseId,
            targetSets: e.sets.length,
            targetReps: String(e.sets[0]?.reps || 10),
          }));
        if (!exercises.length) return null;
        return get().saveRoutine(name, exercises);
      },

      deleteRoutine: (id) => set({ routines: get().routines.filter((r) => r.id !== id) }),

      startFromRoutine: (id) => {
        const routine = get().routines.find((r) => r.id === id);
        if (!routine) return;
        get().startSession(routine.name);
        for (const ex of routine.exercises) get().addExerciseToActive(ex.exerciseId);
      },

      addCustomExercise: (input) => {
        const exercise: Exercise = {
          id: `custom_${uid()}`,
          name: input.name.trim(),
          category: input.category,
          split: SPLIT_BY_CATEGORY[input.category],
          primaryMuscles: input.primaryMuscles,
          secondaryMuscles: input.secondaryMuscles ?? [],
          equipment: input.equipment,
          mechanic: input.mechanic ?? 'compound',
          difficulty: 'intermediate',
          pattern: input.pattern,
          instructions: [],
          tips: [],
          isCustom: true,
        };
        set({ customExercises: [...get().customExercises, exercise] });
        return exercise;
      },

      deleteCustomExercise: (id) => {
        set({ customExercises: get().customExercises.filter((e) => e.id !== id) });
      },

      addRecentlyViewed: (exerciseId) => {
        const rest = get().recentlyViewed.filter((id) => id !== exerciseId);
        set({ recentlyViewed: [exerciseId, ...rest].slice(0, 10) });
      },
    }),
    {
      name: 'flux-fitness-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSession: state.activeSession,
        profile: state.profile,
        currentPlan: state.currentPlan,
        records: state.records,
        bodyweight: state.bodyweight,
        routines: state.routines,
        customExercises: state.customExercises,
        recentlyViewed: state.recentlyViewed,
      }),
    }
  )
);

// Keep data/exercises.ts's lookup mirror in sync with the persisted list —
// getExerciseById and the library/relations helpers are plain functions
// called with no store access, so this is how a custom exercise becomes
// visible to them, both on every edit and once persisted state rehydrates.
useWorkoutStore.subscribe((state) => setCustomExercises(state.customExercises));
setCustomExercises(useWorkoutStore.getState().customExercises);

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/** The most recent completed sets for an exercise, for the "previous" column. */
export function getPreviousSets(sessions: WorkoutSession[], exerciseId: string): SetEntry[] | null {
  const sorted = [...sessions].sort(
    (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
  );
  for (const session of sorted) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry && entry.sets.length > 0) return entry.sets;
  }
  return null;
}

export function sessionVolume(session: WorkoutSession): number {
  return session.entries.reduce(
    (sum, e) =>
      sum + e.sets.reduce((s, set) => s + (set.completed && !set.warmup ? set.weightKg * set.reps : 0), 0),
    0
  );
}

export function sessionSetCount(session: WorkoutSession): number {
  return session.entries.reduce((sum, e) => sum + e.sets.filter((s) => s.completed).length, 0);
}

export function sessionMuscleSummary(session: WorkoutSession): string {
  const groups = new Set<string>();
  for (const entry of session.entries) {
    const ex = getExerciseById(entry.exerciseId);
    ex?.primaryMuscles.forEach((m) => groups.add(m));
  }
  return Array.from(groups).slice(0, 4).join(', ');
}
