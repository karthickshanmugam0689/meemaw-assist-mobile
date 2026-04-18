/**
 * Browser-side audio helpers: record from mic, play back TTS.
 *
 * Uses MediaRecorder for recording. webm/opus is the most widely supported
 * input format and Whisper accepts it.
 */

export class MicRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    if (this.recorder) {
      throw new Error("recorder already running");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Pick the best supported mime type
    const mime = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.chunks = [];

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.start();
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) {
        reject(new Error("recorder not started"));
        return;
      }
      this.recorder.onstop = () => {
        const mime = this.recorder?.mimeType ?? "audio/webm";
        const blob = new Blob(this.chunks, { type: mime });
        this.cleanup();
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return "audio/webm";
}

/**
 * Play an audio blob and resolve when playback finishes.
 * Returns an AbortController-like handle so the caller can stop early.
 */
export function playAudio(blob: Blob): { done: Promise<void>; stop: () => void } {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  const done = new Promise<void>((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
  });

  audio.play().catch(() => {
    URL.revokeObjectURL(url);
  });

  return {
    done,
    stop: () => {
      audio.pause();
      URL.revokeObjectURL(url);
    },
  };
}

export function fileExtensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}
