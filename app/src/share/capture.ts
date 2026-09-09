import { Share } from 'react-native';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ShareCard, CARD_FORMATS, CardFormat, cardAsText } from '@/share/cards';

/**
 * Turning a rendered card into something the user can post.
 *
 * The card is captured off the same component the preview shows, at export
 * resolution, so what gets posted is exactly what was on screen. Every failure
 * path falls back to sharing the card as text rather than showing an error —
 * a share that degrades is better than a share that dead-ends, and the text
 * form still carries the numbers and the wordmark.
 */

export type ShareResult = 'shared' | 'dismissed' | 'text_fallback' | 'failed';

/** Renders the referenced view to a PNG at the format's true pixel size. */
export async function captureCard(
  ref: React.RefObject<View | null>,
  format: CardFormat
): Promise<string | null> {
  if (!ref.current) return null;
  const f = CARD_FORMATS[format];
  try {
    return await captureRef(ref, {
      format: 'png',
      quality: 1,
      // captureRef takes the size in points and multiplies by the device
      // scale; asking for the export width directly keeps the output identical
      // across devices rather than varying with screen density
      width: f.w,
      height: f.h,
      result: 'tmpfile',
    });
  } catch {
    return null;
  }
}

/**
 * Capture and hand off to the OS share sheet. Falls back to a text share when
 * capture or the sharing module is unavailable.
 */
export async function shareCard(
  ref: React.RefObject<View | null>,
  card: ShareCard,
  format: CardFormat
): Promise<ShareResult> {
  const uri = await captureCard(ref, format);

  if (uri) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your progress',
          UTI: 'public.png',
        });
        return 'shared';
      }
    } catch {
      // fall through to text
    }
  }

  try {
    const result = await Share.share({ message: cardAsText(card) });
    return result.action === Share.dismissedAction ? 'dismissed' : 'text_fallback';
  } catch {
    return 'failed';
  }
}
