import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

/**
 * The rest timer's completion chirp — a short two-note "ding-ding", not an
 * alarm. Fires alongside haptics.restDone() so hitting zero is both felt and
 * heard, since a lot of training happens with the phone face-down on a bench
 * or a rack shelf where the haptic alone is easy to miss.
 *
 * playsInSilentMode is intentional here, not an oversight: gyms are loud and
 * phones are routinely on silent/vibrate there, and a "rest is over" cue that
 * goes quiet exactly when it's most likely to be muted defeats the point —
 * this is the same reasoning a kitchen timer app uses.
 */

let audioModeReady = false;
async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // best-effort — a failed mode set just means the chirp may respect
    // silent mode on this device instead of overriding it, not a crash
  }
}

// A fresh player per play, not one long-lived instance — this fires at most
// once every couple of minutes (once per rest window), so the cost of
// creating one is nothing, and it sidesteps ever calling .play() on a
// player mid-teardown from the previous rest.
export function playRestComplete() {
  try {
    ensureAudioMode();
    const player: AudioPlayer = createAudioPlayer(require('../../assets/sounds/rest-complete.wav'));
    player.volume = Platform.OS === 'ios' ? 0.9 : 1;
    player.play();
    // Release once playback finishes — the clip is ~300ms, so a fixed
    // timeout well past that is simpler and just as safe as wiring up the
    // player's own status-change listener for a one-shot sound this short.
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        // already released — fine
      }
    }, 1500);
  } catch {
    // sound is pure polish — never let it take the rest timer down
  }
}
