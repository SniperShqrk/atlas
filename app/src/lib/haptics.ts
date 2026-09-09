import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper around expo-haptics. Every call is fire-and-forget and
 * swallows its own errors — haptics are a polish layer, never something
 * that should crash a screen. (The simulator has no haptic engine, and not
 * every Android device supports every feedback type, so failures here are
 * expected and fine to ignore.)
 */
function safe(fn: () => Promise<void>) {
  try {
    fn().catch(() => {});
  } catch {
    // no-op
  }
}

export const haptics = {
  /** Default everyday tap — most buttons, tab switches, nav rows. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** A slightly heavier tap for a more deliberate action — steppers, destructive taps. */
  tapMedium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Toggling a choice on/off — chips, checkboxes, filters. */
  select: () => safe(() => Haptics.selectionAsync()),

  /** A set gets checked off mid-workout — the single most-repeated tap in the app. */
  setComplete: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Workout finished, PR hit, achievement unlocked — anything worth celebrating. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Rest timer hits zero — a distinct buzz so it's felt without looking at the phone. */
  restDone: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /** A destructive action is confirmed — discard workout, delete exercise/routine. */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
