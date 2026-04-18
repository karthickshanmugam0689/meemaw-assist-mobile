import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, MODELS } from "@/lib/openai";
import { MEEMAW_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: MODELS.chat,
      messages: [
        { role: "system", content: MEEMAW_SYSTEM_PROMPT },
        ...body.messages,
      ],
      temperature: 0.7,
      max_tokens: 250, // keep replies short — we're speaking them aloud
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!reply) {
      return NextResponse.json(
        { error: "empty reply from model" },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("chat error", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
