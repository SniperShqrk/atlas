import React, { useMemo } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { marbleGeometry, seedFrom } from '@/components/marbleGeometry';
import { Artwork, artworkImage } from '@/share/artwork';

/**
 * The backdrop behind a share card.
 *
 * When the artwork entry has a real sculpture photograph it is used; until
 * then this draws procedural marble in the same tone, so the card system is
 * finished and shippable now and simply gets better when the photography
 * lands. Either way a scrim goes over the top — the card has to stay readable
 * regardless of what is behind it, and that is not something to leave to luck
 * with a photograph whose contents vary.
 */
export function MarbleBackdrop({
  artwork,
  width,
  height,
  seed,
}: {
  artwork: Artwork;
  width: number;
  height: number;
  /** any stable string — the same seed always yields the same slab */
  seed: string;
}) {
  const { colors } = useTheme();
  const geo = useMemo(
    () => marbleGeometry(width, height, seedFrom(seed), artwork.tone.lightAngle),
    [width, height, seed, artwork.tone.lightAngle]
  );

  const image = artworkImage(artwork.id);
  const gid = `stone-${artwork.id}`;
  const sid = `scrim-${artwork.id}`;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {image ? (
        <Image
          source={image}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient
            id={gid}
            x1={geo.light.x1}
            y1={geo.light.y1}
            x2={geo.light.x2}
            y2={geo.light.y2}
          >
            <Stop offset="0%" stopColor={artwork.tone.highlight} />
            <Stop offset="55%" stopColor={artwork.tone.base} />
            <Stop offset="100%" stopColor={artwork.tone.base} />
          </LinearGradient>
          <LinearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.3} />
            <Stop offset="42%" stopColor="#000000" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.86} />
          </LinearGradient>
        </Defs>

        {/* the stone itself, skipped when a photograph is doing that job */}
        {!image && (
          <G>
            <Rect width={width} height={height} fill={`url(#${gid})`} />
            {geo.veins.map((v, i) => (
              <Path
                key={`v${i}`}
                d={v.d}
                fill="none"
                stroke={colors.marbleLight}
                strokeWidth={v.width}
                strokeOpacity={v.opacity}
                strokeLinecap="round"
              />
            ))}
            {geo.specks.map((s, i) => (
              <Circle
                key={`s${i}`}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill={colors.marbleLight}
                fillOpacity={s.opacity}
              />
            ))}
          </G>
        )}

        {/* the scrim always runs, so type never has to fight the backdrop */}
        <Rect width={width} height={height} fill={`url(#${sid})`} />
      </Svg>
    </View>
  );
}
