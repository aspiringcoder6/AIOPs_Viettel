import {
  buildPrompt,
  extractJson,
  normalizeAnalyses,
} from "./gemini.js";

const GROQ_API_URL =
  process.env.GROQ_API_URL ||
  "https://api.groq.com/openai/v1";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

export function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

function getApiKey() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required");
  }

  return process.env.GROQ_API_KEY;
}

export async function analyzeWithGroq(bundle) {
  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: buildPrompt(bundle),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  if (!text) {  
    throw new Error("Groq returned empty response");
  }

  const parsed = extractJson(text);

  return normalizeAnalyses(parsed).map((analysis) => ({
    ...analysis,
    provider: "groq",
    model: GROQ_MODEL,
    raw_response: text,
  }));
}
