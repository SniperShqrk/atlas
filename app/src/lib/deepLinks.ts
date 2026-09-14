import { Linking } from 'react-native';
import { navigationRef } from '@/navigation/RootNavigator';

/**
 * ATLAS emits exactly one deep link itself right now: atlas://workout, set
 * as the rest timer's Live Activity deepLinkUrl (see RestTimer.tsx) so
 * tapping the Lock Screen card or the Dynamic Island jumps straight back
 * into the workout instead of just unlocking to the home screen — same
 * destination and the same navigationRef pattern the training-reminder
 * notification tap handler in lib/notifications.ts already uses.
 *
 * Register once, near app start (see App.tsx). Requires "scheme": "atlas"
 * in app.json to actually be registered in the built app — on a bare/prebuild
 * project that means either a fresh `expo prebuild` picking it up, or adding
 * the URL type to Info.plist by hand if the native ios/ folder shouldn't be
 * regenerated.
 */
export function initDeepLinkHandling() {
  const goToWorkout = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Tabs', { screen: 'WorkoutTab' });
  };

  const handleUrl = (url: string | null) => {
    if (url && url.includes('workout')) goToWorkout();
  };

  // App was already running (foreground or background) when the link fired.
  Linking.addEventListener('url', ({ url }) => handleUrl(url));

  // App was launched fresh by the link — the listener above wasn't
  // registered yet to catch it.
  Linking.getInitialURL().then(handleUrl);
}
