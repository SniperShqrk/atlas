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
  ALL_EQUIPMENT,
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
  /** when the first set was completed — null while still building the plan. The visible timer and durationSec are based on this, not startedAt, so time spent adding exercises before training begins doesn't count. */
  trainingStartedAt?: number | null;
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
  /** drives which body-map silhouette (BodyMap.tsx) is drawn; unset falls
   *  back to the male figure so existing profiles render unchanged */
  gender?: 'male' | 'female';
  goal: 'build_muscle' | 'lose_fat' | 'strength' | 'general_fitness';
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  /** individual pieces of kit the user has access to — see EQUIPMENT_OPTIONS/ALL_EQUIPMENT in data/exercises.ts */
  equipment: Equipment[];
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
  /** set when the plan is saved to the plan library (see savePlan) — an
   *  unsaved just-generated plan has none yet. */
  name?: string;
  source: 'ai' | 'rule_based' | 'imported';
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
  /** Named, kept-around plans — currentPlan is just whatever's open on the
   *  Plan tab right now (freshly generated and not yet saved, or one of
   *  these loaded back up); editing a loaded plan updates its saved copy
   *  here too, see syncPlanEdit. */
  savedPlans: GeneratedPlan[];
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
  /** target, when given, comes from a plan day or a saved Routine's exercise (both carry targetSets/targetReps) — seeds that many sets with that rep target instead of one empty 0/0 set, so starting a planned day doesn't throw away everything the plan already decided. */
  addExerciseToActive: (exerciseId: string, target?: { targetSets?: number; targetReps?: string }) => void;
  removeExerciseFromActive: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, patch: Partial<SetEntry>) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  finishSession: () => WorkoutSession | null;
  discardActiveSession: () => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  setCurrentPlan: (plan: GeneratedPlan) => void;
  /** Internal plumbing shared by every plan-editing action — not meant to be
   *  called directly from UI code, use the specific action instead. */
  syncPlanEdit: (plan: GeneratedPlan) => void;
  /** Adds currentPlan to the saved library under `name` (or updates it there
   *  if it's already saved), returns the saved plan. Null if there's nothing
   *  to save. */
  savePlan: (name: string) => GeneratedPlan | null;
  loadSavedPlan: (id: string) => void;
  deleteSavedPlan: (id: string) => void;
  /** Starts a session from one day of a saved plan without first loading it
   *  onto the Plan tab — what the Workout tab's "Your Plans" list uses. */
  startFromPlanDay: (planId: string, dayIndex: number) => void;
  /** Editing for a plan the AI planner or Import Workouts already built —
   *  not a saved Routine. All index-addressed since plan days/exercises don't
   *  carry their own ids. */
  updatePlanExercise: (
    dayIndex: number,
    exerciseIndex: number,
    patch: Partial<GeneratedPlan['days'][number]['exercises'][number]>
  ) => void;
  removePlanExercise: (dayIndex: number, exerciseIndex: number) => void;
  addExerciseToPlanDay: (dayIndex: number, exerciseId: string) => void;
  /** Replaces the exercise at that slot in place — same position, same targetSets/targetReps/note — unlike remove-then-add, which loses all of that and drops the replacement at the end of the day. */
  swapPlanExercise: (dayIndex: number, exerciseIndex: number, newExerciseId: string) => void;
  updatePlanDay: (dayIndex: number, patch: Partial<Pick<GeneratedPlan['days'][number], 'label' | 'focus'>>) => void;
  removePlanDay: (dayIndex: number) => void;
  addPlanDay: () => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;

  /** Returns the entry it just created plus the id(s) of any same-day
   *  entries it replaced — callers that mirror this to a backend need both,
   *  to upsert the new row and delete the stale one it superseded. */
  logBodyweight: (weightKg: number, note?: string) => { entry: BodyweightEntry; replacedIds: string[] };
  removeBodyweight: (id: string) => void;
  /** Merges a pulled-down cloud backup into local state, by id — an id
   *  already present locally is left untouched (this device's copy wins),
   *  so this only ever fills gaps, never overwrites an in-progress local
   *  edit or resurrects something deleted here after the pull started. */
  hydrateFromCloud: (data: {
    sessions: WorkoutSession[];
    routines: Routine[];
    customExercises: Exercise[];
    bodyweight: BodyweightEntry[];
  }) => void;

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

