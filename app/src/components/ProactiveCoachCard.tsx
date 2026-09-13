import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';
import { useWorkoutStore } from '@/store/workoutStore';
import { useEntitlements } from '@/store/entitlements';
import { useCoach } from '@/store/coach';
import { useCoachEvents } from '@/store/coachEvents';
import { buildInsights } from '@/store/insights';
import { weekOverWeek, sessionTime, WeekOverWeek } from '@/store/analytics';

const DAY = 24 * 60 * 60 * 1000;
// Sunday and Monday — the window where "how was your week" reads as timely
// rather than as a random Wednesday non-sequitur.
const WEEKLY_CHECKIN_DAYS = new Set([0, 1]);

/**
 * Phases 2 and 3 of the AI-coach epic (scoping doc §4/§5) — the proactive
 * event types. Everything about how OFTEN either is allowed to appear lives
 * in useCoachEvents, not here — this component just asks "is there an
 * eligible candidate right now" and renders the single best one. An
 * observation, never an imperative, per the doc's copy discipline: no
 * exclamation marks, no "Fix it now."
 *
 * At most one card ever renders here, by construction: the two candidates
 * are computed in priority order (weekly check-in first, since it is
 * calendar-scheduled and rare — twice a year outside its Sun/Mon window vs.
 * a plateau flag that can in principle recur most weeks) and the first
 * eligible one wins. useCoachEvents.activeCardType then keeps a second type
 * from becoming eligible mid-session once one has been shown.
 *
 * Never rendered mid-workout — HomeScreen mounts this only when
 * !activeSession, so the sacred-gym-screen rule holds by construction.
 */
export function ProactiveCoachCard() {
  const { colors } = useTheme();
  const styles = useStyles();
  const isPro = useEntitlements((s) => s.isPro);
  const sessions = useWorkoutStore((s) => s.sessions);
  const profile = useWorkoutStore((s) => s.profile);
  const openCoach = useCoach((s) => s.openCoach);
  const canFlagPlateau = useCoachEvents((s) => s.canFlagPlateau);
  const canShowWeeklyCheckin = useCoachEvents((s) => s.canShowWeeklyCheckin);
  const recordSurfaced = useCoachEvents((s) => s.recordSurfaced);
  const recordPlateauFlagged = useCoachEvents((s) => s.recordPlateauFlagged);
  const recordDismissed = useCoachEvents((s) => s.recordDismissed);
  const recordEngaged = useCoachEvents((s) => s.recordEngaged);

  const lastTrainedAt = useMemo(
    () => sessions.reduce((max, s) => Math.max(max, s.completedAt ?? s.startedAt), 0),
    [sessions]
  );
  const trainedRecently = lastTrainedAt > 0 && Date.now() - lastTrainedAt <= 10 * DAY;

  const firstTrainedAt = useMemo(
    () => (sessions.length ? Math.min(...sessions.map(sessionTime)) : null),
    [sessions]
  );
  // A "vs. last week" comparison needs a week of history to actually compare
  // against — otherwise "down from last week" is really just "the account
  // is new," which is a misleading thing for the coach to say.
  const hasTwoWeeksHistory = firstTrainedAt !== null && Date.now() - firstTrainedAt >= 14 * DAY;

  const weekKey = useMemo(() => isoWeekKey(new Date()), []);
  const todayDow = useMemo(() => new Date().getDay(), []);

  const weeklyCandidate = useMemo(() => {
    if (!isPro || !hasTwoWeeksHistory) return null;
    if (!WEEKLY_CHECKIN_DAYS.has(todayDow)) return null;
    if (!canShowWeeklyCheckin(weekKey)) return null;
    const summary = weekOverWeek(sessions, profile.daysPerWeek);
    return { summary };
  }, [isPro, hasTwoWeeksHistory, todayDow, canShowWeeklyCheckin, weekKey, sessions, profile.daysPerWeek]);

  const plateauCandidate = useMemo(() => {
    if (weeklyCandidate) return null; // priority already decided
    if (!isPro || !trainedRecently) return null;
    const report = buildInsights(sessions, { targetDaysPerWeek: profile.daysPerWeek });
    if (!report.hasEnoughData) return null;
    const plateau = report.all.find((i) => i.kind === 'plateau');
    if (!plateau) return null;
    const exerciseId = plateau.id.split(':')[1];
    if (!exerciseId || !canFlagPlateau(exerciseId)) return null;
    return { insight: plateau, exerciseId };
  }, [weeklyCandidate, isPro, trainedRecently, sessions, profile.daysPerWeek, canFlagPlateau]);

  // Recorded once per eligible candidate — a re-render re-evaluating
  // eligibility must never double-count a surfacing.
  const recordedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = weeklyCandidate ? `weekly:${weekKey}` : plateauCandidate ? `plateau:${plateauCandidate.exerciseId}` : null;
    if (!key || recordedFor.current === key) return;
    recordedFor.current = key;
    if (weeklyCandidate) {
      recordSurfaced('weekly_checkin', weekKey);
    } else if (plateauCandidate) {
      recordSurfaced('plateau');
      recordPlateauFlagged(plateauCandidate.exerciseId);
    }
  }, [weeklyCandidate, plateauCandidate, weekKey, recordSurfaced, recordPlateauFlagged]);

  if (weeklyCandidate) {
    const { headline, preview } = weeklyCheckinCopy(weeklyCandidate.summary);
    return (
      <View style={styles.card}>
        <View style={styles.top}>
          <Icon name="sparkle" size={14} color={colors.bronze} strokeWidth={1.6} />
          <Text style={styles.kicker}>WEEKLY CHECK-IN</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => recordDismissed('weekly_checkin')} hitSlop={10} style={styles.dismissBtn}>
            <Icon name="close" size={14} color={colors.textFaint} strokeWidth={1.8} />
          </Pressable>
        </View>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.preview}>{preview}</Text>
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            recordEngaged('weekly_checkin');
            openCoach({
              entryPoint: 'weekly_checkin',
              seed: {
                sessionCount: weeklyCandidate.summary.current.sessionCount,
                previousSessionCount: weeklyCandidate.summary.previous.sessionCount,
                targetDaysPerWeek: weeklyCandidate.summary.targetDaysPerWeek,
                volumeChangePct: weeklyCandidate.summary.volumeChangePct,
              },
            });
          }}
        >
          <Text style={styles.actionBtnText}>Talk it through</Text>
        </Pressable>
      </View>
    );
  }

  if (plateauCandidate) {
    const { insight, exerciseId } = plateauCandidate;
    return (
      <View style={styles.card}>
        <View style={styles.top}>
          <Icon name="sparkle" size={14} color={colors.bronze} strokeWidth={1.6} />
          <Text style={styles.kicker}>FROM THE COACH</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => recordDismissed('plateau')} hitSlop={10} style={styles.dismissBtn}>
            <Icon name="close" size={14} color={colors.textFaint} strokeWidth={1.8} />
          </Pressable>
        </View>
        <Text style={styles.headline}>{insight.headline}</Text>
        <Text style={styles.preview}>{insight.preview}</Text>
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            recordEngaged('plateau');
            openCoach({
              entryPoint: 'insight',
              seed: {
                kind: insight.kind,
                severity: insight.severity,
                headline: insight.headline,
                preview: insight.preview,
                action: insight.action,
                metrics: insight.metrics,
                exerciseId,
              },
            });
          }}
        >
          <Text style={styles.actionBtnText}>Look into it</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

