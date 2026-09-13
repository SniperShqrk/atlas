import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { WorkoutSession } from '@/store/workoutStore';
import { navigationRef } from '@/navigation/RootNavigator';

/**
 * ATLAS ships exactly one local notification, deliberately — the strategy
 * research was unambiguous that a barrage of streak-risk/re-engagement/
 * upsell pings is the #1 named reason people mute or delete a fitness app.
 * This is it: a single behavior-based reminder timed to when the user
 * themselves usually trains, always pointing at the Workout tab, never Home.
 *
 * It's a rolling one-shot, not a repeating daily trigger: every time a
 * session finishes, the existing reminder is cancelled and a new one is
 * scheduled for tomorrow at the usual hour. That means there is only ever
 * one of these pending, it never fires on a day already trained (finishing
 * today's session pushes it to tomorrow), and it goes quiet on its own if
 * training stops rather than nagging into a dead habit.
 */

const REMINDER_ID = 'atlas-training-reminder';
const MIN_SESSIONS_TO_INFER = 3;

function sessionStart(s: WorkoutSession): number {
  return s.trainingStartedAt ?? s.startedAt;
}

/** The hour (0-23, local time) the user most often starts training, from
 *  up to their last 20 sessions. Null if there isn't enough history yet to
 *  say anything meaningful — a reminder guessed from one or two sessions is
 *  as likely to be wrong as right. */
export function deriveUsualTrainingHour(sessions: WorkoutSession[]): number | null {
  if (sessions.length < MIN_SESSIONS_TO_INFER) return null;
  const recent = [...sessions].sort((a, b) => sessionStart(b) - sessionStart(a)).slice(0, 20);
  const counts = new Array(24).fill(0);
  for (const s of recent) counts[new Date(sessionStart(s)).getHours()] += 1;
  let bestHour = 0;
  for (let h = 1; h < 24; h++) if (counts[h] > counts[bestHour]) bestHour = h;
  return counts[bestHour] > 0 ? bestHour : null;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** Cancels whatever reminder is pending and schedules the next one for
 *  tomorrow at the usual hour — call this after every finished session and
 *  once at launch. No-ops quietly if there isn't enough history yet, or
 *  permission was never granted. */
export async function scheduleTrainingReminder(sessions: WorkoutSession[]): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    const hour = deriveUsualTrainingHour(sessions);
    if (hour == null) return;

    const granted = await ensureNotificationPermission();
    if (!granted) return;

    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(hour, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: 'Time to train?',
        body: "You usually train around now — pick up where you left off.",
        data: { screen: 'WorkoutTab' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: next,
      },
    });
  } catch {
    // best-effort — a missed reminder is not worth surfacing an error for
  }
}

/**
 * Registers the foreground display behavior and the tap handler that deep
 * links into the Workout tab. Call once, near app start (see App.tsx) —
 * safe to call multiple times, each call just replaces the same handlers.
 */
export function initNotificationHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: Platform.OS === 'ios',
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const goToWorkout = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Tabs', { screen: 'WorkoutTab' });
  };

  // App was in the foreground/background (not killed) when tapped.
  // Typed `any` rather than Notifications.NotificationResponse: until
  // `expo-notifications` is installed (see package.json), its types can't
  // resolve, and TS would otherwise flag these as implicit-any. Once the
  // package is installed this keeps working — it just stops being the
  // tightest possible type — so there's nothing to revisit here.
  Notifications.addNotificationResponseReceivedListener((response: any) => {
    if (response.notification.request.identifier === REMINDER_ID) goToWorkout();
  });

  // App was launched fresh by tapping the notification — the listener above
  // never fires for this case, since it wasn't running yet to hear it.
  Notifications.getLastNotificationResponseAsync().then((response: any) => {
    if (response?.notification.request.identifier === REMINDER_ID) goToWorkout();
  });
}
