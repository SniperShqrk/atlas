import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { MarbleBackdrop } from '@/components/MarbleBackdrop';
import { getArtwork } from '@/share/artwork';
import { ShareCard, CardFormat, CARD_FORMATS } from '@/share/cards';

/**
 * The share card, drawn at whatever width it is given and scaled from there.
 *
 * Everything is sized as a fraction of the render width rather than in fixed
 * points, because the same component is used at ~330pt on screen and captured
 * at 1080px for export. One layout, two scales, no second implementation to
 * keep in sync.
 */

const RATIO = 1080; // the width every proportion below is expressed against

export const ShareCardView = forwardRef<View, {
  card: ShareCard;
  format: CardFormat;
  /** rendered width in points; height follows from the format */
  width: number;
}>(function ShareCardView({ card, format, width }, ref) {
  const { colors } = useTheme();
  const styles = useStyles();
  const f = CARD_FORMATS[format];
  const height = (width * f.h) / f.w;
  const art = getArtwork(card.artworkId);
  const s = width / RATIO; // scale factor

  const when = new Date(card.at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height, borderRadius: 44 * s }]}
    >
      <MarbleBackdrop
        artwork={art}
        width={f.w}
        height={f.h}
        seed={`${card.kind}${card.artworkId}${card.title}`}
      />

      {/* a hairline inset frame — the one classical gesture on the card */}
      <View
        style={[
          styles.frame,
          { margin: 40 * s, borderRadius: 20 * s, borderWidth: Math.max(1, 2 * s) },
        ]}
        pointerEvents="none"
      />

      <View style={[styles.content, { padding: 86 * s }]}>
        <View style={styles.header}>
          <Text style={[styles.mark, { fontSize: 38 * s, letterSpacing: 13 * s }]}>
            ATL<Text style={{ color: colors.bronze }}>A</Text>S
          </Text>
          <Text style={[styles.when, { fontSize: 30 * s, letterSpacing: 2.6 * s }]}>{when}</Text>
        </View>

        <View style={{ flex: 1 }} />

        <View>
          <Text style={[styles.eyebrow, { fontSize: 29 * s, letterSpacing: 6.4 * s }]}>
            {card.eyebrow.toUpperCase()}
          </Text>

          <View style={[styles.heroRow, { marginTop: 26 * s, gap: 20 * s }]}>
            <Text style={[styles.hero, { fontSize: 186 * s, letterSpacing: -7 * s }]}>
              {card.hero}
            </Text>
            {!!card.heroUnit && (
              <Text style={[styles.heroUnit, { fontSize: 49 * s, paddingBottom: 22 * s }]}>
                {card.heroUnit}
              </Text>
            )}
          </View>

          <Text style={[styles.title, { fontSize: 55 * s, marginTop: 34 * s }]}>{card.title}</Text>
          {!!card.subtitle && (
            <Text style={[styles.subtitle, { fontSize: 36 * s, marginTop: 12 * s }]}>
              {card.subtitle}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.stats,
            { marginTop: 64 * s, paddingTop: 46 * s, borderTopWidth: Math.max(1, 2 * s) },
          ]}
        >
          {card.stats.slice(0, 3).map((stat) => (
            <View key={stat.label} style={{ flex: 1 }}>
              <Text style={[styles.statValue, { fontSize: 43 * s }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { fontSize: 27 * s, letterSpacing: 2.3 * s, marginTop: 9 * s }]}>
                {stat.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {card.sample && (
        <View
          style={[
            styles.sample,
            { top: 150 * s, right: 86 * s, paddingHorizontal: 18 * s, paddingVertical: 8 * s, borderRadius: 10 * s },
          ]}
        >
          <Text style={[styles.sampleText, { fontSize: 25 * s, letterSpacing: 4 * s }]}>EXAMPLE</Text>
        </View>
      )}
    </View>
  );
});

const INK = '#F0EEE9';
const DIM = 'rgba(240,238,233,0.62)';
const FAINT = 'rgba(240,238,233,0.38)';
const HAIR = 'rgba(240,238,233,0.16)';

const useStyles = makeStyles((c) => ({
  card: { overflow: 'hidden', backgroundColor: c.bg },
  frame: {
    ...StyleSheet.absoluteFill,
    borderColor: 'rgba(240,238,233,0.14)',
  },
  content: { ...StyleSheet.absoluteFill, flexDirection: 'column' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  mark: { color: INK, fontWeight: '700' },
  when: { color: FAINT, fontWeight: '500' },
  eyebrow: { color: c.bronze, fontWeight: '700' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end' },
  hero: { color: INK, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroUnit: { color: DIM, fontWeight: '600' },
  title: { color: INK, fontWeight: '600', letterSpacing: -0.5 },
  subtitle: { color: DIM, fontWeight: '400' },
  stats: { flexDirection: 'row', borderTopColor: HAIR },
  statValue: { color: INK, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { color: FAINT, fontWeight: '600' },
  sample: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.5)',
  },
  sampleText: { color: c.bronze, fontWeight: '700' },
}));
