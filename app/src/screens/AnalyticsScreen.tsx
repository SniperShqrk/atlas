import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, SectionHeader, Button, StatTile } from '@/components/ui';
import { ScreenLayout } from '@/components/ScreenLayout';
import { ProGate } from '@/components/Pro';
import { InsightCard, InsightList } from '@/components/Insights';
import { MuscleRadar, RadarLegend } from '@/components/MuscleRadar';
import {
  TrendChart,
  VolumeBar,
  RangeSelector,
  BarChart,
  ConsistencyGrid,
  RankRow,
} from '@/components/Charts';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { WEEKLY_SET_TARGETS } from '@/store/progression';
import {
  TimeRange,
  TIME_RANGES,
  RANGE_LABELS,
  computeRangeMetrics,
  consistency,
  liftProgress,
  liftSeries,
  muscleBalance,
  balanceScore,
  pctChange,
  prTimeline,
  previousWindow,
  rangeWindow,
  sessionsInWindow,
  setsPerMuscle,
  trackedLifts,
  trainingDays,
  weeklyBuckets,
  sampleBalance,
  sampleTrendPoints,
  sampleVolumeBars,
} from '@/store/analytics';
import { buildInsights, sampleInsight, sessionsUntilInsights } from '@/store/insights';
import { prCard } from '@/share/cards';
import { getExerciseById, MUSCLE_LABELS, MuscleGroup } from '@/data/exercises';
import { useEntitlements } from '@/store/entitlements';
import { displayWeight, kgToLb } from '@/utils/units';

/**
 * ATLAS — Progress.
 *
 * The screen is ordered by how much a lifter actually cares: what ATLAS found
 * in the training first, then the balance polygon, then the numbers that
 * support both. Everything is computed from logged sessions; nothing here is
 * placeholder or demo data, so an empty history shows an empty state rather
 * than an impressive-looking lie.
 */
