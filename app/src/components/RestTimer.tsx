import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { quoteByTheme } from '@/data/quotes';
import { StoicQuote } from '@/components/StoicQuote';
import { haptics } from '@/lib/haptics';
import { startActivity, updateActivity, stopActivity } from 'expo-live-activity';

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
  // Live Activity id for whichever rest window is currently on screen — lives
  // exactly as long as restEndsAt is non-null (see the effect below).
  const activityId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // Fire once, right when the countdown crosses zero — not on every 500ms
  // tick while it sits at "done" waiting for the lifter to move on.
  useEffect(() => {
    if (restEndsAt == null) return;
    if (now < restEndsAt) return;
    haptics.restDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndsAt, restEndsAt != null && now >= restEndsAt]);

  // Mirror the rest window onto a Live Activity (Lock Screen + Dynamic
  // Island) so it's visible without unlocking the phone or reopening the
  // app. iOS only — the library is a no-op stub on Android, but we guard it
  // anyway since ActivityKit itself is iOS-exclusive. Every call is wrapped
  // in try/catch: this is pure polish and must never take the rest timer
  // down with it if the native module isn't available for some reason.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    try {
      if (restEndsAt == null) {
        if (activityId.current) {
          stopActivity(activityId.current, { title: 'Rest complete' });
          activityId.current = undefined;
        }
        return;
      }
      const state = {
        title: 'Resting',
        subtitle: 'ATLAS',
        progressBar: { date: restEndsAt },
      };
      if (activityId.current) {
        updateActivity(activityId.current, state);
      } else {
        activityId.current = (startActivity(state, {
          backgroundColor: colors.bg,
          titleColor: colors.text,
          subtitleColor: colors.textDim,
          progressViewTint: colors.bronze,
          timerType: 'digital',
        }) || undefined) as string | undefined;
      }
    } catch {
      // Live Activities are best-effort — never let this break the timer.
    }
  }, [restEndsAt]);

  // Belt-and-braces cleanup for the case the effect above never gets to run
  // its own "restEndsAt went null" branch: finishing or discarding a workout
  // sets activeSession and restEndsAt to null in the same store update, and
  // WorkoutScreen only renders <RestTimer /> inside its "active session"
  // branch — so finishing mid-rest unmounts this component on that same
  // render, before it ever sees restEndsAt become null. Without this, the
  // Live Activity is orphaned and sits on the Lock Screen / Dynamic Island
  // until iOS eventually expires it on its own. This runs once, on true
  // unmount only (empty deps), so it never interferes with the effect above
  // updating the same activity in place while the timer is still running.
  useEffect(() => {
    return () => {
      if (activityId.current) {
        try {
          stopActivity(activityId.current, { title: 'Rest complete' });
        } catch {
          // best-effort, same as above
        }
        activityId.current = undefined;
      }
    };
  }, []);

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
        <Pressable
          onPress={() => {
            haptics.tap();
            startRest(Math.max(15, remaining - 15));
          }}
          hitSlop={8}
        >
          <Text style={styles.adjust}>−15s</Text>
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.label}>{done ? 'REST COMPLETE' : 'REST'}</Text>
          <Text style={[styles.time, done && { color: colors.bronze }]}>
            {done ? 'GO' : fmt(remaining)}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            startRest(remaining + 15);
          }}
          hitSlop={8}
        >
          <Text style={styles.adjust}>+15s</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.tap();
            stopRest();
          }}
          hitSlop={8}
          style={styles.skip}
        >
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
