import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';
import { MuscleGroup } from '@/data/exercises';
import { MuscleLoad } from '@/store/recovery';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/palettes';
import { useWorkoutStore } from '@/store/workoutStore';
import {
  FRONT_REGIONS,
  BACK_REGIONS,
  FRONT_VIEW_BOX,
  BACK_VIEW_BOX,
  DELTOID_SPLIT,
  FRONT_REGIONS_FEMALE,
  BACK_REGIONS_FEMALE,
  FRONT_VIEW_BOX_FEMALE,
  BACK_VIEW_BOX_FEMALE,
  DELTOID_SPLIT_FEMALE,
  BodyRegion,
} from '@/data/bodyPaths';

export type BodyMapMode = 'recovery' | 'target';

interface BaseProps {
  view: 'front' | 'back';
  size?: number;
}

interface RecoveryProps extends BaseProps {
  mode: 'recovery';
  loads: Record<MuscleGroup, MuscleLoad>;
}

interface TargetProps extends BaseProps {
  mode: 'target';
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
}

type Props = RecoveryProps | TargetProps;

/**
 * Which of our muscle groups each region of the illustration represents.
 * `deltoids` is handled separately because it gets split into heads.
 */
const SLUG_TO_MUSCLE: Record<string, MuscleGroup | null> = {
  chest: 'chest',
  abs: 'abs',
  obliques: 'obliques',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  trapezius: 'traps',
  'upper-back': 'lats',
  'lower-back': 'lower_back',
  gluteal: 'glutes',
  hamstring: 'hamstrings',
  adductors: 'hamstrings',
  quadriceps: 'quads',
  calves: 'calves',
  tibialis: 'calves',
  // structural, never coloured by training
  neck: null,
  head: null,
  hair: null,
  hands: null,
  feet: null,
  knees: null,
  ankles: null,
};

/** Pure: takes the palette rather than reading it, so it is not a hook.
 *  'untrained' (never logged) and 'fresh' (fully recovered) intentionally
 *  render identically — both mean "clear to train", and splitting them
 *  into two colours on the figure implied a difference that isn't real. */
function recoveryColor(
  status: MuscleLoad['status'] | undefined,
  colors: Palette
): string {
  switch (status) {
    case 'fatigued':
      return colors.recoveryFatigued;
    case 'moderate':
      return colors.recoveryModerate;
    case 'ready':
      return colors.recoveryReady;
    case 'fresh':
    case 'untrained':
    default:
      return colors.recoveryFresh;
  }
}

export function BodyMap(props: Props) {
  const { colors } = useTheme();
  const { view, size = 220 } = props;
  const isFront = view === 'front';
  // Unset profile.gender falls back to the original male figure so every
  // existing profile keeps rendering exactly as it did before this option
  // existed.
  const isFemale = useWorkoutStore((s) => s.profile.gender) === 'female';
  const viewBox = isFront
    ? isFemale
      ? FRONT_VIEW_BOX_FEMALE
      : FRONT_VIEW_BOX
    : isFemale
      ? BACK_VIEW_BOX_FEMALE
      : BACK_VIEW_BOX;
  const regions = isFront
    ? isFemale
      ? FRONT_REGIONS_FEMALE
      : FRONT_REGIONS
    : isFemale
      ? BACK_REGIONS_FEMALE
      : BACK_REGIONS;
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const height = size * (vbH / vbW);

  /** Colour for one of our muscle groups under the current mode. */
  const colorFor = (muscle: MuscleGroup): string => {
    if (props.mode === 'recovery') return recoveryColor(props.loads[muscle]?.status, colors);
    if (props.primary.includes(muscle)) return colors.targetPrimary;
    if (props.secondary?.includes(muscle)) return colors.targetSecondary;
    return colors.bodyMuscle;
  };

  const fillForSlug = (slug: string): string => {
    const muscle = SLUG_TO_MUSCLE[slug];
    if (!muscle) return colors.bodyBase;
    return colorFor(muscle);
  };

  const deltoidSplit = isFemale ? DELTOID_SPLIT_FEMALE : DELTOID_SPLIT;
  const split = isFront ? deltoidSplit.front : deltoidSplit.back;
  // front view shows the anterior head on the inside of the cap; back shows the posterior
  const innerHead: MuscleGroup = isFront ? 'front_delts' : 'rear_delts';

  const renderRegion = (region: BodyRegion, key: string) => {
    if (region.slug === 'deltoids') return null; // drawn separately below
    const fill = fillForSlug(region.slug);
    return (
      <G key={key}>
        {[...region.left, ...region.right].map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={fill}
            stroke={colors.bodyLine}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}
      </G>
    );
  };

  const deltoid = regions.find((r) => r.slug === 'deltoids');

  /**
   * Each deltoid is painted twice — once clipped to the half nearest the body
   * (anterior at the front, posterior at the back) and once to the outer half
   * (lateral) — then outlined so the division reads as a muscle separation.
   */
  const renderDeltoid = (side: 'left' | 'right') => {
    if (!deltoid) return null;
    const box = split[side];
    const paths = deltoid[side];
    // "left" here is the left of the image, so its inner edge is the higher x
    const innerIsHighX = side === 'left';
    const innerRect = innerIsHighX
      ? { x: box.cut, width: box.x + box.w - box.cut }
      : { x: box.x, width: box.cut - box.x };
    const outerRect = innerIsHighX
      ? { x: box.x - 2, width: box.cut - box.x + 2 }
      : { x: box.cut, width: box.x + box.w - box.cut + 2 };

    const innerId = `delt-in-${view}-${side}`;
    const outerId = `delt-out-${view}-${side}`;

    return (
      <G key={`delt-${side}`}>
        <Defs>
          <ClipPath id={innerId}>
            <Rect x={innerRect.x} y={box.y - 4} width={innerRect.width} height={box.h + 8} />
          </ClipPath>
          <ClipPath id={outerId}>
            <Rect x={outerRect.x} y={box.y - 4} width={outerRect.width} height={box.h + 8} />
          </ClipPath>
        </Defs>

        <G clipPath={`url(#${innerId})`}>
          {paths.map((d, i) => (
            <Path key={`i${i}`} d={d} fill={colorFor(innerHead)} />
          ))}
        </G>
        <G clipPath={`url(#${outerId})`}>
          {paths.map((d, i) => (
            <Path key={`o${i}`} d={d} fill={colorFor('side_delts')} />
          ))}
        </G>

        {/* outline last so the clip seams sit under a clean edge */}
        {paths.map((d, i) => (
          <Path
            key={`s${i}`}
            d={d}
            fill="none"
            stroke={colors.bodyLine}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}
      </G>
    );
  };

  return (
    <Svg width={size} height={height} viewBox={viewBox}>
      {regions.map((r, i) => renderRegion(r, `${r.slug}-${i}`))}
      {renderDeltoid('left')}
      {renderDeltoid('right')}
    </Svg>
  );
}
