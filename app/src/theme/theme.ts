// ATLAS — the parts of the theme that do not vary by palette.
//
// Colours moved to theme/palettes.ts when the app gained four themes. Spacing,
// radii and the type scale are deliberately NOT themeable: a theme that
// changes the rhythm of the layout is a different app, not a different skin,
// and it would mean every screen needing a visual re-check per theme.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const typography = {
  hero: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.6 },
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  h2: { fontSize: 19, fontWeight: '600' as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  captionBold: { fontSize: 13, fontWeight: '700' as const },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1 },
  stat: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
  statLarge: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.9 },
};

export const metrics = { spacing, radius, typography };
export type Metrics = typeof metrics;
