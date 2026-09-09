import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Polygon,
  Line as SvgLine,
  Circle,
  Text as SvgText,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { RegionBalance, REGION_SHORT } from '@/store/analytics';
import { radarGeometry, RADAR_MAX, RADAR_TARGET } from '@/components/radarGeometry';

/**
 * The muscle balance polygon.
 *
 * Each spoke is one region, plotted as a fraction of that region's own weekly
 * set target, so the bronze ring is "on target" everywhere on the chart. A
 * dent is a neglected region and a spike is one taking more of the week than
 * it can pay back — both readable at a glance, which is the whole point.
 */
export function MuscleRadar({
  balance,
  size = 260,
  showLabels = true,
}: {
  balance: RegionBalance[];
  size?: number;
  showLabels?: boolean;
}) {
  const { colors } = useTheme();
  const geo = radarGeometry(
    balance.map((b) => b.ratio),
    size,
    showLabels ? 46 : 12
  );
  const targetRadius = (RADAR_TARGET / RADAR_MAX) * geo.radius;

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="atlasRadarFill" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.marbleLight} stopOpacity={0.26} />
          <Stop offset="100%" stopColor={colors.marbleMid} stopOpacity={0.08} />
        </RadialGradient>
      </Defs>

      {/* grid */}
      {geo.rings.map((ring) => (
        <Polygon
          key={ring.value}
          points={ring.points}
          fill="none"
          stroke={ring.value === RADAR_TARGET ? colors.bronze : colors.border}
          strokeWidth={ring.value === RADAR_TARGET ? 1.1 : 1}
          strokeDasharray={ring.value === RADAR_TARGET ? '3 4' : undefined}
          opacity={ring.value === RADAR_TARGET ? 0.75 : 1}
        />
      ))}

      {/* spokes */}
      {geo.axes.map((axis, i) => (
        <SvgLine
          key={i}
          x1={geo.cx}
          y1={geo.cy}
          x2={axis.x}
          y2={axis.y}
          stroke={colors.border}
          strokeWidth={1}
        />
      ))}

      {/* the shape */}
      <Polygon
        points={geo.polygon}
        fill="url(#atlasRadarFill)"
        stroke={colors.marbleLight}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />

      {/* vertices, coloured by how far each region is from its target */}
      {geo.valuePoints.map((p, i) => {
        const b = balance[i];
        const tone =
          b.status === 'neglected'
            ? colors.accent
            : b.status === 'high'
            ? colors.bronze
            : colors.marbleLight;
        return <Circle key={i} cx={p.x} cy={p.y} r={3.2} fill={tone} />;
      })}

      {showLabels &&
        geo.axes.map((axis, i) => (
          <SvgText
            key={`l${i}`}
            x={axis.labelX}
            y={axis.labelY + 3.5}
            fill={
              balance[i].status === 'neglected' ? colors.accent : colors.textDim
            }
            fontSize={9.5}
            fontWeight="700"
            textAnchor={axis.anchor}
          >
            {REGION_SHORT[balance[i].region]}
          </SvgText>
        ))}

      {/* target ring marker */}
      <Circle
        cx={geo.cx}
        cy={geo.cy - targetRadius}
        r={1.6}
        fill={colors.bronze}
        opacity={0.9}
      />
    </Svg>
  );
}

/** The legend and score that sit under the polygon. */
export function RadarLegend({
  balance,
  score,
}: {
  balance: RegionBalance[];
  score: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const neglected = balance.filter((b) => b.status === 'neglected');
  const high = balance.filter((b) => b.status === 'high');
  const onTarget = balance.filter((b) => b.status === 'on_target').length;

  return (
    <View style={styles.legend}>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreValue}>{score}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.scoreLabel}>BALANCE SCORE</Text>
          <Text style={styles.scoreHint}>
            {onTarget} of {balance.length} regions inside their weekly range
          </Text>
        </View>
      </View>

      <View style={styles.keyRow}>
        <Key color={colors.marbleLight} label="On target" />
        <Key color={colors.bronze} label="High" />
        <Key color={colors.accent} label="Neglected" />
      </View>

      {(neglected.length > 0 || high.length > 0) && (
        <Text style={styles.legendNote}>
          {neglected.length > 0 &&
            `Lowest: ${neglected
              .sort((a, b) => a.ratio - b.ratio)
              .slice(0, 2)
              .map((b) => `${b.label} ${b.setsPerWeek}/wk`)
              .join(', ')}.`}
          {neglected.length > 0 && high.length > 0 ? '  ' : ''}
          {high.length > 0 &&
            `Highest: ${high
              .sort((a, b) => b.ratio - a.ratio)
              .slice(0, 1)
              .map((b) => `${b.label} ${b.setsPerWeek}/wk`)
              .join('')}.`}
        </Text>
      )}
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <Text style={styles.keyLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  legend: { marginTop: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreValue: {
    ...typography.statLarge,
    color: c.text,
    fontVariant: ['tabular-nums'],
    minWidth: 56,
  },
  scoreLabel: { ...typography.micro, color: c.textDim },
  scoreHint: { ...typography.caption, color: c.textFaint, marginTop: 2 },
  keyRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyDot: { width: 7, height: 7, borderRadius: 4 },
  keyLabel: { ...typography.caption, color: c.textDim },
  legendNote: {
    ...typography.caption,
    color: c.textFaint,
    marginTop: spacing.md,
    lineHeight: 18,
  },
}));
