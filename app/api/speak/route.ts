import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, MODELS } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

type SpeakRequest = {
  text: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SpeakRequest;

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "text string required" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();

    const speech = await openai.audio.speech.create({
      model: MODELS.tts,
      voice: MODELS.voice,
      input: body.text,
      // slower speech is kinder to older listeners
      speed: 0.95,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("speak error", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
