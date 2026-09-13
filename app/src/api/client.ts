import { UserProfile, WorkoutSession, GeneratedPlan, CustomExerciseInput } from '@/store/workoutStore';

// Point this at your deployed backend, or your machine's LAN IP when running
// the backend locally and testing on a physical iPhone via Expo Go
// (e.g. "http://192.168.1.23:4000").
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface GeneratePlanOptions {
  /** 'week' (default) builds the usual full-week plan; 'day' builds a single
   *  standalone session instead. */
  scope?: 'week' | 'day';
  /** Only used for scope 'day' — a human-readable focus label (e.g. "Push").
   *  Omit/null to let the planner pick based on recovery. */
  focus?: string | null;
}

export async function generatePlan(
  profile: UserProfile,
  recentSessions: WorkoutSession[],
  options?: GeneratePlanOptions
): Promise<GeneratedPlan> {
  const res = await fetch(`${API_BASE_URL}/api/plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, recentSessions, ...options }),
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
  images?: { base64: string; mimeType: string }[];
}): Promise<ImportWorkoutResult> {
  const res = await fetch(`${API_BASE_URL}/api/plan/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input.text, images: input.images }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Import failed: ${res.status}`);
  }
  const { newExercises, ...plan } = body;
  return { plan, newExercises: newExercises ?? [] };
}

export interface CoachTurnRequest {
  profile: UserProfile;
  recentSessions: WorkoutSession[];
  currentPlan: GeneratedPlan | null;
  entryPoint: 'plan' | 'exercise' | 'insight' | 'weekly_checkin';
  seed?: Record<string, unknown> | null;
  /** Anonymous per-install id (src/lib/deviceId.ts) — a quota key, not a user
   *  identity. See backend/src/routes/coach.js for what this does and does
   *  not protect against. */
  deviceId: string;
  /** Client-reported entitlement, used only to pick which quota tier applies
   *  — NOT verified server-side (no auth boundary exists yet). A free tier
   *  cap still applies even if this is spoofed, so the worst case is a Pro
   *  user's rate limit, not an unlimited one. */
  isPro: boolean;
  /** The client-computed insights-engine output (src/store/insights.ts),
   *  trimmed to what the coach needs — the "client sends its own computed
   *  analysis" fallback the epic scoping doc names as acceptable tech debt
   *  for v1 (§3.5), pending a server-side port. */
  insightsDigest?: {
    kind: string;
    severity: string;
    headline: string;
    preview: string;
    metrics: { label: string; value: string }[];
  }[];
  /** Bounded thread history — the epic's v1 decision is ephemeral-per-sheet
   *  memory, so this lives in the coach store, not persisted anywhere. */
  conversation: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
}

export type CoachMutation =
  | {
      type: 'exercise_swap';
      dayIndex: number;
      exerciseIndex: number;
      fromExerciseId: string;
      toExerciseId: string;
      reason: string;
    }
  | {
      type: 'session_timebox';
      dayIndex: number;
      removeExerciseIndexes: number[];
      removedNames: string[];
      estimatedMinutes: number;
      reason: string;
    };

export interface CoachTurnResponse {
  message: string;
  proposal: CoachMutation | null;
  /** Present when the backend persisted this turn — pass it back to
   *  reportProposalOutcome so the apply/discard ratio (the doc's own
   *  pick for single best quality metric) actually gets recorded. */
  turnId?: string;
}

export async function coachTurn(req: CoachTurnRequest): Promise<CoachTurnResponse> {
  const res = await fetch(`${API_BASE_URL}/api/coach/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Coach request failed: ${res.status}`);
  }
  return body;
}

export async function reportProposalOutcome(
  turnId: string,
  status: 'applied' | 'discarded'
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/coach/proposal-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnId, status }),
    });
  } catch {
    // Best-effort telemetry — never block the UI on this.
  }
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
