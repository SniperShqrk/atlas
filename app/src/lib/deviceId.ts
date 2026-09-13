import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'atlas-device-id';

/**
 * A stable, anonymous per-install id — NOT a user identity. This backend has
 * no auth boundary (see coachEvents.ts's own note on that), so there is no
 * real per-user identity to hang a quota on. What this buys is real: a
 * per-device counter the backend can use to cap how many coach turns one
 * install can burn through, so a bug or an abusive script can't run up the
 * Anthropic bill unbounded. It is NOT proof of who the user is or whether
 * they're actually Pro — see backend/src/routes/coach.js's own comment on
 * why the isPro it's sent is trusted, not verified.
 */
let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(KEY, id);
    cached = id;
    return id;
  } catch {
    // AsyncStorage unavailable for some reason — fall back to a per-session
    // id rather than blocking the coach entirely. Quota just resets more
    // often for this install; not a correctness issue.
    if (!cached) cached = `dev_session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return cached;
  }
}
