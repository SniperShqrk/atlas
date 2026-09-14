import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * Line-art classical bust, drawn purely in strokes so it reads as an etching
 * rather than a photograph — the share card's one decorative flourish,
 * bleeding off the bottom-right corner the way the reference mockup does.
 *
 * Deliberately cropped at the chest and drawn draped, never bare — same
 * nudity-avoidance rule share/artwork.ts already documents for the
 * photographic backdrops, just applied to hand-drawn linework instead.
 * 'david' is the youthful, curly-haired figure (personal-effort cards —
 * a record, a session); 'caesar' wears the laurel wreath and a fastened
 * cloak (the command/consistency cards — a week, a streak, balance).
 *
 * viewBox is a fixed 200x260 "bust" canvas; callers size it with `size`
 * (rendered width in px, height follows the 200:260 ratio) and pick the
 * stroke colour to match whatever it sits on.
 */
export function ClassicalBust({
  variant,
  size = 140,
  color = '#F0EEE9',
  opacity = 0.5,
  strokeWidth = 2,
}: {
  variant: 'david' | 'caesar';
  size?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
}) {
  const W = 200;
  const H = 260;
  const height = (size * H) / W;

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${W} ${H}`} fill="none" opacity={opacity}>
      {variant === 'david' ? <DavidLines color={color} sw={strokeWidth} /> : <CaesarLines color={color} sw={strokeWidth} />}
    </Svg>
  );
}

function DavidLines({ color, sw }: { color: string; sw: number }) {
  return (
    <>
      {/* curly crown of hair — a ring of short arcs rather than a solid mass */}
      <Path
        d="M62,58 C58,40 72,26 100,24 C128,22 144,38 140,58"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {[68, 82, 96, 110, 124, 136].map((cx, i) => (
        <Path
          key={cx}
          d={`M${cx - 7},${34 + (i % 2) * 6} q7,-10 14,0`}
          stroke={color}
          strokeWidth={sw * 0.85}
          strokeLinecap="round"
        />
      ))}

      {/* face — oval, brow, nose, lips, jaw */}
      <Path
        d="M70,60 C68,90 72,116 100,128 C128,116 132,90 130,60"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path d="M78,72 Q88,66 96,72" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M104,72 Q112,66 122,72" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M98,80 C96,92 94,98 100,102" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M88,110 Q100,116 112,110" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />

      {/* neck, sloped shoulders, a drape folded over one shoulder */}
      <Path d="M84,126 L82,150 M116,126 L118,150" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path
        d="M40,220 C48,178 68,152 100,150 C132,152 154,180 164,220"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path
        d="M60,164 C74,178 76,204 66,222 M60,164 C50,172 44,192 46,214"
        stroke={color}
        strokeWidth={sw * 0.85}
        strokeLinecap="round"
      />
    </>
  );
}

function CaesarLines({ color, sw }: { color: string; sw: number }) {
  return (
    <>
      {/* laurel wreath — small paired leaves around the brow */}
      <Path
        d="M58,52 C64,36 80,26 100,26 C120,26 136,36 142,52"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {[64, 78, 92, 108, 122, 136].map((cx) => (
        <Path
          key={cx}
          d={`M${cx},46 l-6,-8 M${cx},46 l6,-8`}
          stroke={color}
          strokeWidth={sw * 0.8}
          strokeLinecap="round"
        />
      ))}

      {/* face — narrower, more angular than David's; receding hairline */}
      <Path
        d="M72,54 C68,86 72,114 100,130 C128,114 132,86 128,54"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path d="M80,50 Q100,42 120,50" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M80,74 Q88,68 96,74" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M104,74 Q112,68 120,74" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M99,82 C97,94 95,100 101,104" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Path d="M86,112 Q100,116 114,112" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" />

      {/* neck, squared armored shoulders, a cloak fastened at one side */}
      <Path d="M86,128 L84,152 M114,128 L116,152" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path
        d="M36,222 C42,182 66,154 100,152 C134,154 158,182 164,222"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Circle cx={132} cy={168} r={5} stroke={color} strokeWidth={sw * 0.85} />
      <Path
        d="M132,173 C140,188 146,206 142,222 M132,173 C118,182 108,200 110,222"
        stroke={color}
        strokeWidth={sw * 0.85}
        strokeLinecap="round"
      />
    </>
  );
}
