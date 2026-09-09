import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * "Classical Line" icon set — thin rounded strokes on a 24x24 grid, drawn to
 * read as an arch, a scroll, a figure rather than generic app furniture.
 * Every icon is a single path so it inherits one colour cleanly.
 */
export const ICON_PATHS = {
  home: 'M4,20.5 V11 C4,6.9 7.6,3.5 12,3.5 C16.4,3.5 20,6.9 20,11 V20.5 M4,20.5 H20',
  plan:
    'M5,6.5 C5,5.1 6.1,4 7.5,4 C8.9,4 10,5.1 10,6.5 V17.5 C10,18.9 11.1,20 12.5,20 H17 ' +
    'C18.4,20 19.5,18.9 19.5,17.5 V6.5 C19.5,5.1 18.4,4 17,4 H7.5 ' +
    'M12.8,8.5 H16.6 M12.8,12 H16.6 M12.8,15.5 H15.2',
  workout: 'M2.8,9.5 V14.5 M6.3,6 V18 M17.7,6 V18 M21.2,9.5 V14.5 M6.3,12 H17.7',
  library: 'M6.5,6.5 H19.5 M6.5,12 H19.5 M6.5,17.5 H14.5 M3.2,6.5 H3.21 M3.2,12 H3.21 M3.2,17.5 H3.21',
  profile:
    'M12,3.8 C14.3,3.8 16.1,5.6 16.1,7.9 C16.1,10.2 14.3,12 12,12 ' +
    'C9.7,12 7.9,10.2 7.9,7.9 C7.9,5.6 9.7,3.8 12,3.8 Z ' +
    'M4.8,20.5 C4.8,16.4 8,13.4 12,13.4 C16,13.4 19.2,16.4 19.2,20.5',
  back: 'M14.5,5 L7.5,12 L14.5,19',
  close: 'M6,6 L18,18 M18,6 L6,18',
  plus: 'M12,5 V19 M5,12 H19',
  check: 'M5,12.5 L9.5,17 L19,7',
  search: 'M11,4 A7,7 0 1 1 10.99,4 Z M16.2,16.2 L20.5,20.5',
  info: 'M12,3.5 A8.5,8.5 0 1 1 11.99,3.5 Z M12,10.5 V16.5 M12,7.4 H12.01',
  timer: 'M12,7 V12 L15,14.5 M12,3.5 A8.5,8.5 0 1 1 11.99,3.5 Z',
  trophy:
    'M7.5,4 H16.5 V9 C16.5,11.5 14.5,13.5 12,13.5 C9.5,13.5 7.5,11.5 7.5,9 Z ' +
    'M7.5,5.5 H4.5 V7 C4.5,8.7 5.8,10 7.5,10 M16.5,5.5 H19.5 V7 C19.5,8.7 18.2,10 16.5,10 ' +
    'M12,13.5 V17 M8.5,20 H15.5 M9.5,17 H14.5 L15.5,20 H8.5 Z',
  lock:
    'M7,10.5 V7.5 C7,4.7 9.2,2.5 12,2.5 C14.8,2.5 17,4.7 17,7.5 V10.5 ' +
    'M5.5,10.5 H18.5 C19.3,10.5 20,11.2 20,12 V19.5 C20,20.3 19.3,21 18.5,21 ' +
    'H5.5 C4.7,21 4,20.3 4,19.5 V12 C4,11.2 4.7,10.5 5.5,10.5 Z M12,14.5 V17',
  chart:
    'M4,20 V4 M4,20 H20 M8,16.5 V12 M12,16.5 V7.5 M16,16.5 V10',
  scale:
    'M12,3.5 A8.5,8.5 0 1 1 11.99,3.5 Z M12,12 L15.5,8 M8.5,15.5 H15.5',
  plates:
    'M8,4.5 H16 M8,19.5 H16 M6.5,7.5 V16.5 M9.5,5.5 V18.5 M14.5,5.5 V18.5 M17.5,7.5 V16.5 M11.5,4 V20 M12.5,4 V20',
  sparkle:
    'M12,3 L13.6,9.1 L19.5,10.8 L13.6,12.5 L12,18.6 L10.4,12.5 L4.5,10.8 L10.4,9.1 Z ' +
    'M18.5,16 L19.2,18.3 L21.5,19 L19.2,19.7 L18.5,22 L17.8,19.7 L15.5,19 L17.8,18.3 Z',
  calendar:
    'M4.5,6 H19.5 V20 H4.5 Z M8,3.5 V7.5 M16,3.5 V7.5 M4.5,10.5 H19.5',
  flame:
    'M12,21.5 C8.4,21.5 5.5,18.8 5.5,15.2 C5.5,11 9.5,8.5 10.5,4 ' +
    'C13.5,6 14.5,9 14.5,11 C15.5,10.5 16,9.5 16,8.5 C17.6,10.3 18.5,12.7 18.5,15.2 ' +
    'C18.5,18.8 15.6,21.5 12,21.5 Z',
  edit: 'M4,20 L4.8,16.2 L16.3,4.7 C17.1,3.9 18.3,3.9 19.1,4.7 C19.9,5.5 19.9,6.7 19.1,7.5 L7.6,19 Z',
  chevron: 'M9,5 L16,12 L9,19',
  palette:
    'M12,3.2 C7.2,3.2 3.2,7 3.2,11.7 C3.2,16.4 7.2,20.2 12,20.2 ' +
    'C13.1,20.2 13.9,19.4 13.9,18.4 C13.9,17.9 13.7,17.5 13.4,17.2 ' +
    'C13.1,16.9 12.9,16.5 12.9,16 C12.9,15 13.7,14.2 14.8,14.2 H16.6 ' +
    'C19,14.2 20.8,12.4 20.8,10.1 C20.8,6.3 16.9,3.2 12,3.2 Z ' +
    'M7.3,11.2 H7.31 M10,7.8 H10.01 M14.4,7.8 H14.41 M17.2,11.2 H17.21',
  share:
    'M12,15.5 V3.5 M8.2,7 L12,3.2 L15.8,7 ' +
    'M6,11 H4.8 C4.1,11 3.5,11.6 3.5,12.3 V19.2 C3.5,19.9 4.1,20.5 4.8,20.5 ' +
    'H19.2 C19.9,20.5 20.5,19.9 20.5,19.2 V12.3 C20.5,11.6 19.9,11 19.2,11 H18',
  friends:
    'M9,4.2 C10.7,4.2 12.1,5.6 12.1,7.3 C12.1,9 10.7,10.4 9,10.4 C7.3,10.4 5.9,9 5.9,7.3 C5.9,5.6 7.3,4.2 9,4.2 Z ' +
    'M2.5,19.5 C2.5,15.9 5.4,13.4 9,13.4 C12.6,13.4 15.5,15.9 15.5,19.5 ' +
    'M15.5,5 C16.9,5.3 18,6.6 18,8.1 C18,9.6 16.9,10.9 15.5,11.2 ' +
    'M17,13.7 C19.6,14.3 21.5,16.5 21.5,19.5',
  // Equipment glyphs used by ExerciseThumb so exercises read as what you're
  // actually doing (barbell vs dumbbell vs machine, etc.) instead of two-letter
  // initials of the exercise name. Keyed 1:1 with the Equipment values that
  // actually appear on an Exercise (see EQUIPMENT_ICONS in ExerciseThumb.tsx).
  equipBarbell: 'M4,9.5 V14.5 M20,9.5 V14.5 M6.5,12 H17.5',
  equipDumbbell: 'M2.5,9 V15 M4.5,7.5 V16.5 M19.5,7.5 V16.5 M21.5,9 V15 M6.5,12 H17.5',
  equipMachine: 'M9,4.5 V19.5 M15,4.5 V19.5 M7,7 H17 M7,10 H17 M7,13 H17 M7,16 H17',
  equipCable:
    'M12,3.5 A3,3 0 1 1 11.99,3.5 Z M12,6.5 V15 ' +
    'M8.5,15 C8.5,15 8.5,18.5 12,18.5 C15.5,18.5 15.5,15 15.5,15',
  equipBodyweight:
    'M12,3.5 A2.2,2.2 0 1 1 11.99,3.5 Z M12,7.7 V15 ' +
    'M12,9.5 L7.5,12.5 M12,9.5 L16.5,12.5 M12,15 L8,20.5 M12,15 L16,20.5',
  equipKettlebell:
    'M9.5,8 C9.5,5.8 10.6,4.2 12,4.2 C13.4,4.2 14.5,5.8 14.5,8 ' +
    'M7,13 C7,9.8 9.2,8 12,8 C14.8,8 17,9.8 17,13 C17,16.8 14.8,19.8 12,19.8 C9.2,19.8 7,16.8 7,13 Z',
  equipBand:
    'M4,12 C4,9 6.5,7 9,9 C11.5,11 12.5,11 15,9 C17.5,7 20,9 20,12 ' +
    'C20,15 17.5,17 15,15 C12.5,13 11.5,13 9,15 C6.5,17 4,15 4,12 Z',
  equipSmith: 'M6,4 V20 M18,4 V20 M6,11 H18 M4,11 H6 M18,11 H20',
  eyeOpen:
    'M2.5,12 C2.5,12 6,6 12,6 C18,6 21.5,12 21.5,12 C21.5,12 18,18 12,18 C6,18 2.5,12 2.5,12 Z ' +
    'M12,14.5 A2.5,2.5 0 1 1 12.01,14.5 Z',
  eyeOff:
    'M2.5,12 C2.5,12 6,6 12,6 C18,6 21.5,12 21.5,12 C21.5,12 18,18 12,18 C6,18 2.5,12 2.5,12 Z ' +
    'M4,4 L20,20',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  /** defaults to the active theme's secondary text colour */
  color?: string;
  strokeWidth?: number;
}) {
  const { colors } = useTheme();
  const stroke = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={ICON_PATHS[name]}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
