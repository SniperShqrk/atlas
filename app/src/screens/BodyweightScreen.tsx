import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { Screen, Button, Card } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { displayWeight, parseBodyweightInput } from '@/utils/units';
import { syncBodyweightToSupabase, deleteBodyweightFromSupabase } from '@/lib/dataSync';

export default function BodyweightScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const bodyweight = useWorkoutStore((s) => s.bodyweight);
  const logBodyweight = useWorkoutStore((s) => s.logBodyweight);
  const removeBodyweight = useWorkoutStore((s) => s.removeBodyweight);
  const profile = useWorkoutStore((s) => s.profile);
  const unit = profile.unit;
  const setProfile = useWorkoutStore((s) => s.setProfile);

  const latest = bodyweight[bodyweight.length - 1];
  const [value, setValue] = useState(latest ? String(displayWeight(latest.weightKg, unit)) : '');

  const sorted = [...bodyweight].sort((a, b) => b.at - a.at);
  const sevenDayAvg =
    bodyweight.length > 0
      ? bodyweight.slice(-7).reduce((s, b) => s + b.weightKg, 0) / Math.min(7, bodyweight.length)
      : null;

  const onSave = () => {
    const kg = parseBodyweightInput(value, unit);
    if (kg <= 0) return;
    const { entry, replacedIds } = logBodyweight(kg);
    syncBodyweightToSupabase(entry);
    for (const id of replacedIds) deleteBodyweightFromSupabase(id);
    setProfile({ weightKg: kg });
    navigation.goBack();
  };

  return (
    <Screen>
      <ModalHeader title="Bodyweight" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>TODAY'S WEIGHT</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={colors.textFaint}
            autoFocus
          />
          <Text style={styles.unit}>{unit}</Text>
        </View>
        <Text style={styles.hint}>
          Weigh in first thing, after the bathroom, before eating — same conditions every day, or the
          number bounces around for reasons that have nothing to do with progress.
        </Text>

        <Button label="Save" size="lg" onPress={onSave} style={{ marginTop: spacing.lg }} />

        {sevenDayAvg !== null && (
          <Card style={{ marginTop: spacing.xl }}>
            <View style={styles.avgRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.avgValue}>{displayWeight(sevenDayAvg, unit)}{unit}</Text>
                <Text style={styles.avgLabel}>7-day average</Text>
              </View>
              {profile.heightCm ? (
                <View>
                  <Text style={styles.avgValue}>
                    {(sevenDayAvg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)}
                  </Text>
                  <Text style={styles.avgLabel}>BMI</Text>
                </View>
              ) : null}
            </View>
          </Card>
        )}

        {sorted.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: spacing.xl }]}>HISTORY</Text>
            <Card style={{ padding: 0 }}>
              {sorted.slice(0, 30).map((b, i) => (
                <View key={b.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Text style={styles.rowDate}>{format(new Date(b.at), 'EEE d MMM')}</Text>
                  <Text style={styles.rowWeight}>{displayWeight(b.weightKg, unit)}{unit}</Text>
                  <Pressable
                    onPress={() => {
                      removeBodyweight(b.id);
                      deleteBodyweightFromSupabase(b.id);
                    }}
                    hitSlop={10}
                  >
                    <Icon name="close" size={15} color={colors.textFaint} strokeWidth={1.7} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  label: { ...typography.micro, color: c.textFaint, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, color: c.text, paddingVertical: 14, ...typography.statLarge },
  unit: { ...typography.h3, color: c.textDim },
  hint: { ...typography.caption, color: c.textDim, marginTop: spacing.md, lineHeight: 19 },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  avgValue: { ...typography.stat, color: c.text },
  avgLabel: { ...typography.caption, color: c.textDim, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  rowDate: { ...typography.body, color: c.textSecondary, flex: 1 },
  rowWeight: { ...typography.bodyMedium, color: c.text },
}));
