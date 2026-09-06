import React, { useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';
import { platesFor, describePlates, PLATE_SIZES } from '@/store/progression';
import { useWorkoutStore } from '@/store/workoutStore';

/** Plate colours follow the usual competition scheme, muted to fit the theme. */
const PLATE_TONE: Record<number, string> = {
  25: '#9A5B4A',
  20: '#5C6B7A',
  15: '#B58A4A',
  10: '#5F7A5F',
  5: '#A9A49A',
  2.5: '#7C776F',
  1.25: '#5E5A54',
};

export function PlateCalculator({
  visible,
  targetKg,
  onClose,
}: {
  visible: boolean;
  targetKg: number;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const barKg = useWorkoutStore((s) => s.profile.barKg);
  const setProfile = useWorkoutStore((s) => s.setProfile);

  const breakdown = useMemo(() => platesFor(targetKg, barKg), [targetKg, barKg]);
  const exact = breakdown.remainderKg < 0.01;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Icon name="plates" size={20} color={colors.bronze} strokeWidth={1.6} />
            <Text style={styles.title}>Plate Loading</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="close" size={18} color={colors.textDim} strokeWidth={1.7} />
            </Pressable>
          </View>

          <Text style={styles.target}>{targetKg}kg</Text>
          <Text style={styles.summary}>{describePlates(breakdown)}</Text>

          {/* visual: the bar loaded from the inside out */}
          <View style={styles.barVisual}>
            <View style={styles.sleeve} />
            {breakdown.perSide.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.plate,
                  {
                    backgroundColor: PLATE_TONE[p] ?? colors.bodyMuscle,
                    height: 26 + p * 1.6,
                    width: p >= 20 ? 13 : p >= 10 ? 10 : 7,
                  },
                ]}
              />
            ))}
            <View style={styles.collar} />
          </View>
          <Text style={styles.perSideNote}>per side, heaviest first</Text>

          {!exact && (
            <Text style={styles.warning}>
              Closest loadable weight is {breakdown.achievableKg}kg — {breakdown.remainderKg}kg per
              side short with standard plates.
            </Text>
          )}

          <Text style={styles.sectionLabel}>BAR WEIGHT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barRow}>
            {[20, 15, 10, 7].map((b) => (
              <Pressable
                key={b}
                onPress={() => setProfile({ barKg: b })}
                style={[styles.barChip, barKg === b && styles.barChipActive]}
              >
                <Text style={[styles.barChipText, barKg === b && { color: colors.onAccent }]}>{b}kg</Text>
              </Pressable>
            ))}
          </ScrollView>
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
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, color: c.text, flex: 1 },
  target: { ...typography.statLarge, color: c.text, marginTop: spacing.md },
  summary: { ...typography.body, color: c.bronze, marginTop: 2 },
  barVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 80,
    gap: 2,
  },
  sleeve: { width: 40, height: 7, backgroundColor: c.bodyMuscle, borderRadius: 3 },
  plate: { borderRadius: 2 },
  collar: { width: 12, height: 12, backgroundColor: c.bodyMuscle, borderRadius: 2, marginLeft: 2 },
  perSideNote: { ...typography.caption, color: c.textFaint, textAlign: 'center', marginTop: spacing.sm },
  warning: { ...typography.caption, color: c.bronze, marginTop: spacing.md, lineHeight: 18 },
  sectionLabel: { ...typography.micro, color: c.textFaint, marginTop: spacing.xl, marginBottom: spacing.sm },
  barRow: { flexDirection: 'row', gap: spacing.sm },
  barChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  barChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  barChipText: { ...typography.caption, color: c.textSecondary, fontWeight: '600' },
}));
