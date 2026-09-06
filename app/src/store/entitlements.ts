import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRO_ENTITLEMENT_ID } from '@/store/purchases';

/**
 * Free vs Pro.
 *
 * The line is deliberately drawn so the free tier is never crippled for
 * training — the most common complaint about workout apps is a free tier that
 * caps how much you can log (Strong's three-workout limit is the usual
 * example). Logging, the full exercise library, history, PRs, the rest timer,
 * the recovery map and progression suggestions are all free forever.
 *
 * Pro sells intelligence and analysis, not access to your own data.
 */
export type ProFeature =
  | 'atlas_insights'
  | 'ai_planner'
  | 'more_routines'
  | 'advanced_analytics'
  | 'volume_landmarks'
  | 'csv_export';

/** Free-tier ceilings. Nothing here limits how much you can train. */
export const FREE_LIMITS = {
  routines: 2,
};

/** Pro isn't literally unlimited — a real ceiling keeps storage/sync sane, it's
 * just high enough that nobody training normally will ever reach it. */
export const PRO_LIMITS = {
  routines: 20,
};

export const PRO_FEATURES: Record<ProFeature, { title: string; blurb: string }> = {
  atlas_insights: {
    title: 'ATLAS Insights',
    blurb:
      'The full read on your training — what is being neglected, what has plateaued, which ratios are drifting, and exactly what to change.',
  },
  ai_planner: {
    title: 'AI Workout Planner',
    blurb: 'Builds a split around your goal, equipment, schedule, injuries and current recovery.',
  },
  more_routines: {
    title: 'More Routines',
    blurb: `Save up to ${PRO_LIMITS.routines} routines instead of ${FREE_LIMITS.routines}.`,
  },
  advanced_analytics: {
    title: 'Strength & Volume Charts',
    blurb: 'Estimated 1RM trends per lift and weekly volume broken down by muscle.',
  },
  volume_landmarks: {
    title: 'Volume Landmarks',
    blurb: 'Weekly sets per muscle measured against maintenance and growth targets.',
  },
  csv_export: {
    title: 'Export Your Data',
    blurb: 'Download your full training history as CSV. Your data is never locked in.',
  },
};

interface EntitlementState {
  isPro: boolean;
  /** set when a subscription is active; null on free */
  proSince: number | null;
  /** counts how often a locked feature was opened, useful for tuning the paywall later */
  paywallViews: Record<string, number>;

  /**
   * Local dev/testing toggle. This is the ONLY thing that flips `isPro` when
   * RevenueCat has no API key configured (see src/store/purchases.ts) — it's
   * what lets the rest of the app be built and tested without real IAP keys.
   * Once RevenueCat is configured, real purchases flow through
   * `syncFromRevenueCat` below instead, and this becomes dead code on
   * device (still handy in the simulator/tests).
   */
  setPro: (value: boolean) => void;
  recordPaywallView: (feature: ProFeature) => void;
  /** Called with the real CustomerInfo after a purchase, restore, or a
   *  background entitlement-change push from RevenueCat. This is the
   *  source of truth once purchases.ts is configured. */
  syncFromRevenueCat: (customerInfo: import('react-native-purchases').CustomerInfo) => void;
}

export const useEntitlements = create<EntitlementState>()(
  persist(
    (set, get) => ({
      isPro: false,
      proSince: null,
      paywallViews: {},

      setPro: (value) => set({ isPro: value, proSince: value ? Date.now() : null }),

      recordPaywallView: (feature) =>
        set({ paywallViews: { ...get().paywallViews, [feature]: (get().paywallViews[feature] ?? 0) + 1 } }),

      syncFromRevenueCat: (customerInfo) => {
        const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
        set({
          isPro: !!entitlement,
          proSince: entitlement ? entitlement.originalPurchaseDateMillis : null,
        });
      },
    }),
    {
      name: 'flux-entitlements',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Convenience hook — `const isPro = useIsPro()`. */
export function useIsPro(): boolean {
  return useEntitlements((s) => s.isPro);
}

export function useCanUse(feature: ProFeature): boolean {
  const isPro = useEntitlements((s) => s.isPro);
  return isPro;
}
