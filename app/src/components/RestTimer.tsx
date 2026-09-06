import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { quoteByTheme } from '@/data/quotes';
import { StoicQuote } from '@/components/StoicQuote';

function fmt(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Sticky rest countdown that appears whenever a set is checked off. */
export function RestTimer() {
  const { colors } = useTheme();
  const styles = useStyles();
  const restEndsAt = useWorkoutStore((s) => s.restEndsAt);
  const restTotalSec = useWorkoutStore((s) => s.restTotalSec);
  const stopRest = useWorkoutStore((s) => s.stopRest);
  const startRest = useWorkoutStore((s) => s.startRest);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // seeded on the rest window itself so the line holds steady for the whole
  // rest rather than reshuffling on every 500ms tick
  const quote = useMemo(
    () => quoteByTheme(['patience', 'endurance', 'discipline'], restEndsAt ?? 0),
    [restEndsAt]
  );

  if (!restEndsAt) return null;

  const remaining = Math.ceil((restEndsAt - now) / 1000);
  const done = remaining <= 0;
  const progress = Math.max(0, Math.min(1, remaining / restTotalSec));

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.progress,
          { width: `${progress * 100}%` },
          done && { backgroundColor: colors.bronzeSoft, width: '100%' },
        ]}
      />
      <View style={styles.row}>
        <Pressable onPress={() => startRest(Math.max(15, remaining - 15))} hitSlop={8}>
          <Text style={styles.adjust}>−15s</Text>
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.label}>{done ? 'REST COMPLETE' : 'REST'}</Text>
          <Text style={[styles.time, done && { color: colors.bronze }]}>
            {done ? 'GO' : fmt(remaining)}
          </Text>
        </View>

        <Pressable onPress={() => startRest(remaining + 15)} hitSlop={8}>
          <Text style={styles.adjust}>+15s</Text>
        </Pressable>

        <Pressable onPress={stopRest} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {!done && remaining > 12 && (
        <View style={styles.quoteRow}>
          <StoicQuote quote={quote} variant="inline" compact />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    backgroundColor: c.bgElevated,
    borderTopWidth: 1,
    borderTopColor: c.border,
    overflow: 'hidden',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  center: { alignItems: 'center' },
  quoteRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  label: { ...typography.micro, color: c.textDim },
  time: { ...typography.h1, color: c.text, fontVariant: ['tabular-nums'] },
  adjust: { ...typography.captionBold, color: c.textSecondary },
  skip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
  },
  skipText: { ...typography.caption, color: c.text, fontWeight: '600' },
}));
