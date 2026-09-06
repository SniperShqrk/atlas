import React from 'react';
import { View, Text } from 'react-native';
import { radius, typography } from '@/theme/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { Category, Exercise } from '@/data/exercises';

/** Two-letter monogram stands in for a thumbnail, coloured by category —
 *  shared by the Exercise Library and any other screen (Home's preview
 *  section, the planner) that shows exercises in the same visual language. */
export const CATEGORY_COLORS: Record<Category, string> = {
  chest: '#B4472F',
  back: '#7A6E5E',
  shoulders: '#C08A3E',
  arms: '#8C7A62',
  legs: '#6E7A63',
  core: '#9A8C6A',
  full_body: '#6B675F',
};

export function ExerciseThumb({ exercise, size = 46 }: { exercise: Exercise; size?: number }) {
  const styles = useStyles();
  const color = CATEGORY_COLORS[exercise.category];
  const initials = exercise.name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={[
        styles.thumb,
        { width: size, height: size, backgroundColor: color + '22', borderColor: color + '55' },
      ]}
    >
      <Text style={[styles.thumbText, { color, fontSize: Math.round(size * 0.3) }]}>{initials}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  thumb: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  thumbText: { ...typography.bodyMedium, fontWeight: '800' },
}));
