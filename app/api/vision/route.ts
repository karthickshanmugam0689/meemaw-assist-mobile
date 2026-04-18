import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getOpenAI, MODELS } from "@/lib/openai";
import { MEEMAW_VISION_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Accepts a FormData payload with:
 *   - image: File (jpeg/png)
 *   - userText: string (optional — what the user said while taking the photo)
 *   - history: JSON string (optional — prior chat messages for context)
 *
 * Returns:
 *   {
 *     explanation: string,          // what Meemaw says (for TTS + chat)
 *     regions: Array<{              // where to draw the red circles
 *       x: number, y: number,       // top-left, as fraction 0..1 of image size
 *       width: number, height: number,
 *       label: string
 *     }>,
 *     followup: string              // what she asks next
 *   }
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image");
    const userText = (form.get("userText") as string | null) ?? "";
    const historyRaw = (form.get("history") as string | null) ?? "[]";

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "missing image" }, { status: 400 });
    }

    // Convert image to base64 data URL
    const bytes = new Uint8Array(await image.arrayBuffer());
    const base64 = Buffer.from(bytes).toString("base64");
    const mime = image.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    let history: Array<{ role: string; content: string }> = [];
    try {
      history = JSON.parse(historyRaw);
    } catch {
      history = [];
    }

    const userMessageText =
      userText && userText.trim().length > 0
        ? `The user just said: "${userText}". They also took this photo. Look carefully and help them.`
        : "The user sent this photo. Look carefully and help them understand what they're seeing.";

    const openai = getOpenAI();

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: MEEMAW_VISION_PROMPT },
      ...history.slice(-6).map<ChatCompletionMessageParam>((m) =>
        m.role === "assistant"
          ? { role: "assistant", content: m.content }
          : { role: "user", content: m.content }
      ),
      {
        role: "user",
        content: [
          { type: "text", text: userMessageText },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: MODELS.vision,
      messages,
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.5,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      explanation?: string;
      regions?: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        label?: string;
      }>;
      followup?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    // Clamp coords to [0,1] so a hallucinated value can't break the canvas
    const regions = (parsed.regions ?? []).map((r) => ({
      x: clamp01(r.x),
      y: clamp01(r.y),
      width: clamp01(r.width),
      height: clamp01(r.height),
      label: (r.label ?? "").toString().slice(0, 40),
    }));

    return NextResponse.json({
      explanation:
        parsed.explanation?.toString().trim() ||
        "I can see your picture. Let's look at it together.",
      regions,
      followup: parsed.followup?.toString().trim() ?? "",
    });
  } catch (err) {
    console.error("[/api/vision]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "vision failed" },
      { status: 500 }
    );
  }
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
