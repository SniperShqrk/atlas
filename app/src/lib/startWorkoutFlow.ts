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

  Alert.alert('Start Workout', 'How do you want to start?', [
    { text: 'Start Empty', onPress: () => startSession() },
    { text: 'Choose a Plan or Routine', onPress: onChoosePlanOrRoutine },
    { text: 'Create a New Plan', onPress: onCreatePlan },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
