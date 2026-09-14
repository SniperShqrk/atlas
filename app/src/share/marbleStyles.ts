/**
 * ATLAS — share-card marble styles.
 *
 * Four procedural stone palettes the user can pick between on the share
 * screen. Purely generated (marbleGeometry.ts draws the veining, this file
 * just supplies the colour), so there is nothing to source or license —
 * unlike a photograph, a colour palette never has a rendering problem on
 * device.
 *
 * This is independent of `share/artwork.ts`'s per-card-kind object
 * (wreath/column/cuirass/helmet): that registry still decides which real
 * object *would* back a given card if a photograph existed, and still
 * drives the credits line. This file decides what colour the stone actually
 * renders in right now, by the user's own choice, the same for every card.
 */

export interface MarbleTone {
  /** deepest shadow */
  base: string;
  /** lit stone */
  highlight: string;
  /** direction the light comes from, in degrees clockwise from north */
  lightAngle: number;
  /** vein/speck colour — defaults to the theme's marbleLight when unset */
  veinColor?: string;
}

export interface MarbleStyle {
  id: string;
  label: string;
  /** one line shown under the label in the picker */
  note: string;
  tone: MarbleTone;
}

export const MARBLE_STYLES: MarbleStyle[] = [
  {
    id: 'carrara',
    label: 'Carrara White',
    note: 'Classic grey-white, the original',
    tone: { base: '#1c1c1c', highlight: '#3a3a3a', lightAngle: 325, veinColor: '#E8E6E1' },
  },
  {
    id: 'nero',
    label: 'Nero Marquina',
    note: 'Black stone, gold veining',
    tone: { base: '#0c0b0a', highlight: '#171512', lightAngle: 145, veinColor: '#C9A24A' },
  },
  {
    id: 'verde',
    label: 'Verde Alpi',
    note: 'Deep green stone',
    tone: { base: '#0e1310', highlight: '#1c2620', lightAngle: 325, veinColor: '#8FAE95' },
  },
  {
    id: 'sienna',
    label: 'Sienna Bronze',
    note: 'Warm bronze, matches the app',
    tone: { base: '#0e0a06', highlight: '#241b12', lightAngle: 145, veinColor: '#D99B53' },
  },
];

export const DEFAULT_MARBLE_STYLE = 'sienna';

export function getMarbleStyle(id: string | undefined): MarbleStyle {
  return MARBLE_STYLES.find((m) => m.id === id) ?? MARBLE_STYLES.find((m) => m.id === DEFAULT_MARBLE_STYLE)!;
}
