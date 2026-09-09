import type { ImageSourcePropType } from 'react-native';

/**
 * GENERATED — do not edit by hand.
 *
 * `npx tsx tools/fetch-artwork.ts` downloads the Met's open-access photographs,
 * grades them, writes them into assets/artwork/ and rewrites this file with the
 * require() map. Until it has been run the map is empty and every share card
 * falls back to procedural marble, which is why the app builds from a clean
 * checkout with no image assets committed.
 *
 * Deliberately left empty for now — the real photographs weren't rendering
 * reliably on device (Metro/Expo Go kept serving a stale/blank asset), and
 * procedural marble is the known-good look. Re-run the fetch script whenever
 * it's worth debugging that again; nothing else needs to change.
 */
export const ARTWORK_IMAGES: Record<string, ImageSourcePropType> = {};

export const ARTWORK_FETCHED_AT: string | null = null;
