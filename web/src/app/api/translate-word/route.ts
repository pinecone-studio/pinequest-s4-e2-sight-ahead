import type { NextRequest } from "next/server";

// Small mn↔en word lookup — used by the subtitle overlay when the user
// double-clicks a word. Calls OpenAI via the OPENAI_TRANSLATION_MODEL so we
// don't need a separate dictionary service; the frontend stays on the same
// origin (no CORS) and the API key stays server-side.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL =
  process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini";

type Payload = { word?: string; from?: "mn" | "en"; to?: "mn" | "en" };

export async function POST(request: NextRequest): Promise<Response> {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const word = (body.word || "").trim().slice(0, 40);
  const from = body.from === "en" ? "en" : "mn";
  const to = body.to === "en" ? "en" : "mn";

  if (!word) {
    return Response.json({ error: "word is required." }, { status: 400 });
  }
  if (from === to) {
    return Response.json({ translation: word });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const sourceLang = from === "mn" ? "Mongolian" : "English";
  const targetLang = to === "mn" ? "Mongolian" : "English";

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              `You translate ONE ${sourceLang} word into ${targetLang}. ` +
              `Reply with ONLY the translated word or short phrase — no ` +
              `explanations, no punctuation beyond what belongs to the word ` +
              `itself. If the word has multiple senses give the most common one.`,
          },
          { role: "user", content: word },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: `OpenAI ${res.status}`, detail: detail.slice(0, 200) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    // OpenAI sometimes wraps the answer in quotes — strip them.
    const translation = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    return Response.json({ translation });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Translate failed." },
      { status: 500 },
    );
  }
}
