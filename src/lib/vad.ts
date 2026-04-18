import type { AudioRecorder } from "expo-audio";

/**
 * Dead-simple voice-activity detection for voice mode.
 *
 * expo-audio's recorder state carries a `metering` field (dB; roughly -160
 * for silence, -20 for loud speech). We poll it every ~80 ms, detect that
 * speech has happened, then wait for a sustained drop below a silence
 * threshold.
 */

export type WaitOpts = {
  /** Below this dB is considered silence. Tune per device. */
  silenceThreshold?: number;
  /** How long sustained silence must last to trigger a stop. */
  silenceMs?: number;
  /** Hard cap: never record longer than this, even without any speech. */
  maxMs?: number;
  /** If no speech ever detected after this long, stop anyway. */
  preSpeechTimeoutMs?: number;
};

export type WaitResult = "silence" | "timeout" | "cancelled";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForSilence(
  recorder: AudioRecorder,
  cancelRef: { current: boolean },
  opts: WaitOpts = {}
): Promise<WaitResult> {
  const silenceThreshold = opts.silenceThreshold ?? -38;
  const silenceMs = opts.silenceMs ?? 1500;
  const maxMs = opts.maxMs ?? 15000;
  const preSpeechTimeoutMs = opts.preSpeechTimeoutMs ?? 8000;

  const start = Date.now();
  let lastAboveTime = 0;
  let everSpoke = false;

  while (true) {
    if (cancelRef.current) return "cancelled";
    const now = Date.now();
    if (now - start >= maxMs) return "timeout";
    if (!everSpoke && now - start >= preSpeechTimeoutMs) return "timeout";

    let metering: number | null = null;
    try {
      const state = recorder.getStatus();
      metering = typeof state?.metering === "number" ? state.metering : null;
    } catch {
      // getStatus can throw if recorder is mid-teardown; treat as silence
    }

    if (metering !== null && metering > silenceThreshold) {
      lastAboveTime = now;
      everSpoke = true;
    } else if (everSpoke && now - lastAboveTime >= silenceMs) {
      return "silence";
    }

    await sleep(80);
  }
}
