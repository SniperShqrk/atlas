import sharp from 'sharp';
import type { Artwork } from '../src/share/artwork';

/**
 * The grade applied to every downloaded museum photograph.
 *
 * Separated from the fetch script so it can be exercised without the network:
 * four photographs shot under four different lighting setups look like four
 * screenshots until they are pulled toward one black point, one saturation and
 * one aspect. This is the function that does that, and it is the part worth
 * testing.
 */

/** Story format — the tallest card. Every other format crops down from this. */
export const CARD_PIXELS = { width: 1080, height: 1920 };

export async function grade(input: Buffer, art: Artwork): Promise<Buffer> {
  const { desaturate, brightness, gravity, base } = art.tone;

  // the tint the whole set is pulled toward, taken from the fallback's shadow
  const rgb = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(base);
  const tint = rgb
    ? { r: parseInt(rgb[1], 16), g: parseInt(rgb[2], 16), b: parseInt(rgb[3], 16) }
    : { r: 20, g: 19, b: 17 };

  let pipeline = sharp(input);
  // Some source photographs frame the object in a small fraction of the
  // frame (a caption strip, a museum wall, empty studio backdrop) — `crop`
  // pulls out the region worth using before the cover-resize below, which
  // otherwise crops purely by aspect ratio and has no idea what matters.
  if (art.crop) pipeline = pipeline.extract(art.crop);

  return pipeline
    .resize(CARD_PIXELS.width, CARD_PIXELS.height, { fit: 'cover', position: gravity })
    .modulate({ saturation: 1 - desaturate, brightness })
    // a gentle S-curve so the marble keeps its form after being darkened
    .linear(1.12, -12)
    // A full .tint() replaces the image's colour and flattens the sculpture
    // into a silhouette. Compositing the tint at low opacity instead pulls the
    // four photographs toward a common cast while leaving the modelling — the
    // light down the arm, the shadow under the jaw — intact.
    .composite([
      {
        input: {
          create: {
            width: CARD_PIXELS.width,
            height: CARD_PIXELS.height,
            channels: 4,
            background: { ...tint, alpha: 0.42 },
          },
        },
        blend: 'over',
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