export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const sessions = useWorkoutStore((s) => s.sessions);
  const bodyweight = useWorkoutStore((s) => s.bodyweight);
  const profile = useWorkoutStore((s) => s.profile);
  const unit = profile.unit;
  const isPro = useEntitlements((s) => s.isPro);

  const [range, setRange] = useState<TimeRange>('30D');
  const now = Date.now();

  const window = useMemo(() => rangeWindow(sessions, range, now), [sessions, range, now]);
  const metrics = useMemo(() => computeRangeMetrics(sessions, window), [sessions, window]);
  const prevMetrics = useMemo(
    () => computeRangeMetrics(sessions, previousWindow(window)),
    [sessions, window]
  );
  const inWindow = useMemo(() => sessionsInWindow(sessions, window), [sessions, window]);

  const balance = useMemo(() => muscleBalance(sessions, window), [sessions, window]);
  const score = useMemo(() => balanceScore(balance), [balance]);
  // Deterministic, so computing it once here (rather than inline in JSX) is
  // just to avoid recomputing the same object three times per render.
  const balanceExample = useMemo(() => sampleBalance(), []);
  const balanceExampleScore = useMemo(() => balanceScore(balanceExample), [balanceExample]);

  const report = useMemo(
    () =>
      buildInsights(sessions, {
        range,
        targetDaysPerWeek: profile.daysPerWeek,
        now,
      }),
    [sessions, range, profile.daysPerWeek, now]
  );

  const buckets = useMemo(() => weeklyBuckets(sessions, window), [sessions, window]);
  const days = useMemo(() => trainingDays(sessions, 12, now), [sessions, now]);
  const streak = useMemo(
    () => consistency(sessions, profile.daysPerWeek, now),
    [sessions, profile.daysPerWeek, now]
  );

  const lifts = useMemo(() => trackedLifts(inWindow, 8), [inWindow]);
  const [selectedLift, setSelectedLift] = useState<string | null>(null);
  const activeLift = selectedLift && lifts.includes(selectedLift) ? selectedLift : lifts[0] ?? null;
  const series = useMemo(
    () => (activeLift ? liftSeries(inWindow, activeLift) : []),
    [inWindow, activeLift]
  );

  const movers = useMemo(
    () =>
      liftProgress(sessions, window, now, 3)
        .slice()
        .sort((a, b) => b.deltaKg - a.deltaKg),
    [sessions, window, now]
  );

  const prs = useMemo(
    () => prTimeline(sessions).filter((e) => e.at >= window.from && e.at <= window.to),
    [sessions, window]
  );

  const perMuscle = useMemo(() => setsPerMuscle(inWindow), [inWindow]);
  const weeks = Math.max(window.days / 7, 1 / 7);

  const volumeChange = pctChange(metrics.totalVolumeKg, prevMetrics.totalVolumeKg);
  const setsChange = pctChange(metrics.totalSets, prevMetrics.totalSets);

  const exportCsv = async () => {
    const rows = ['date,exercise,set,weight_kg,reps,rpe,warmup'];
    for (const s of sessions) {
      const date = new Date(s.completedAt ?? s.startedAt).toISOString();
      for (const e of s.entries) {
        const name = getExerciseById(e.exerciseId)?.name ?? e.exerciseId;
        e.sets.forEach((set, i) => {
          rows.push(
            `${date},"${name}",${i + 1},${set.weightKg},${set.reps},${set.rpe ?? ''},${set.warmup ? 'yes' : 'no'}`
          );
        });
      }
    }
    await Share.share({ message: rows.join('\n'), title: 'ATLAS export' });
  };

  if (sessions.length === 0) {
    // Cold start: rather than a blank screen, show the real charts wired up
    // to plausible example numbers, faded and labelled EXAMPLE throughout —
    // it demonstrates what the page becomes without ever passing invented
    // figures off as the user's own.
    const previewBalance = sampleBalance();
    const previewScore = balanceScore(previewBalance);
    return (
      <Screen>
        <ScreenLayout>
          <Text style={styles.title}>Progress</Text>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.emptyHeadline}>Your progress will appear here</Text>
            <Text style={styles.note}>
              Log a few workouts and ATLAS starts charting your strength, volume and muscle
              balance automatically. Here's what it looks like once it does.
            </Text>
            <Button
              label="Start a Workout"
              size="lg"
              onPress={() => navigation.navigate('WorkoutTab')}
              style={{ marginTop: spacing.lg }}
            />
          </Card>

          <View style={styles.previewWrap} pointerEvents="none">
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="This Period" />
              <ExampleTag />
              <Card style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row' }}>
                  <StatTile label="Sessions" value="24" />
                  <StatTile label="Sets" value="186" />
                  <StatTile label="Volume" value="42k" unit={unit} />
                </View>
              </Card>
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Strength Trend" />
              <ExampleTag />
              <Card style={{ marginTop: spacing.sm }}>
                <TrendChart points={sampleTrendPoints()} unit={unit} />
              </Card>
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Muscle Balance" />
              <ExampleTag />
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.radarWrap}>
                  <MuscleRadar balance={previewBalance} size={240} />
                </View>
                <RadarLegend balance={previewBalance} score={previewScore} />
              </Card>
            </View>

            <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}>
              <SectionHeader title="Volume by Week" />
              <ExampleTag />
              <Card style={{ marginTop: spacing.sm }}>
                <BarChart bars={sampleVolumeBars()} unit={unit} />
              </Card>
            </View>
          </View>
        </ScreenLayout>
      </Screen>
    );
  }

  const needed = sessionsUntilInsights(sessions, now);

  return (
    <Screen>
      <ScreenLayout>
        <Text style={styles.title}>Progress</Text>

        <View style={{ marginTop: spacing.lg }}>
          <RangeSelector
            value={range}
            onChange={setRange}
            ranges={TIME_RANGES}
            labels={RANGE_LABELS}
          />
        </View>

        {/* ---------------- headline numbers ---------------- */}
        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row' }}>
            <StatTile label="Sessions" value={String(metrics.sessionCount)} />
            <StatTile label="Sets" value={String(metrics.totalSets)} />
            <StatTile
              label="Volume"
              value={(() => {
                const v = unit === 'lb' ? kgToLb(metrics.totalVolumeKg) : metrics.totalVolumeKg;
                return v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
              })()}
              unit={unit}
            />
          </View>
          <View style={styles.deltaRow}>
            <Delta label="volume" pct={volumeChange} />
            <Delta label="sets" pct={setsChange} />
            <Text style={styles.deltaNote}>vs previous {RANGE_LABELS[range].toLowerCase()}</Text>
          </View>
        </Card>

        {/* ---------------- ATLAS insights ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="ATLAS Insights" />
          {report.hasEnoughData ? (
            <InsightList report={report} />
          ) : (
            /* The cold start is where analysis apps lose people: an empty
               panel says "nothing here" and they leave before the engine ever
               has data. So show a real, complete insight built from example
               numbers and label it plainly, rather than an empty promise. */
            <View>
              <Card>
                <Text style={styles.note}>
                  {needed === 1
                    ? 'One more logged session and ATLAS will start reading your training.'
                    : `${needed} more logged sessions and ATLAS will start reading your training.`}{' '}
                  It looks at volume per muscle, opposing-group ratios, plateaus and
                  consistency — all from your own logs. Here is the kind of thing it finds.
                </Text>
              </Card>
              <View style={[styles.exampleTag, { marginTop: spacing.lg }]}>
                <Text style={styles.exampleTagText}>EXAMPLE</Text>
              </View>
              <InsightCard insight={sampleInsight()} unlocked onUnlock={() => {}} />
            </View>
          )}
        </View>

        {/* ---------------- muscle balance ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Muscle Balance" />
          {report.hasEnoughData ? (
            <Card>
              <Text style={styles.note}>
                Each spoke is one region as a share of its own weekly set target. The dashed
                ring is on target.
              </Text>
              <View style={styles.radarWrap}>
                <MuscleRadar balance={balance} size={272} />
              </View>
              <RadarLegend balance={balance} score={score} />
            </Card>
          ) : (
            // Same "not enough data yet" bar as Insights above — with only a
            // session or two, most regions haven't hit any of their weekly
            // set target, so the real polygon collapses to a sliver near the
            // center rather than reading as a chart. Show a realistic
            // example instead of a chart that looks broken.
            <View>
              <Card>
                <Text style={styles.note}>
                  {needed === 1
                    ? 'One more logged session and your real muscle balance will show here.'
                    : `${needed} more logged sessions and your real muscle balance will show here.`}
                </Text>
              </Card>
              <View style={[styles.exampleTag, { marginTop: spacing.lg }]}>
                <Text style={styles.exampleTagText}>EXAMPLE</Text>
              </View>
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.radarWrap}>
                  <MuscleRadar balance={balanceExample} size={272} />
                </View>
                <RadarLegend balance={balanceExample} score={balanceExampleScore} />
              </Card>
            </View>
          )}
        </View>

        {/* ---------------- strength ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Strength Trend" />
          <ProGate feature="advanced_analytics">
            <Card>
              {lifts.length === 0 ? (
                <Text style={styles.note}>No lifts logged in this period.</Text>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.liftRow}
                  >
                    {lifts.map((id) => {
                      const ex = getExerciseById(id);
                      const on = id === activeLift;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => setSelectedLift(id)}
                          style={[styles.liftChip, on && styles.liftChipOn]}
                        >
                          <Text
                            style={[styles.liftChipText, on && { color: colors.onAccent }]}
                            numberOfLines={1}
                          >
                            {ex?.name ?? id}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={{ marginTop: spacing.md }}>
                    <TrendChart
                      points={series.map((p) => ({
                        at: p.at,
                        e1rm: Math.round(unit === 'lb' ? kgToLb(p.e1rm) : p.e1rm),
                      }))}
                      unit={unit}
                    />
                  </View>
                </>
              )}
            </Card>
          </ProGate>
        </View>

        {/* ---------------- movers ---------------- */}
        {movers.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Biggest Movers" />
            <Card>
              {movers.slice(0, 5).map((m, i) => (
                <RankRow
                  key={m.exerciseId}
                  rank={i + 1}
                  title={m.name}
                  subtitle={`${m.sessions} sessions · best ${displayWeight(m.last.bestWeightKg, unit)}${unit} × ${m.last.bestReps}${m.stalled ? ' · stalled' : ''}`}
                  value={`${m.deltaKg >= 0 ? '+' : ''}${Math.round(unit === 'lb' ? kgToLb(m.deltaKg) : m.deltaKg)}${unit}`}
                  tone={m.deltaKg > 0 ? colors.bronze : m.deltaKg < 0 ? colors.accent : colors.textDim}
                />
              ))}
            </Card>
          </View>
        )}

        {/* ---------------- volume over time ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Volume by Week" />
          <Card>
            <BarChart
              bars={buckets.map((b) => ({
                label: b.label,
                value: unit === 'lb' ? kgToLb(b.volumeKg) : b.volumeKg,
              }))}
              unit={unit}
            />
            <Text style={styles.note}>
              {Math.round(
                unit === 'lb' ? kgToLb(metrics.avgVolumePerSession) : metrics.avgVolumePerSession
              ).toLocaleString()}
              {unit} average per session ·{' '}
              {metrics.avgSetsPerSession} sets · {metrics.avgDurationMin || '—'} min
            </Text>
          </Card>
        </View>

        {/* ---------------- consistency ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Consistency" />
          <Card>
            <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
              <StatTile label="Week streak" value={`${streak.weekStreak}`} />
              <StatTile label="Best run" value={`${streak.longestWeekStreak}w`} />
              <StatTile label="Adherence" value={`${streak.adherencePct}%`} />
            </View>
            <ConsistencyGrid days={days} />
          </Card>
        </View>

        {/* ---------------- weekly volume landmarks ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Volume Landmarks" />
          <ProGate feature="volume_landmarks">
            <Card>
              <Text style={styles.note}>
                Working sets per muscle per week. The shaded band is the range most lifters
                grow in; below it is maintenance.
              </Text>
              <View style={{ marginTop: spacing.sm }}>
                {(Object.keys(WEEKLY_SET_TARGETS) as MuscleGroup[])
                  .map((m) => ({
                    m,
                    sets: Math.round(((perMuscle[m] ?? 0) / weeks) * 10) / 10,
                  }))
                  .sort((a, b) => b.sets - a.sets)
                  .map(({ m, sets }) => (
                    <VolumeBar
                      key={m}
                      label={MUSCLE_LABELS[m]}
                      sets={sets}
                      maintenance={WEEKLY_SET_TARGETS[m].maintenance}
                      growth={WEEKLY_SET_TARGETS[m].growth}
                    />
                  ))}
              </View>
            </Card>
          </ProGate>
        </View>

        {/* ---------------- records ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Records"
            action="Share"
            onAction={() => navigation.navigate('ShareCard')}
          />
          <Card>
            {prs.length === 0 ? (
              <Text style={styles.note}>
                No new personal records in this period. Records are counted when a lift beats
                its own best estimated 1RM.
              </Text>
            ) : (
              prs.slice(0, 6).map((e) => (
                <Pressable
                  key={`${e.exerciseId}-${e.at}`}
                  onPress={() =>
                    navigation.navigate('ShareCard', { card: prCard(e, sessions) })
                  }
                >
                <RankRow
                  title={e.name}
                  subtitle={`${displayWeight(e.weightKg, unit)}${unit} × ${e.reps} · ${new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                  value={`+${displayWeight(e.gainKg, unit)}${unit}`}
                  tone={colors.bronze}
                />
                </Pressable>
              ))
            )}
          </Card>
        </View>

        {/* ---------------- bodyweight ---------------- */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Bodyweight"
            action="Log"
            onAction={() => navigation.navigate('Bodyweight')}
          />
          <Card>
            {bodyweight.length < 2 ? (
              <Text style={styles.note}>
                {bodyweight.length === 1
                  ? `Last reading ${displayWeight(bodyweight[0].weightKg, unit)}${unit}. Log again tomorrow to start the trend.`
                  : 'No readings yet. Weigh in first thing, same conditions each day.'}
              </Text>
            ) : (
              <TrendChart
                points={bodyweight.map((b) => ({
                  at: b.at,
                  e1rm: displayWeight(b.weightKg, unit),
                }))}
                unit={unit}
              />
            )}
          </Card>
        </View>

        {/* ---------------- export ---------------- */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}>
          <SectionHeader title="Your Data" />
          {isPro ? (
            <Button label="Export as CSV" variant="secondary" onPress={exportCsv} />
          ) : (
            <ProGate feature="csv_export">
              <View />
            </ProGate>
          )}
        </View>
      </ScreenLayout>
    </Screen>
  );
}

