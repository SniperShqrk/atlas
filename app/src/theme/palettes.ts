/**
 * ATLAS — the four palettes.
 *
 * A theme swaps tokens and nothing else. The colour language is fixed across
 * all four and must never be re-taught: the accent always means fatigued,
 * neglected, or the primary action, and bronze always means recovering,
 * complete, a record, or Premium. Someone who learns the app in Obsidian and
 * switches to Marble should not have to re-read a single chart.
 *
 * Every palette carries the same keys, so no screen can be theme-specific by
 * accident, and each is checked against the two hardest surfaces in the app —
 * the recovery heatmap and the balance radar — because those encode meaning in
 * colour and are where a lazy theme falls apart.
 */

export type ThemeName = 'obsidian' | 'marble' | 'bronze' | 'stone';

export interface Palette {
  name: ThemeName;
  label: string;
  /** one line describing the material, shown in the picker */
  blurb: string;
  /** drives the status bar and any platform chrome */
  isLight: boolean;

  bg: string;
  bgElevated: string;
  card: string;
  cardAlt: string;
  cardPressed: string;
  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textDim: string;
  textFaint: string;

  accent: string;
  accentPressed: string;
  accentSoft: string;

  bronze: string;
  bronzeSoft: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  gold: string;

  /** the anatomy figure — the untrained body sits behind every muscle state */
  bodyBase: string;
  bodyBaseLight: string;
  bodyMuscle: string;
  bodyLine: string;

  /** stone tones used for chart strokes, card fills and the share cards */
  marbleLight: string;
  marbleMid: string;
  marbleShade: string;

  targetPrimary: string;
  targetSecondary: string;

  /**
   * The recovery scale runs fresh → fatigued. Its top end has to read as
   * "rested" against that theme's own ground, which is why Marble inverts it:
   * a bright muscle on a bright page is an invisible muscle.
   */
  recoveryFresh: string;
  recoveryReady: string;
  recoveryModerate: string;
  recoveryFatigued: string;
  recoveryUntrained: string;

  /** text and icons that sit on top of an accent-filled surface */
  onAccent: string;
}

/* ------------------------------------------------------------------ */

/** Volcanic glass. Near-black, warm greys, red-figure terracotta. The default. */
const obsidian: Palette = {
  name: 'obsidian',
  label: 'Obsidian',
  blurb: 'Volcanic glass and terracotta. The default.',
  isLight: false,

  bg: '#0D0D0E',
  bgElevated: '#141415',
  card: '#181715',
  cardAlt: '#1F1E1C',
  cardPressed: '#272522',
  border: '#2A2825',
  borderStrong: '#38352F',

  text: '#F0EEE9',
  textSecondary: '#A8A49B',
  textDim: '#8C887F',
  textFaint: '#5A5750',

  accent: '#B4472F',
  accentPressed: '#94391F',
  accentSoft: 'rgba(180,71,47,0.15)',

  bronze: '#C08A3E',
  bronzeSoft: 'rgba(192,138,62,0.15)',

  success: '#C08A3E',
  successSoft: 'rgba(192,138,62,0.14)',
  danger: '#8F3222',
  dangerSoft: 'rgba(143,50,34,0.16)',
  warning: '#C08A3E',
  gold: '#C08A3E',

  bodyBase: '#35322E',
  bodyBaseLight: '#45413C',
  bodyMuscle: '#5E5A54',
  bodyLine: '#141312',

  marbleLight: '#EDEAE3',
  marbleMid: '#C9C5BC',
  marbleShade: '#9A958C',

  targetPrimary: '#B4472F',
  targetSecondary: '#C08A3E',

  recoveryFresh: '#EDEAE3',
  recoveryReady: '#C9C5BC',
  recoveryModerate: '#C08A3E',
  recoveryFatigued: '#B4472F',
  recoveryUntrained: '#5E5A54',

  onAccent: '#F5F2EC',
};

/**
 * Pentelic marble. The light theme — warm white ground, ink the colour of wet
 * stone. The recovery and target scales invert here so a rested muscle is pale
 * stone against the figure rather than pale stone against the page.
 */