/** A stable, ISO-ish week key ("2026-W37") — doesn't need to be exactly
 *  spec-compliant, only unique per calendar week and consistent run to run. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY));
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Deterministic, no model call — the digest is just real numbers read back
 *  plainly. Tapping through to the coach is where a model gets involved. */
function weeklyCheckinCopy(w: WeekOverWeek): { headline: string; preview: string } {
  const { current, previous, targetDaysPerWeek, sessionChangePct } = w;
  const headline = `${current.sessionCount} of ${targetDaysPerWeek} sessions this week`;
  let preview: string;
  if (current.sessionCount === 0 && previous.sessionCount === 0) {
    preview = 'Nothing logged yet this week or last.';
  } else if (sessionChangePct === null) {
    preview = previous.sessionCount === 0
      ? `${current.sessionCount} logged so far — nothing to compare from last week.`
      : `${current.sessionCount} logged so far this week.`;
  } else if (sessionChangePct > 0) {
    preview = `Up from ${previous.sessionCount} last week.`;
  } else if (sessionChangePct < 0) {
    preview = `Down from ${previous.sessionCount} last week.`;
  } else {
    preview = `Same as last week — ${previous.sessionCount} sessions.`;
  }
  return { headline, preview };
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.32)',
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kicker: { ...typography.micro, color: c.bronze, fontSize: 10 },
  dismissBtn: { padding: 2 },
  headline: { ...typography.h3, color: c.text, marginTop: spacing.sm },
  preview: { ...typography.caption, color: c.textDim, marginTop: 4, lineHeight: 19 },
  actionBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
  },
  actionBtnText: { ...typography.captionBold, color: c.bronze },
}));
