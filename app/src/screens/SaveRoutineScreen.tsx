import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Button, Card } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { ProBadge } from '@/components/Pro';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { useEntitlements, FREE_LIMITS, PRO_LIMITS } from '@/store/entitlements';
import { getExerciseById } from '@/data/exercises';
import { syncRoutineToSupabase } from '@/lib/dataSync';

export default function SaveRoutineScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const active = useWorkoutStore((s) => s.activeSession);
  const routines = useWorkoutStore((s) => s.routines);
  const saveActiveAsRoutine = useWorkoutStore((s) => s.saveActiveAsRoutine);
  const isPro = useEntitlements((s) => s.isPro);

  const [name, setName] = useState(active?.name ?? 'My Routine');

  // Free hits a low ceiling that Pro lifts — that one has a paywall to send
  // people to. Pro's own ceiling exists just to keep storage/sync sane; there
  // is nothing further to sell, so it gets a flat "delete one first" message.
  const freeAtLimit = !isPro && routines.length >= FREE_LIMITS.routines;
  const proAtLimit = isPro && routines.length >= PRO_LIMITS.routines;
  const atLimit = freeAtLimit || proAtLimit;
  const exercises = active?.entries.filter((e) => e.sets.length > 0) ?? [];

  const onSave = () => {
    if (freeAtLimit) {
      navigation.replace('Paywall', { feature: 'more_routines' });
      return;
    }
    if (proAtLimit) {
      Alert.alert(
        'Routine limit reached',
        `You've hit the ${PRO_LIMITS.routines}-routine limit. Delete one from your profile to save a new one.`
      );
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the routine a name so you can find it later.');
      return;
    }
    const saved = saveActiveAsRoutine(name.trim());
    if (!saved) {
      Alert.alert('Nothing to save', 'Add at least one exercise before saving a routine.');
      return;
    }
    syncRoutineToSupabase(saved);
    navigation.goBack();
  };

  return (
    <Screen>
      <ModalHeader title="Save Routine" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.label}>ROUTINE NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Upper A"
          placeholderTextColor={colors.textFaint}
          autoFocus
        />

        <Text style={[styles.label, { marginTop: spacing.xl }]}>
          {exercises.length} EXERCISES
        </Text>
        <Card style={{ padding: 0 }}>
          {exercises.map((e, i) => {
            const ex = getExerciseById(e.exerciseId);
            return (
              <View key={e.exerciseId} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowName}>{ex?.name ?? e.exerciseId}</Text>
                <Text style={styles.rowMeta}>{e.sets.length} sets</Text>
              </View>
            );
          })}
        </Card>

        {freeAtLimit && (
          <View style={styles.limitCard}>
            <View style={styles.limitHead}>
              <Text style={styles.limitTitle}>Routine limit reached</Text>
              <ProBadge />
            </View>
            <Text style={styles.limitBody}>
              Free includes {FREE_LIMITS.routines} saved routines and you're using all of them.
              Pro raises that to {PRO_LIMITS.routines} — your logging stays unlimited either way.
            </Text>
          </View>
        )}

        {proAtLimit && (
          <View style={styles.limitCard}>
            <Text style={styles.limitTitle}>Routine limit reached</Text>
            <Text style={styles.limitBody}>
              You've saved {PRO_LIMITS.routines} routines, the most ATLAS keeps at once. Delete one
              from your profile to make room for a new one.
            </Text>
          </View>
        )}

        <Button
          label={freeAtLimit ? 'Unlock More Routines' : proAtLimit ? 'Routine Limit Reached' : 'Save Routine'}
          size="lg"
          onPress={onSave}
          disabled={proAtLimit}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg },
  label: { ...typography.micro, color: c.textFaint, marginBottom: spacing.sm },
  input: {
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...typography.bodyMedium,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  rowName: { ...typography.body, color: c.text, flex: 1 },
  rowMeta: { ...typography.caption, color: c.textDim },
  limitCard: {
    marginTop: spacing.lg,
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  limitHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  limitTitle: { ...typography.h3, color: c.text, flex: 1 },
  limitBody: { ...typography.caption, color: c.textSecondary, marginTop: 6, lineHeight: 19 },
}));
