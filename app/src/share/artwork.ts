import type { ImageSourcePropType } from 'react-native';
import { ARTWORK_IMAGES } from '@/share/artworkAssets';

/**
 * ATLAS — backdrop artwork registry.
 *
 * Four objects from the Metropolitan Museum of Art's Open Access collection.
 * Every one was checked against the Met's own collection API and reports
 * `isPublicDomain: true`, which under the Met's policy (in force since
 * February 2017) means the image is released CC0: free to use commercially,
 * remix and redistribute, with no permission and no attribution required.
 *
 * Deliberately not statues or busts: a full figure has to answer for the
 * nudity that is standard in Greek and Roman figural sculpture, and cropping
 * a figure at the waist just moves the problem instead of solving it. A
 * wreath, a column, a cuirass and a helmet carry the same classical/strength
 * register without ever putting a body in frame.
 *
 * The objects themselves are 1,900+ years old, so the only copyright question
 * was ever the photograph — which is exactly why these come from an
 * open-access museum programme rather than from an image search. The credits
 * below are printed in the app anyway: attribution is not required, but
 * naming where a thing came from costs one line and is the difference between
 * a licence you can defend and one you are hoping about.
 *
 * The images are not in the repository. `npx tsx tools/fetch-artwork.ts`
 * downloads them from the Met, grades them to the tones below and generates
 * `artworkAssets.ts`. Until that has run, `ARTWORK_IMAGES` is empty and every
 * card falls back to procedural marble, so the app builds and ships either way.
 */

export interface Artwork {
  id: string;
  /** the work, by the Met's own title */
  name: string;
  /** short form for the credits line */
  shortName: string;
  /** the Met's object ID — the source of truth for re-fetching */
  objectId: number;
  culture: string;
  date: string;
  medium: string;
  /** printed in the app's about screen */
  credit: string;
  sourceUrl: string;
  /** the file the fetch script downloads */
  imageUrl: string;
  /** one line on why this piece backs the cards it backs */
  rationale: string;

  /**
   * Pixels to extract from the downloaded photograph before grading —
   * source coordinates, not the output canvas. Optional: most photographs
   * are usable as downloaded, but a few need the caption strip, ruler, or
   * empty studio backdrop cropped out first, or a detail pulled out of a
   * wider scene.
   */
  crop?: { left: number; top: number; width: number; height: number };

  /** how the downloaded photograph is graded, and how the fallback is tinted */
  tone: {
    /** deepest shadow */
    base: string;
    /** lit stone */
    highlight: string;
    /** direction the light comes from, in degrees clockwise from north */
    lightAngle: number;
    /** 0–1, how much colour is pulled out of the photograph */
    desaturate: number;
    /** brightness multiplier applied after desaturation */
    brightness: number;
    /** which part of the frame to keep when cropping to portrait */
    gravity: 'north' | 'centre' | 'south';
  };
}

const CREDIT = 'The Metropolitan Museum of Art, Open Access (CC0)';

export const ARTWORK: Record<string, Artwork> = {
  /** Records — the wreath a victor was actually crowned with. */
  wreath: {
    id: 'wreath',
    name: 'Gold funerary wreath',
    shortName: 'Gold wreath',
    objectId: 254968,
    culture: 'Roman',
    date: '1st–2nd century CE',
    medium: 'Gold',
    credit: CREDIT,
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/254968',
    imageUrl: 'https://images.metmuseum.org/CRDImages/gr/web-large/SF5759.jpg',
    rationale:
      'The actual object a victor was crowned with, not a statue of one. Nothing reads "personal record" more directly than a laurel branch in gold.',
    crop: { left: 0, top: 30, width: 260, height: 340 },
    tone: { base: '#141311', highlight: '#8A7A4E', lightAngle: 35, desaturate: 0.35, brightness: 1.0, gravity: 'centre' },
  },

  /** Sessions and weeks — a column, load-bearing, the same every day. */
  column: {
    id: 'column',
    name: 'Marble column with base and capital',
    shortName: 'Column',
    objectId: 250646,
    culture: 'Roman',
    date: 'ca. 117–138 CE',
    medium: 'Marble',
    credit: CREDIT,
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/250646',
    imageUrl: 'https://images.metmuseum.org/CRDImages/gr/web-large/DP-14287-095.jpg',
    rationale:
      'A column does one unglamorous thing every single day: hold the weight. The right backdrop for the work that just gets done.',
    tone: { base: '#111214', highlight: '#4E525A', lightAngle: 320, desaturate: 0.6, brightness: 0.85, gravity: 'north' },
  },

  /** Balance — an anatomical cuirass, literally cast to the ideal form. */
  cuirass: {
    id: 'cuirass',
    name: 'Bronze cuirass (body armor)',
    shortName: 'Cuirass',
    objectId: 256134,
    culture: 'Greek, Apulian',
    date: '4th century BCE',
    medium: 'Bronze',
    credit: CREDIT,
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/256134',
    imageUrl: 'https://images.metmuseum.org/CRDImages/gr/web-large/DP102285.jpg',
    rationale:
      'Cast to an idealised torso — symmetry and proportion rendered literally in bronze. There is no better backdrop for a balance score.',
    tone: { base: '#141311', highlight: '#585148', lightAngle: 35, desaturate: 0.55, brightness: 0.85, gravity: 'centre' },
  },

  /** Streaks — a helmet worn smooth by repetition, not a single fight. */
  helmet: {
    id: 'helmet',
    name: 'Bronze helmet of the Corinthian type',
    shortName: 'Helmet',
    objectId: 247983,
    culture: 'Greek, Corinthian',
    date: 'late 7th–6th century BCE',
    medium: 'Bronze',
    credit: CREDIT,
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/247983',
    imageUrl: 'https://images.metmuseum.org/CRDImages/gr/web-large/3424.jpg',
    rationale:
      'Worn smooth over years of use, not one battle. Consistency is the least glamorous virtue in the set and it gets the darkest object.',
    crop: { left: 25, top: 15, width: 528, height: 560 },
    tone: { base: '#17130F', highlight: '#6B5B44', lightAngle: 55, desaturate: 0.55, brightness: 0.88, gravity: 'centre' },
  },
};

/** Ordered, for the credits screen and the fetch script. */
export const ARTWORK_LIST: Artwork[] = [
  ARTWORK.wreath,
  ARTWORK.column,
  ARTWORK.cuirass,
  ARTWORK.helmet,
];

export function getArtwork(id: string): Artwork {
  return ARTWORK[id] ?? ARTWORK.column;
}

/** The graded image for a work, or null when the fetch has not been run. */
export function artworkImage(id: string): ImageSourcePropType | null {
  return ARTWORK_IMAGES[id] ?? null;
}

/** Everything the about screen needs to print. */
export function artworkCredits(): {
  name: string;
  shortName: string;
  culture: string;
  date: string;
  credit: string;
  sourceUrl: string;
}[] {
  return ARTWORK_LIST.map((a) => ({
    name: a.name,
    shortName: a.shortName,
    culture: a.culture,
    date: a.date,
    credit: a.credit,
    sourceUrl: a.sourceUrl,
  }));
}