/** "8-10" -> 8, "12" -> 12, "AMRAP" or anything without a number -> 0 (same
 *  as the old always-empty seed, so an unparseable target just falls back
 *  to what the user would have typed in themselves anyway). */
function parseRepsSeed(targetReps?: string): number {
  const match = targetReps?.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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
      savedPlans: [],
      recentlyViewed: [],
      profile: {
        name: '',
        goal: 'build_muscle',
        experience: 'intermediate',
        daysPerWeek: 4,
        equipment: ALL_EQUIPMENT,
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
            // timer starts on the first completed set, not on creation — see toggleSetComplete
            trainingStartedAt: null,
            completedAt: null,
            entries: [],
          },
        });
      },

      addExerciseToActive: (exerciseId, target) => {
        const active = get().activeSession;
        if (!active) return;
        if (active.entries.some((e) => e.exerciseId === exerciseId)) return;
        // No target (empty session, library add) -> one empty set, as before.
        // A target from a plan day/routine -> that many sets, reps prefilled
        // from it; weight is left at 0 since neither source has any signal
        // for what the user should actually load the bar with.
        const repsSeed = parseRepsSeed(target?.targetReps);
        const setCount = Math.max(1, target?.targetSets ?? 1);
        const sets = Array.from({ length: setCount }, () => ({
          id: uid(),
          weightKg: 0,
          reps: repsSeed,
          completed: false,
        }));
        set({
          activeSession: {
            ...active,
            entries: [...active.entries, { exerciseId, sets }],
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
        set({
          activeSession: {
            ...active,
            entries,
            // first completed set is when training actually starts, not session creation
            trainingStartedAt: active.trainingStartedAt ?? (nowCompleted ? Date.now() : active.trainingStartedAt),
          },
        });
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
          // duration is actual training time — from the first completed set, not from when the plan was created
          durationSec: Math.round((Date.now() - (active.trainingStartedAt ?? active.startedAt)) / 1000),
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

      // Every plan-editing action below funnels through here: it updates
      // currentPlan (what the Plan tab is showing) and, if that plan is
      // already in the saved library, its saved copy too — so editing a
      // plan you loaded back up doesn't quietly diverge from what's saved.
      // A freshly generated, not-yet-saved plan just updates currentPlan.
      syncPlanEdit: (plan: GeneratedPlan) => {
        set({
          currentPlan: plan,
          savedPlans: get().savedPlans.map((p) => (p.id === plan.id ? plan : p)),
        });
      },

      savePlan: (name) => {
        const plan = get().currentPlan;
        if (!plan) return null;
        const saved: GeneratedPlan = { ...plan, name: name.trim() || plan.name || 'My Plan' };
        const exists = get().savedPlans.some((p) => p.id === saved.id);
        set({
          currentPlan: saved,
          savedPlans: exists
            ? get().savedPlans.map((p) => (p.id === saved.id ? saved : p))
            : [...get().savedPlans, saved],
        });
        return saved;
      },

      loadSavedPlan: (id) => {
        const plan = get().savedPlans.find((p) => p.id === id);
        if (!plan) return;
        set({ currentPlan: plan });
      },

      deleteSavedPlan: (id) => {
        const current = get().currentPlan;
        set({
          savedPlans: get().savedPlans.filter((p) => p.id !== id),
          currentPlan: current?.id === id ? null : current,
        });
      },

      startFromPlanDay: (planId, dayIndex) => {
        const plan =
          get().currentPlan?.id === planId ? get().currentPlan : get().savedPlans.find((p) => p.id === planId);
        const day = plan?.days[dayIndex];
        if (!day) return;
        get().startSession(`${day.label} · ${day.focus}`);
        for (const ex of day.exercises) {
          get().addExerciseToActive(ex.exerciseId, { targetSets: ex.targetSets, targetReps: ex.targetReps });
        }
      },

      updatePlanExercise: (dayIndex, exerciseIndex, patch) => {
        const plan = get().currentPlan;
        if (!plan) return;
        const days = plan.days.map((day, i) =>
          i !== dayIndex
            ? day
            : {
                ...day,
                exercises: day.exercises.map((ex, j) => (j === exerciseIndex ? { ...ex, ...patch } : ex)),
              }
        );
        get().syncPlanEdit({ ...plan, days });
      },

      removePlanExercise: (dayIndex, exerciseIndex) => {
        const plan = get().currentPlan;
        if (!plan) return;
        const days = plan.days.map((day, i) =>
          i !== dayIndex ? day : { ...day, exercises: day.exercises.filter((_, j) => j !== exerciseIndex) }
        );
        get().syncPlanEdit({ ...plan, days });
      },

      addExerciseToPlanDay: (dayIndex, exerciseId) => {
        const plan = get().currentPlan;
        if (!plan) return;
        const days = plan.days.map((day, i) =>
          i !== dayIndex
            ? day
            : { ...day, exercises: [...day.exercises, { exerciseId, targetSets: 3, targetReps: '8-12' }] }
        );
        get().syncPlanEdit({ ...plan, days });
      },

      swapPlanExercise: (dayIndex, exerciseIndex, newExerciseId) => {
        const plan = get().currentPlan;
        if (!plan) return;
        const days = plan.days.map((day, i) =>
          i !== dayIndex
            ? day
            : {
                ...day,
                exercises: day.exercises.map((ex, j) =>
                  j !== exerciseIndex ? ex : { ...ex, exerciseId: newExerciseId }
                ),
              }
        );
        get().syncPlanEdit({ ...plan, days });
      },

      updatePlanDay: (dayIndex, patch) => {
        const plan = get().currentPlan;
        if (!plan) return;
        const days = plan.days.map((day, i) => (i === dayIndex ? { ...day, ...patch } : day));
        get().syncPlanEdit({ ...plan, days });
      },

      removePlanDay: (dayIndex) => {
        const plan = get().currentPlan;
        if (!plan) return;
        get().syncPlanEdit({ ...plan, days: plan.days.filter((_, i) => i !== dayIndex) });
      },

      addPlanDay: () => {
        const plan = get().currentPlan;
        if (!plan) return;
        get().syncPlanEdit({
          ...plan,
          days: [...plan.days, { label: `Day ${plan.days.length + 1}`, focus: 'New Day', exercises: [] }],
        });
      },

      startRest: (seconds) => {
        const secs = seconds ?? get().profile.defaultRestSec;
        set({ restEndsAt: Date.now() + secs * 1000, restTotalSec: secs });
      },

      stopRest: () => set({ restEndsAt: null }),

      logBodyweight: (weightKg, note) => {
        const today = new Date().setHours(0, 0, 0, 0);
        // one entry per day — logging again replaces the day's reading
        const replaced = get().bodyweight.filter(
          (e) => new Date(e.at).setHours(0, 0, 0, 0) === today
        );
        const rest = get().bodyweight.filter(
          (e) => new Date(e.at).setHours(0, 0, 0, 0) !== today
        );
        const entry: BodyweightEntry = { id: uid(), at: Date.now(), weightKg, note };
        set({
          bodyweight: [...rest, entry].sort((a, b) => a.at - b.at),
        });
        return { entry, replacedIds: replaced.map((e) => e.id) };
      },

      removeBodyweight: (id) => set({ bodyweight: get().bodyweight.filter((e) => e.id !== id) }),

      hydrateFromCloud: (data) => {
        const state = get();
        const mergeById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
          const localIds = new Set(local.map((x) => x.id));
          return [...local, ...remote.filter((r) => !localIds.has(r.id))];
        };
        set({
          sessions: mergeById(state.sessions, data.sessions),
          routines: mergeById(state.routines, data.routines),
          customExercises: mergeById(state.customExercises, data.customExercises),
          bodyweight: mergeById(state.bodyweight, data.bodyweight).sort((a, b) => a.at - b.at),
        });
      },

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
        for (const ex of routine.exercises) {
          get().addExerciseToActive(ex.exerciseId, { targetSets: ex.targetSets, targetReps: ex.targetReps });
        }
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
      // v1: equipmentAccess (one of 3 tiers) -> equipment (the actual owned list).
      // Existing installs have no `version` in their persisted blob, which zustand
      // treats as 0, so this always runs once for anyone upgrading from before it.
      version: 1,
      migrate: (persisted: any) => {
        const p = persisted?.profile;
        if (p && !Array.isArray(p.equipment)) {
          const legacy = p.equipmentAccess;
          p.equipment =
            legacy === 'bodyweight_only'
              ? ['band']
              : legacy === 'home_dumbbells'
              ? ['dumbbell', 'kettlebell', 'band']
              : ALL_EQUIPMENT;
          delete p.equipmentAccess;
        }
        return persisted;
      },
      partialize: (state) => ({
        sessions: state.sessions,
        activeSession: state.activeSession,
        profile: state.profile,
        currentPlan: state.currentPlan,
        savedPlans: state.savedPlans,
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
