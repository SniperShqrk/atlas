import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Rect, Circle, Polygon } from 'react-native-svg';
import { Screen } from '@/components/ui';
import { ModalHeader, BottomInset } from '@/components/ScreenLayout';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme, useThemeStore } from '@/theme/ThemeProvider';
import { PALETTES, Palette, THEME_ORDER, ThemeName } from '@/theme/palettes';
import { Icon } from '@/components/Icon';

/**
 * The theme picker.
 *
 * Each row previews the palette on the two surfaces that actually matter — a
 * card with type on it, and the colour scale the app encodes meaning in. A
 * swatch strip would show that the colours differ; this shows whether the
 * theme still works, which is the only question worth asking.
 */
export default function ThemeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const active = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Screen>
      <ModalHeader title="Appearance" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Four materials, one app. Colour means the same thing in all of them — accent for a
          muscle that needs work, bronze for one that is recovering or a set that is done.
        </Text>

        {THEME_ORDER.map((name) => (
          <ThemeRow
            key={name}
            palette={PALETTES[name]}
            selected={name === active}
            onSelect={() => setTheme(name)}
          />
        ))}

        <Text style={styles.footnote}>
          The choice is saved on this device and applies everywhere in the app, including the
          recovery map and the share cards.
        </Text>
        <BottomInset extra={spacing.lg} />
      </ScrollView>
    </Screen>
  );
}

function ThemeRow({
  palette,
  selected,
  onSelect,
}: {
  palette: Palette;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        selected && { borderColor: colors.bronze },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{palette.label}</Text>
          <Text style={styles.rowBlurb}>{palette.blurb}</Text>
        </View>
        {selected ? (
          <Icon name="check" size={20} color={colors.bronze} strokeWidth={2.2} />
        ) : (
          <View style={[styles.radio, { borderColor: colors.borderStrong }]} />
        )}
      </View>

      <PalettePreview palette={palette} />
    </Pressable>
  );
}

/**
 * A miniature of the app in that palette: a card, a line of type, the recovery
 * scale and a fragment of the balance polygon. Drawn with the palette's own
 * tokens rather than the active theme's, which is the whole point.
 */
function PalettePreview({ palette: p }: { palette: Palette }) {
  const styles = useStyles();
  const W = 280;
  const H = 92;

  const scale = [
    p.recoveryFresh,
    p.recoveryReady,
    p.recoveryModerate,
    p.recoveryFatigued,
    p.recoveryUntrained,
  ];

  return (
    <View style={styles.preview}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* the ground and a card on it */}
        <Rect x={0} y={0} width={W} height={H} rx={8} fill={p.bg} />
        <Rect x={10} y={10} width={W - 20} height={H - 20} rx={7} fill={p.card} stroke={p.border} />

        {/* type: a heading, a body line, an accent figure */}
        <Rect x={22} y={22} width={74} height={7} rx={3.5} fill={p.text} />
        <Rect x={22} y={35} width={116} height={5} rx={2.5} fill={p.textDim} />
        <Rect x={22} y={46} width={54} height={5} rx={2.5} fill={p.textFaint} />
        <Rect x={22} y={62} width={40} height={11} rx={5.5} fill={p.accent} />
        <Rect x={68} y={62} width={30} height={11} rx={5.5} fill={p.bronzeSoft} stroke={p.bronze} />

        {/* the recovery scale, which is where a careless palette falls apart */}
        {scale.map((tone, i) => (
          <Circle key={i} cx={168 + i * 17} cy={30} r={6.5} fill={tone} />
        ))}

        {/* a fragment of the balance polygon on its own grid */}
        <Polygon
          points="168,74 186,58 214,62 240,52 258,70"
          fill="none"
          stroke={p.marbleLight}
          strokeWidth={1.6}
        />
        <Polygon
          points="168,80 186,68 214,72 240,64 258,78"
          fill="none"
          stroke={p.bronze}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  intro: {
    ...typography.caption,
    color: c.textDim,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  row: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { ...typography.h3, color: c.text },
  rowBlurb: { ...typography.caption, color: c.textDim, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  preview: { marginTop: spacing.md, borderRadius: 8, overflow: 'hidden' },
  footnote: {
    ...typography.caption,
    color: c.textFaint,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
}));
