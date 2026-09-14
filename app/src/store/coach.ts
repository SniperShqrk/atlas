import { create } from 'zustand';
import { coachTurn, reportProposalOutcome, CoachMutation } from '@/api/client';
import { useWorkoutStore } from '@/store/workoutStore';
import { useEntitlements } from '@/store/entitlements';
import { buildInsights } from '@/store/insights';
import { getDeviceId } from '@/lib/deviceId';

export type CoachEntryPoint = 'plan' | 'exercise' | 'insight' | 'weekly_checkin';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Only ever set on an assistant message, and only ever the most recent
   *  one — a new user message effectively supersedes an unapplied proposal
   *  rather than leaving several live diffs stacked in the thread. */
  proposal?: CoachMutation | null;
  proposalStatus?: 'pending' | 'applied' | 'discarded';
  /** Only set when the backend persisted the turn — needed to report the
   *  apply/discard outcome back for the proposal-quality metric. */
  turnId?: string;
}

interface CoachState {
  visible: boolean;
  entryPoint: CoachEntryPoint;
  seed: Record<string, unknown> | null;
  messages: CoachMessage[];
  loading: boolean;
  error: string | null;

  openCoach: (opts: { entryPoint: CoachEntryPoint; seed?: Record<string, unknown> | null }) => void;
  closeCoach: () => void;
  sendMessage: (text: string) => Promise<void>;
  applyProposal: (messageId: string) => void;
  discardProposal: (messageId: string) => void;
}

let idCounter = 0;
const nextId = () => `coach_${Date.now()}_${idCounter++}`;

/**
 * Deliberately not persisted (no zustand `persist` middleware) and reset on
 * every openCoach — the epic's v1 decision (scoping doc §6) is per-sheet
 * ephemeral memory, not a saved thread. Durable facts like injuries live in
 * the user profile, not here.
 */
export const useCoach = create<CoachState>((set, get) => ({
  visible: false,
  entryPoint: 'plan',
  seed: null,
  messages: [],
  loading: false,
  error: null,

  openCoach: ({ entryPoint, seed = null }) => {
    set({ visible: true, entryPoint, seed, messages: [], error: null, loading: false });
  },

  closeCoach: () => set({ visible: false }),

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: CoachMessage = { id: nextId(), role: 'user', content: trimmed };
    set((s) => ({ messages: [...s.messages, userMsg], loading: true, error: null }));

    const { entryPoint, seed, messages } = get();
    const workout = useWorkoutStore.getState();

    try {
      const recentSessions = [...workout.sessions]
        .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
        .slice(0, 10);

      // Best-effort — the insights engine returns hasEnoughData: false on a
      // thin history, in which case the coach just gets an empty digest and
      // falls back to reasoning from the raw session list instead.
      const report = buildInsights(workout.sessions, { targetDaysPerWeek: workout.profile.daysPerWeek });
      const insightsDigest = report.hasEnoughData
        ? report.all.slice(0, 6).map((i) => ({
            kind: i.kind,
            severity: i.severity,
            headline: i.headline,
            preview: i.preview,
            metrics: i.metrics,
          }))
        : [];

      const deviceId = await getDeviceId();
      const isPro = useEntitlements.getState().isPro;

      const result = await coachTurn({
        profile: workout.profile,
        recentSessions,
        currentPlan: workout.currentPlan,
        entryPoint,
        seed,
        insightsDigest,
        deviceId,
        isPro,
        conversation: messages.map((m) => ({ role: m.role, content: m.content })),
        userMessage: trimmed,
      });

      const assistantMsg: CoachMessage = {
        id: nextId(),
        role: 'assistant',
        content: result.message,
        proposal: result.proposal,
        proposalStatus: result.proposal ? 'pending' : undefined,
        turnId: result.turnId,
      };
      set((s) => ({ messages: [...s.messages, assistantMsg], loading: false }));
    } catch (err) {
      // A quota rejection (see backend/src/routes/coach.js) carries a real,
      // user-facing message worth showing as-is; anything else is treated
      // as "backend unreachable," the far more common failure in dev.
      const message = err instanceof Error ? err.message : '';
      set({
        loading: false,
        error: message.startsWith('Coach turn limit')
          ? message
          : "Couldn't reach the coach. Check the backend is running.",
      });
    }
  },

  applyProposal: (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    if (!msg?.proposal || msg.proposalStatus !== 'pending') return;
    const workout = useWorkoutStore.getState();
    // Narrowed onto a local const, not re-read off msg.proposal, so the
    // type === '...' checks below actually stick inside the nested
    // filter/map closures — TS drops narrowing on a property access (as
    // opposed to a local const) once it crosses into a closure.
    const proposal = msg.proposal;

    if (proposal.type === 'exercise_swap') {
      workout.swapPlanExercise(proposal.dayIndex, proposal.exerciseIndex, proposal.toExerciseId);
    } else if (proposal.type === 'session_timebox') {
      const plan = workout.currentPlan;
      if (plan) {
        const day = plan.days[proposal.dayIndex];
        if (day) {
          const keep = day.exercises.filter((_, i) => !proposal.removeExerciseIndexes.includes(i));
          const days = plan.days.map((d, i) =>
            i !== proposal.dayIndex
              ? d
              : { ...d, exercises: keep, estimatedMinutes: proposal.estimatedMinutes }
          );
          workout.syncPlanEdit({ ...plan, days });
        }
      }
    }

    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, proposalStatus: 'applied' } : m)),
    }));
    if (msg.turnId) reportProposalOutcome(msg.turnId, 'applied');
  },

  discardProposal: (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, proposalStatus: 'discarded' } : m)),
    }));
    if (msg?.turnId) reportProposalOutcome(msg.turnId, 'discarded');
  },
}));
