"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { StatusIndicator, type Status } from "@/components/StatusIndicator";
import { VoiceButton } from "@/components/VoiceButton";
import { ShowMeButton } from "@/components/ShowMeButton";
import { AnnotatedImage, type Region } from "@/components/AnnotatedImage";
import { MicRecorder, playAudio, fileExtensionForMime } from "@/lib/audio";
import { resizeImage, blobToObjectUrl } from "@/lib/image";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  // When present, this assistant message is paired with an annotated photo
  image?: { url: string; regions: Region[] };
};

const OPENING_LINE =
  "Hello! I'm Meemaw. Tell me what's going wrong, or tap the camera button to show me a picture.";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: OPENING_LINE },
  ]);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const recorderRef = useRef<MicRecorder | null>(null);
  const audioRef = useRef<{ stop: () => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<Array<() => void>>([]);

  // Clean up any object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((revoke) => revoke());
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  // Play opening line on first user interaction (mobile browsers block autoplay)
  const [greeted, setGreeted] = useState(false);
  const playGreeting = useCallback(async () => {
    if (greeted) return;
    setGreeted(true);
    try {
      setStatus("speaking");
      const audio = await fetchSpeech(OPENING_LINE);
      const handle = playAudio(audio);
      audioRef.current = handle;
      await handle.done;
    } catch {
      // if greeting fails we just fall back to text
    } finally {
      setStatus("idle");
    }
  }, [greeted]);

  const handlePress = useCallback(async () => {
    setErrorDetail(null);
    audioRef.current?.stop();
    audioRef.current = null;

    if (status === "idle" || status === "error") {
      if (!greeted) {
        await playGreeting();
        return;
      }

      try {
        const rec = new MicRecorder();
        await rec.start();
        recorderRef.current = rec;
        setStatus("listening");
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorDetail(
          "I couldn't access your microphone. Please allow mic access and try again."
        );
      }
      return;
    }

    if (status === "listening") {
      try {
        const rec = recorderRef.current;
        recorderRef.current = null;
        if (!rec) return;
        const blob = await rec.stop();
        setStatus("thinking");

        const transcript = await transcribeAudio(blob);
        if (!transcript.trim()) {
          setStatus("idle");
          return;
        }

        const nextMessages: ChatMessage[] = [
          ...messages,
          { role: "user", content: transcript },
        ];
        setMessages(nextMessages);

        const reply = await chat(nextMessages);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        setStatus("speaking");
        const audio = await fetchSpeech(reply);
        const handle = playAudio(audio);
        audioRef.current = handle;
        await handle.done;
        setStatus("idle");
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorDetail(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }, [status, messages, greeted, playGreeting]);

  /** Camera / file-picker flow: run Meemaw's vision pipeline and render the annotated photo inline. */
  const handleImage = useCallback(
    async (file: File) => {
      setErrorDetail(null);
      audioRef.current?.stop();
      audioRef.current = null;

      // Ensure greeting audio has been unlocked on this tap, so TTS works later.
      if (!greeted) {
        setGreeted(true);
      }

      try {
        setStatus("thinking");

        // 1. downscale
        const resized = await resizeImage(file, 1280, 0.85);
        const { url, revoke } = blobToObjectUrl(resized);
        objectUrlsRef.current.push(revoke);

        // 2. send to /api/vision with short history for context
        const form = new FormData();
        form.append("image", resized, "photo.jpg");
        form.append(
          "history",
          JSON.stringify(
            messages
              .filter((m) => !m.image) // don't resend image markers
              .slice(-6)
              .map((m) => ({ role: m.role, content: m.content }))
          )
        );

        const res = await fetch("/api/vision", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "vision failed" }));
          throw new Error(body.error || "vision failed");
        }
        const data = (await res.json()) as {
          explanation: string;
          regions: Region[];
          followup: string;
        };

        // 3. push a "user sent a photo" message, then Meemaw's reply with image
        setMessages((m) => [
          ...m,
          { role: "user", content: "📷 Sent a photo" },
          {
            role: "assistant",
            content: data.explanation,
            image: { url, regions: data.regions },
          },
          ...(data.followup
            ? [{ role: "assistant" as const, content: data.followup }]
            : []),
        ]);

        // 4. speak the explanation + followup together
        const spoken = data.followup
          ? `${data.explanation} ${data.followup}`
          : data.explanation;
        setStatus("speaking");
        const audio = await fetchSpeech(spoken);
        const handle = playAudio(audio);
        audioRef.current = handle;
        await handle.done;
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorDetail(
          err instanceof Error
            ? err.message
            : "I couldn't look at that photo. Please try another."
        );
        return;
      } finally {
        setStatus("idle");
      }
    },
    [messages, greeted]
  );

  const showMeDisabled =
    status === "listening" || status === "thinking" || status === "speaking";

  return (
    <main className="flex flex-col min-h-screen max-w-xl mx-auto px-4 pt-6 pb-8">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-center text-meemaw-primary">
          Meemaw Assist
        </h1>
        <p className="text-center text-lg text-gray-500 mt-1">
          Tech help that actually helps.
        </p>
      </header>

      <section
        className="flex-1 overflow-y-auto pb-6"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((m, i) => (
          <div key={i}>
            <ChatBubble role={m.role} text={m.content} />
            {m.image && (
              <div className="mt-2 mb-4">
                <AnnotatedImage
                  src={m.image.url}
                  regions={m.image.regions}
                  alt="Meemaw annotated your photo"
                />
              </div>
            )}
          </div>
        ))}
        {errorDetail && (
          <p className="text-center text-meemaw-danger text-base mt-2">
            {errorDetail}
          </p>
        )}
        <div ref={chatEndRef} />
      </section>

      <footer className="flex flex-col items-center gap-4 pt-4 sticky bottom-0 bg-meemaw-bg">
        <StatusIndicator status={status} />
        <VoiceButton status={status} onPress={handlePress} />
        <ShowMeButton onImage={handleImage} disabled={showMeDisabled} />
      </footer>
    </main>
  );
}

// ——— client helpers ———

async function transcribeAudio(blob: Blob): Promise<string> {
  const ext = fileExtensionForMime(blob.type);
  const form = new FormData();
  form.append("audio", blob, `recording.${ext}`);

  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "transcribe failed" }));
    throw new Error(body.error || "transcribe failed");
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "chat failed" }));
    throw new Error(body.error || "chat failed");
  }
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

async function fetchSpeech(text: string): Promise<Blob> {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error("speech synthesis failed");
  }
  return res.blob();
}
