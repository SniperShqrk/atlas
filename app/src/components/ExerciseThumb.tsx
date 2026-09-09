import React from 'react';
import { View } from 'react-native';
import { radius } from '@/theme/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { Category, Equipment, Exercise } from '@/data/exercises';
import { Icon, IconName } from '@/components/Icon';

/** Background tint still reads as muscle group at a glance; the glyph now shows
 *  what the exercise actually uses (barbell/dumbbell/machine/etc.) so two lifts
 *  in the same category — say a barbell bench press and a dumbbell fly — no
 *  longer render as identical thumbnails. Shared by the Exercise Library and
 *  any other screen (Home's preview section, the planner) that shows exercises
 *  in the same visual language. */
export const CATEGORY_COLORS: Record<Category, string> = {
  chest: '#B4472F',
  back: '#7A6E5E',
  shoulders: '#C08A3E',
  arms: '#8C7A62',
  legs: '#6E7A63',
  core: '#9A8C6A',
  full_body: '#6B675F',
};

/** Only equipment values that actually appear on an Exercise need an icon here —
 *  'bench' | 'squat_rack' | 'pull_up_bar' | 'dip_bars' are inferred add-on gear
 *  for equipment-access gating (see impliedEquipment), never an exercise's own
 *  primary `equipment` field. */
export const EQUIPMENT_ICONS: Partial<Record<Equipment, IconName>> = {
  barbell: 'equipBarbell',
  dumbbell: 'equipDumbbell',
  machine: 'equipMachine',
  cable: 'equipCable',
  bodyweight: 'equipBodyweight',
  kettlebell: 'equipKettlebell',
  band: 'equipBand',
  smith: 'equipSmith',
};

export function ExerciseThumb({ exercise, size = 46 }: { exercise: Exercise; size?: number }) {
  const styles = useStyles();
  const color = CATEGORY_COLORS[exercise.category];
  const iconName = EQUIPMENT_ICONS[exercise.equipment] ?? 'equipBodyweight';
  return (
    <View
      style={[
        styles.thumb,
        { width: size, height: size, backgroundColor: color + '22', borderColor: color + '55' },
      ]}
    >
      <Icon name={iconName} size={Math.round(size * 0.52)} color={color} strokeWidth={1.6} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  thumb: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
}));
