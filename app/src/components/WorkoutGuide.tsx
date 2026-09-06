import React from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon, IconName } from '@/components/Icon';

interface Step {
  icon: IconName;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    icon: 'workout',
    title: 'Start a session',
    detail: 'Tap "Start Empty Workout", or tap a saved routine to jump straight into logging it.',
  },
  {
    icon: 'plus',
    title: 'Add exercises',
    detail:
      '"+ Add Exercise" opens the library. Tap a lift to add it — or create your own if it isn\'t in there.',
  },
  {
    icon: 'check',
    title: 'Log a set',
    detail:
      'Enter weight and reps, then tap the checkmark. Only checked sets count toward volume, PRs and history.',
  },
  {
    icon: 'edit',
    title: 'Warm-ups',
    detail: 'Tap the set number to flag it "W" for warm-up — warm-up sets are logged but not counted.',
  },
  {
    icon: 'close',
    title: 'Remove a set',
    detail: 'Long-press the set number to delete that row.',
  },
  {
    icon: 'timer',
    title: 'RPE',
    detail: 'Optional — a 1–10 effort rating for the set, purely for your own reference.',
  },
  {
    icon: 'plates',
    title: 'Plate math',
    detail: 'On barbell and Smith lifts, the plates icon shows exactly how to load the bar for that weight.',
  },
  {
    icon: 'trophy',
    title: 'Finish up',
    detail:
      '"Finish" saves the session and updates your PRs and achievements. "Save as Routine" repeats this exact session in one tap next time. "Discard" throws it away.',
  },
];

export function WorkoutGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Icon name="workout" size={20} color={colors.bronze} strokeWidth={1.6} />
            <Text style={styles.title}>How Workouts Work</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="close" size={18} color={colors.textDim} strokeWidth={1.7} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            {STEPS.map((step, i) => (
              <View key={step.title} style={[styles.stepRow, i > 0 && styles.stepRowBorder]}>
                <View style={styles.stepIcon}>
                  <Icon name={step.icon} size={16} color={colors.accent} strokeWidth={1.7} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.gotIt} onPress={onClose}>
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, color: c.text, flex: 1 },
  stepRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  stepRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { ...typography.bodyMedium, color: c.text },
  stepDetail: { ...typography.caption, color: c.textDim, marginTop: 2, lineHeight: 18 },
  gotIt: {
    marginTop: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
  },
  gotItText: { ...typography.bodyMedium, color: c.text, fontWeight: '700' },
}));
