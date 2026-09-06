import { UserProfile, WorkoutSession, GeneratedPlan } from '@/store/workoutStore';

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