const marble: Palette = {
  name: 'marble',
  label: 'Marble',
  blurb: 'Pentelic white and deep ink. Reads in daylight.',
  isLight: true,

  bg: '#F4F2EC',
  bgElevated: '#FAF8F4',
  card: '#FFFFFF',
  cardAlt: '#EDEAE2',
  cardPressed: '#E3DFD5',
  border: '#DCD7CC',
  borderStrong: '#C4BEB0',

  text: '#1E1C19',
  textSecondary: '#57534B',
  textDim: '#6F6A61',
  textFaint: '#9A948A',

  accent: '#9C3A24',
  accentPressed: '#7E2D19',
  accentSoft: 'rgba(156,58,36,0.12)',

  bronze: '#8A6224',
  bronzeSoft: 'rgba(138,98,36,0.13)',

  success: '#8A6224',
  successSoft: 'rgba(138,98,36,0.12)',
  danger: '#8F3222',
  dangerSoft: 'rgba(143,50,34,0.12)',
  warning: '#8A6224',
  gold: '#8A6224',

  // The figure has to be materially darker than the page, or a rested muscle —
  // which is the palest thing on the scale — disappears into the body it is
  // drawn on. This was 1.06:1 before the contrast audit caught it.
  bodyBase: '#B5AE9F',
  bodyBaseLight: '#C6C0B2',
  bodyMuscle: '#9C947F',
  bodyLine: '#F4F2EC',

  marbleLight: '#2B2822',
  marbleMid: '#57534B',
  marbleShade: '#8A857B',

  targetPrimary: '#9C3A24',
  targetSecondary: '#8A6224',

  // same direction as every other theme: palest is rested, accent is trashed
  recoveryFresh: '#F5F3ED',
  recoveryReady: '#DAD4C7',
  recoveryModerate: '#8A6224',
  recoveryFatigued: '#9C3A24',
  recoveryUntrained: '#B5AE9F',

  onAccent: '#FAF8F4',
};

/** Weathered bronze. Warm, oxidised, the most decorative of the four. */
const bronze: Palette = {
  name: 'bronze',
  label: 'Bronze',
  blurb: 'Oxidised metal and lamp black. Warm and heavy.',
  isLight: false,

  bg: '#0F0C09',
  bgElevated: '#171310',
  card: '#1C1712',
  cardAlt: '#241E17',
  cardPressed: '#2E261D',
  border: '#33291F',
  borderStrong: '#453729',

  text: '#F3EDE1',
  textSecondary: '#B3A48C',
  textDim: '#948570',
  textFaint: '#655847',

  accent: '#B84A2C',
  accentPressed: '#9A3C21',
  accentSoft: 'rgba(184,74,44,0.16)',

  bronze: '#D6A053',
  bronzeSoft: 'rgba(214,160,83,0.16)',

  success: '#D6A053',
  successSoft: 'rgba(214,160,83,0.15)',
  danger: '#9A3A24',
  dangerSoft: 'rgba(154,58,36,0.18)',
  warning: '#D6A053',
  gold: '#D6A053',

  bodyBase: '#3A2F23',
  bodyBaseLight: '#4B3D2D',
  bodyMuscle: '#65543E',
  bodyLine: '#120E0A',

  marbleLight: '#F3EDE1',
  marbleMid: '#CBB89A',
  marbleShade: '#9C8B70',

  targetPrimary: '#B84A2C',
  targetSecondary: '#D6A053',

  recoveryFresh: '#F3EDE1',
  recoveryReady: '#CBB89A',
  recoveryModerate: '#D6A053',
  recoveryFatigued: '#B84A2C',
  recoveryUntrained: '#65543E',

  onAccent: '#FBF6EC',
};

/** Quarried limestone. Cool, grey, the quietest of the four. */
const stone: Palette = {
  name: 'stone',
  label: 'Stone',
  blurb: 'Cool limestone and slate. The quietest one.',
  isLight: false,

  bg: '#101113',
  bgElevated: '#16181B',
  card: '#1B1D21',
  cardAlt: '#232629',
  cardPressed: '#2C2F34',
  border: '#2C3034',
  borderStrong: '#3C4147',

  text: '#ECEEF0',
  textSecondary: '#A0A6AD',
  textDim: '#848B93',
  textFaint: '#565C63',

  accent: '#A8503C',
  accentPressed: '#8A3E2C',
  accentSoft: 'rgba(168,80,60,0.16)',

  bronze: '#A79068',
  bronzeSoft: 'rgba(167,144,104,0.16)',

  success: '#A79068',
  successSoft: 'rgba(167,144,104,0.15)',
  danger: '#8F3A2A',
  dangerSoft: 'rgba(143,58,42,0.16)',
  warning: '#A79068',
  gold: '#A79068',

  bodyBase: '#2E3237',
  bodyBaseLight: '#3B4046',
  bodyMuscle: '#525960',
  bodyLine: '#0E0F11',

  marbleLight: '#E7EAEC',
  marbleMid: '#BCC1C6',
  marbleShade: '#8C9298',

  targetPrimary: '#A8503C',
  targetSecondary: '#A79068',

  recoveryFresh: '#E7EAEC',
  recoveryReady: '#BCC1C6',
  recoveryModerate: '#A79068',
  recoveryFatigued: '#A8503C',
  recoveryUntrained: '#525960',

  onAccent: '#F4F6F7',
};

export const PALETTES: Record<ThemeName, Palette> = {
  obsidian,
  marble,
  bronze,
  stone,
};

export const THEME_ORDER: ThemeName[] = ['obsidian', 'marble', 'bronze', 'stone'];

export const DEFAULT_THEME: ThemeName = 'obsidian';

export function getPalette(name: ThemeName | undefined): Palette {
  return PALETTES[name ?? DEFAULT_THEME] ?? PALETTES[DEFAULT_THEME];
}
