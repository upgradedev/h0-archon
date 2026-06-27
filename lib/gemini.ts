// Minimal Gemini REST client for the NarratorAgent.
// Uses the Generative Language API (https://ai.google.dev/) so there is no SDK
// dependency to bundle into the Vercel serverless function.

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export interface GeminiResult {
  text: string;
  model: string;
  ok: boolean;
  error?: string;
}

export async function generateText(prompt: string): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = DEFAULT_MODEL;

  if (!apiKey) {
    return {
      ok: false,
      model,
      text: "",
      error: "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.",
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, model, text: "", error: `HTTP ${res.status}: ${body.slice(0, 400)}` };
    }

    const data = (await res.json()) as any;
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";

    if (!text.trim()) {
      return { ok: false, model, text: "", error: "Empty response from Gemini." };
    }
    return { ok: true, model, text: text.trim() };
  } catch (err: any) {
    return { ok: false, model, text: "", error: String(err?.message || err) };
  }
}
