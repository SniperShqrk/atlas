import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-run state.
 *
 * `firstOpenAt` exists for one reason: the research is unambiguous that a
 * lifter who logs fewer than three sessions in their first fortnight churns at
 * three to four times the rate of one who builds a weekly habit. That makes
 * the first fourteen days a measurable design target rather than a vague
 * onboarding aspiration, and this is where the clock starts.
 */
interface OnboardingState {
  /**
   * AsyncStorage rehydration is asynchronous, so for the first frames of a
   * cold start every persisted flag still holds its default. Rendering the
   * navigator against that would show onboarding to people who finished it
   * months ago, so nothing decides anything until this is true.
   */
  hydrated: boolean;
  hasOnboarded: boolean;
  firstOpenAt: number | null;
  /** true once the Day-0 paywall has been shown, so it is never shown twice */
  sawDayZeroOffer: boolean;

  setHydrated: () => void;
  begin: () => void;
  complete: () => void;
  markOfferSeen: () => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hasOnboarded: false,
      firstOpenAt: null,
      sawDayZeroOffer: false,

      setHydrated: () => set({ hydrated: true }),

      begin: () => {
        if (!get().firstOpenAt) set({ firstOpenAt: Date.now() });
      },
      complete: () => set({ hasOnboarded: true }),
      markOfferSeen: () => set({ sawDayZeroOffer: true }),
      reset: () => set({ hasOnboarded: false, firstOpenAt: null, sawDayZeroOffer: false }),
    }),
    {
      name: 'atlas-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasOnboarded: state.hasOnboarded,
        firstOpenAt: state.firstOpenAt,
        sawDayZeroOffer: state.sawDayZeroOffer,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);

/** Days remaining in the fortnight that decides whether someone stays. */
export function daysIntoFirstFortnight(firstOpenAt: number | null, now = Date.now()): number | null {
  if (!firstOpenAt) return null;
  const days = Math.floor((now - firstOpenAt) / (24 * 60 * 60 * 1000));
  return days <= 14 ? days : null;
}
