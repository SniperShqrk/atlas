import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The restraint machinery from the AI-coach epic scoping doc, §4 — the
 * "at most one card, at most twice a week, silence after being told no"
 * rules that keep the coach from turning into the nagging fitness-app
 * pattern the competitor research names as the thing this audience
 * punishes hardest.
 *
 * Deliberately client-side/per-device for now (persisted here, not on the
 * backend) — the doc's own recommendation is server-side enforcement "so it
 * survives reinstalls and multi-device," but there's no per-user auth link
 * on the existing Express backend to hang that off yet. Named tech debt,
 * same spirit as the coach-turn persistence simplification.
 */

export type ProactiveEventType = 'plateau' | 'weekly_checkin';

interface CoachEventsState {
  /** Global "Proactive coach suggestions" toggle — Settings/Profile. Turning
   *  it off never touches the user-initiated coach, only these cards. */
  proactiveEnabled: boolean;
  /** Every proactive surfacing (any type), for the "at most 2/week" cap. */
  surfacedAt: number[];
  /** Per-type dismissal timestamps, for suppression logic. */
  dismissedAt: Record<string, number[]>;
  /** Per-exercise last-plateau-flag time, so the same lift isn't re-flagged
   *  inside the 21-day cooldown. */
  plateauFlaggedAt: Record<string, number>;
  /** Consecutive weekly-check-in dismissals — 3 in a row silences it for
   *  good (moved to pull-only in Progress) per the doc's own rule. */
  weeklyCheckinDismissStreak: number;
  weeklyCheckinSuppressed: boolean;
  /** ISO-week key ("2026-W37") the weekly check-in was last surfaced for —
   *  once shown for a week it stays shown for that week regardless of
   *  dismiss/engage, so a Home re-render doesn't re-offer the same digest. */
  weeklyCheckinShownForWeek: string | null;
  /** The one card currently on screen, if any — "at most one visible at a
   *  time" enforced by simply never computing a second while this is set. */
  activeCardType: ProactiveEventType | null;

  setProactiveEnabled: (on: boolean) => void;
  canSurface: (type: ProactiveEventType) => boolean;
  recordSurfaced: (type: ProactiveEventType, weekKey?: string) => void;
  recordDismissed: (type: ProactiveEventType) => void;
  recordEngaged: (type: ProactiveEventType) => void;
  canFlagPlateau: (exerciseId: string) => boolean;
  recordPlateauFlagged: (exerciseId: string) => void;
  /** Weekly check-in has its own once-per-week gate on top of canSurface's
   *  shared weekly cap and single-active-card rule. */
  canShowWeeklyCheckin: (weekKey: string) => boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PLATEAU_COOLDOWN_MS = 21 * 24 * 60 * 60 * 1000;
const WEEKLY_CAP = 2;

export const useCoachEvents = create<CoachEventsState>()(
  persist(
    (set, get) => ({
      proactiveEnabled: true,
      surfacedAt: [],
      dismissedAt: {},
      plateauFlaggedAt: {},
      weeklyCheckinDismissStreak: 0,
      weeklyCheckinSuppressed: false,
      weeklyCheckinShownForWeek: null,
      activeCardType: null,

      setProactiveEnabled: (on) => set({ proactiveEnabled: on }),

      canSurface: (type) => {
        const s = get();
        if (!s.proactiveEnabled) return false;
        if (s.activeCardType && s.activeCardType !== type) return false;
        if (type === 'weekly_checkin' && s.weeklyCheckinSuppressed) return false;
        const since = Date.now() - WEEK_MS;
        const thisWeek = s.surfacedAt.filter((t) => t >= since);
        return thisWeek.length < WEEKLY_CAP;
      },

      recordSurfaced: (type, weekKey) => {
        set((s) => ({
          surfacedAt: [...s.surfacedAt, Date.now()],
          activeCardType: type,
          ...(type === 'weekly_checkin' && weekKey ? { weeklyCheckinShownForWeek: weekKey } : null),
        }));
      },

      recordDismissed: (type) => {
        set((s) => {
          const next: Record<string, number[]> = {
            ...s.dismissedAt,
            [type]: [...(s.dismissedAt[type] ?? []), Date.now()],
          };
          const patch: Partial<CoachEventsState> = {
            dismissedAt: next,
            activeCardType: s.activeCardType === type ? null : s.activeCardType,
          };
          if (type === 'weekly_checkin') {
            const streak = s.weeklyCheckinDismissStreak + 1;
            patch.weeklyCheckinDismissStreak = streak;
            // three weeks running and the app takes the hint for good
            patch.weeklyCheckinSuppressed = streak >= 3;
          }
          return patch as CoachEventsState;
        });
      },

      recordEngaged: (type) => {
        set((s) => ({
          activeCardType: s.activeCardType === type ? null : s.activeCardType,
          ...(type === 'weekly_checkin' ? { weeklyCheckinDismissStreak: 0 } : null),
        }));
      },

      canFlagPlateau: (exerciseId) => {
        const s = get();
        const last = s.plateauFlaggedAt[exerciseId];
        if (last && Date.now() - last < PLATEAU_COOLDOWN_MS) return false;
        return s.canSurface('plateau');
      },

      recordPlateauFlagged: (exerciseId) => {
        set((s) => ({ plateauFlaggedAt: { ...s.plateauFlaggedAt, [exerciseId]: Date.now() } }));
      },

      canShowWeeklyCheckin: (weekKey) => {
        const s = get();
        if (s.weeklyCheckinShownForWeek === weekKey) return false;
        return s.canSurface('weekly_checkin');
      },
    }),
    {
      name: 'atlas-coach-events',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
