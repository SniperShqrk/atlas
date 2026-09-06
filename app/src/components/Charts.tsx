import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

/** Minimal line chart — estimated 1RM over time for one lift. */
export function TrendChart({
  points,
  height = 130,
  width = 300,
  unit = 'kg',
}: {
  points: { at: number; e1rm: number }[];
  height?: number;
  width?: number;
  unit?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (points.length < 2) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>
          Log this lift at least twice to see a trend.
        </Text>
      </View>
    );
  }

  const pad = 10;
  const values = points.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const poly = points.map((p, i) => `${x(i)},${y(p.e1rm)}`).join(' ');
  const first = points[0].e1rm;
  const last = points[points.length - 1].e1rm;
  const delta = last - first;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* baseline */}
        <SvgLine
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Polyline
          points={poly}
          fill="none"
          stroke={colors.bronze}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(p.e1rm)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? colors.accent : colors.bronze}
          />
        ))}
      </Svg>
      <View style={styles.trendFooter}>
        <Text style={styles.trendRange}>
          {min}{unit} – {max}{unit}
        </Text>
        <Text style={[styles.trendDelta, { color: delta >= 0 ? colors.bronze : colors.textDim }]}>
          {delta >= 0 ? '+' : ''}
          {delta}{unit} over {points.length} sessions
        </Text>
      </View>
    </View>
  );
}

/** Horizontal bar showing weekly sets against maintenance and growth targets. */
export function VolumeBar({
  label,
  sets,
  maintenance,
  growth,
}: {
  label: string;
  sets: number;
  maintenance: number;
  growth: [number, number];
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scaleMax = Math.max(growth[1] * 1.15, sets * 1.1, 1);
  const pct = (v: number): `${number}%` =>
    `${Math.min(100, (v / scaleMax) * 100)}%` as `${number}%`;

  const status =
    sets < maintenance ? 'under' : sets > growth[1] ? 'over' : sets < growth[0] ? 'light' : 'in range';
  const tone =
    status === 'over' ? colors.accent : status === 'in range' ? colors.bronze : colors.textDim;

  return (
    <View style={styles.volRow}>
      <Text style={styles.volLabel}>{label}</Text>
      <View style={styles.volTrack}>
        {/* the growth window sits behind the bar */}
        <View
          style={[
            styles.volWindow,
            { left: pct(growth[0]), width: pct(growth[1] - growth[0]) },
          ]}
        />
        <View style={[styles.volFill, { width: pct(sets), backgroundColor: tone }]} />
      </View>
      <Text style={[styles.volValue, { color: tone }]}>{sets}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  rangeBar: {
    flexDirection: 'row',
    backgroundColor: c.cardAlt,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: c.border,
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  rangeChipOn: { backgroundColor: c.cardPressed },
  rangeText: { ...typography.caption, color: c.textDim, fontWeight: '600' },
  rangeTextOn: { color: c.text },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barSlot: { flex: 1, justifyContent: 'flex-end', alignItems: 'stretch' },
  bar: { borderRadius: 3, width: '100%' },
  barAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barAxisText: { ...typography.caption, color: c.textFaint, fontSize: 11 },
  gridWrap: { flexDirection: 'row', gap: 4 },
  gridCol: { gap: 4, flex: 1 },
  gridCell: { width: '100%', aspectRatio: 1, borderRadius: 2.5, minHeight: 8 },
  gridCaption: { ...typography.caption, color: c.textFaint, marginTop: 10 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
  },
  rankIndex: {
    ...typography.caption,
    color: c.textFaint,
    width: 16,
    fontVariant: ['tabular-nums'],
  },
  rankTitle: { ...typography.bodyMedium, color: c.text, fontSize: 14 },
  rankSubtitle: { ...typography.caption, color: c.textFaint, marginTop: 1 },
  rankValue: { ...typography.captionBold, color: c.textSecondary, fontVariant: ['tabular-nums'] },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  placeholderText: { ...typography.caption, color: c.textDim, textAlign: 'center' },
  trendFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  trendRange: { ...typography.caption, color: c.textDim },
  trendDelta: { ...typography.captionBold },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 7 },
  volLabel: { ...typography.caption, color: c.text, width: 86 },
  volTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.cardAlt,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  volWindow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(192,138,62,0.18)',
  },
  volFill: { height: '100%', borderRadius: 4 },
  volValue: { ...typography.captionBold, width: 30, textAlign: 'right' },
}));

