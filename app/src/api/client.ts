import { UserProfile, WorkoutSession, GeneratedPlan, CustomExerciseInput } from '@/store/workoutStore';

// Point this at your deployed backend, or your machine's LAN IP when running
// the backend locally and testing on a physical iPhone via Expo Go
// (e.g. "http://192.168.1.23:4000").
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function generatePlan(profile: UserProfile, recentSessions: WorkoutSession[]): Promise<GeneratedPlan> {
  const res = await fetch(`${API_BASE_URL}/api/plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, recentSessions }),
  });
  if (!res.ok) {
    throw new Error(`Plan generation failed: ${res.status}`);
  }
  return res.json();
}

export interface ImportedExercise extends CustomExerciseInput {
  /** placeholder id the plan's exerciseIds reference until the app creates the
   *  real custom exercise and swaps it in — see remapImportedPlan in PlanScreen. */
  tempId: string;
}

export interface ImportWorkoutResult {
  plan: GeneratedPlan;
  newExercises: ImportedExercise[];
}

export async function importWorkout(input: {
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
}): Promise<ImportWorkoutResult> {
  const res = await fetch(`${API_BASE_URL}/api/plan/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Import failed: ${res.status}`);
  }
  const { newExercises, ...plan } = body;
  return { plan, newExercises: newExercises ?? [] };
}

export async function syncSession(session: WorkoutSession): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
  } catch {
    // Best-effort sync; the app is fully usable offline via local storage.
  }
}
