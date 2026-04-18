import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, MODELS } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "audio file field required" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();

    // Whisper auto-detects language. That's our multilingual superpower.
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: MODELS.stt,
      response_format: "verbose_json",
    });

    return NextResponse.json({
      text: transcription.text,
      language: (transcription as unknown as { language?: string }).language,
    });
  } catch (err) {
    console.error("transcribe error", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