/* ------------------------------------------------------------------ */
/* ATLAS — range selector, bar chart, consistency grid                 */
/* ------------------------------------------------------------------ */

/** The 7D / 30D / 90D / 1Y / All segmented control. */
export function RangeSelector({
  value,
  onChange,
  ranges,
  labels,
}: {
  value: string;
  onChange: (next: any) => void;
  ranges: string[];
  labels: Record<string, string>;
}) {
  const styles = useStyles();
  return (
    <View style={styles.rangeBar}>
      {ranges.map((r) => {
        const on = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            style={[styles.rangeChip, on && styles.rangeChipOn]}
            hitSlop={4}
          >
            <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{labels[r] ?? r}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Vertical bars for anything bucketed by week — sessions, sets or volume.
 * Deliberately unlabelled per bar: the shape and the summary line carry the
 * information, and eight tiny numbers along an axis carry none.
 */
export function BarChart({
  bars,
  height = 110,
  highlightLast = true,
  unit,
}: {
  bars: { label: string; value: number }[];
  height?: number;
  highlightLast?: boolean;
  unit?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!bars.length) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>Not enough history yet.</Text>
      </View>
    );
  }

  const max = Math.max(...bars.map((b) => b.value), 1);
  const shown = bars.slice(-14);

  return (
    <View>
      <View style={[styles.barRow, { height }]}>
        {shown.map((b, i) => {
          const isLast = highlightLast && i === shown.length - 1;
          const h = Math.max(2, (b.value / max) * (height - 18));
          return (
            <View key={`${b.label}-${i}`} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  { height: h, backgroundColor: isLast ? colors.marbleLight : colors.borderStrong },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.barAxis}>
        <Text style={styles.barAxisText}>{shown[0]?.label}</Text>
        <Text style={styles.barAxisText}>
          peak {Math.round(max).toLocaleString()}
          {unit ?? ''}
        </Text>
        <Text style={styles.barAxisText}>{shown[shown.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

/**
 * Twelve weeks of training days as a dot grid — the "don't break the chain"
 * view. Rows are weekdays, columns are weeks, brightness is session size.
 */
export function ConsistencyGrid({
  days,
  weeks = 12,
}: {
  days: { at: number; sets: number }[];
  weeks?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!days.length) {
    return (
      <View style={[styles.placeholder, { height: 96 }]}>
        <Text style={styles.placeholderText}>No sessions logged yet.</Text>
      </View>
    );
  }

  const maxSets = Math.max(...days.map((d) => d.sets), 1);
  // days arrive Monday-first and contiguous, so chunking by 7 gives columns
  const columns: { at: number; sets: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));
  const shown = columns.slice(-weeks);
  const today = new Date().setHours(0, 0, 0, 0);

  return (
    <View>
      <View style={styles.gridWrap}>
        {shown.map((week, wi) => (
          <View key={wi} style={styles.gridCol}>
            {week.map((day) => {
              const intensity = day.sets ? 0.28 + (day.sets / maxSets) * 0.72 : 0;
              const isToday = day.at === today;
              return (
                <View
                  key={day.at}
                  style={[
                    styles.gridCell,
                    day.sets > 0
                      ? { backgroundColor: colors.marbleLight, opacity: intensity }
                      : { backgroundColor: colors.cardAlt },
                    isToday && { borderWidth: 1, borderColor: colors.bronze, opacity: 1 },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <Text style={styles.gridCaption}>
        Last {shown.length} weeks · {days.filter((d) => d.sets > 0).length} sessions
      </Text>
    </View>
  );
}

/** One line of a ranked list — used for the PR board and lift movers. */
export function RankRow({
  rank,
  title,
  subtitle,
  value,
  tone,
}: {
  rank?: number;
  title: string;
  subtitle?: string;
  value: string;
  tone?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.rankRow}>
      {rank !== undefined && <Text style={styles.rankIndex}>{rank}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={styles.rankTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.rankSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={[styles.rankValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