function ExampleTag() {
  const styles = useStyles();
  return (
    <View style={styles.exampleTag}>
      <Text style={styles.exampleTagText}>EXAMPLE</Text>
    </View>
  );
}

function Delta({ label, pct }: { label: string; pct: number | null }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (pct === null) return null;
  const tone = pct > 0 ? colors.bronze : pct < 0 ? colors.accent : colors.textDim;
  return (
    <Text style={[styles.delta, { color: tone }]}>
      {pct > 0 ? '+' : ''}
      {pct}% {label}
    </Text>
  );
}

const useStyles = makeStyles((c) => ({
  title: { ...typography.hero, color: c.text },
  note: { ...typography.caption, color: c.textDim, lineHeight: 19 },
  emptyHeadline: { ...typography.h3, color: c.text, marginBottom: spacing.sm },
  // Faded so the preview reads as a demo, not live data — the EXAMPLE tags
  // above every chart carry the rest of that message.
  previewWrap: { opacity: 0.5 },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  delta: { ...typography.captionBold },
  deltaNote: { ...typography.caption, color: c.textFaint, flex: 1, textAlign: 'right' },
  radarWrap: { alignItems: 'center', marginTop: spacing.md },
  exampleTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: c.bronze,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 0,
    marginBottom: spacing.sm,
  },
  exampleTagText: { ...typography.micro, color: c.bronze, fontSize: 9 },
  liftRow: { flexDirection: 'row', gap: spacing.sm },
  liftChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    maxWidth: 170,
  },
  liftChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  liftChipText: { ...typography.caption, color: c.textSecondary },
}));
