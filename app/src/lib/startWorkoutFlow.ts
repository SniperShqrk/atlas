import { Alert } from 'react-native';

/**
 * The "how do you want to start" chooser, factored out so Home's CTA and the
 * Workout tab's own CTA can't quietly diverge — before this, Home always
 * jumped straight into an empty session, bypassing the routines/plans picker
 * that WorkoutScreen already had, which meant the one-tap-into-an-empty-log
 * behavior Home shipped with silently undid the smarter flow built for the
 * Workout tab.
 *
 * `onChoosePlanOrRoutine` is optional because the two callers need different
 * things from that option: WorkoutScreen already renders the routines/plans
 * list below its own CTA, so picking it there is a no-op dismiss; Home has
 * no such list, so it navigates to the Workout tab instead.
 */
export function promptStartWorkout(opts: {
  hasPlanOrRoutines: boolean;
  startSession: () => void;
  onCreatePlan: () => void;
  onChoosePlanOrRoutine?: () => void;
}) {
  const { hasPlanOrRoutines, startSession, onCreatePlan, onChoosePlanOrRoutine } = opts;

  if (!hasPlanOrRoutines) {
    startSession();
    return;
  }

  // One-off workout / Routine / Plan are the three words used for these
  // concepts everywhere in the app now — see the Plan screen rebuild notes.
  Alert.alert('Start Workout', 'How do you want to start?', [
    { text: 'One-off workout', onPress: () => startSession() },
    { text: 'Follow a plan or routine', onPress: onChoosePlanOrRoutine },
    { text: 'Create a plan', onPress: onCreatePlan },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
