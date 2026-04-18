import * as Speech from "expo-speech";

/**
 * Speak text using the phone's native TTS. Returns a handle that resolves when
 * playback finishes and can be stopped early.
 */
export function speak(text: string): { stop: () => void; done: Promise<void> } {
  let settled = false;
  const done = new Promise<void>((resolve) => {
    Speech.speak(text, {
      rate: 0.95,
      pitch: 1.0,
      onDone: () => {
        if (settled) return;
        settled = true;
        resolve();
      },
      onStopped: () => {
        if (settled) return;
        settled = true;
        resolve();
      },
      onError: () => {
        if (settled) return;
        settled = true;
        resolve();
      },
    });
  });
  return {
    stop: () => {
      if (settled) return;
      settled = true;
      Speech.stop().catch(() => {});
    },
    done,
  };
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => {});
}
