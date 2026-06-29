import {
  analyzeWithGemini,
  hasGeminiKey,
} from "./gemini.js";
import {
  analyzeWithGroq,
  hasGroqKey,
} from "./groq.js";

export async function analyzeBundle(bundle) {
  if (hasGroqKey()) {
    try {
      return await analyzeWithGroq(bundle);
    }
    catch (err) {
      console.error("[AGENT] Groq failed, trying Gemini fallback:", err.message);
    }
  }

  if (hasGeminiKey()) {
    return analyzeWithGemini(bundle);
  }

  throw new Error("GROQ_API_KEY or GEMINI_API_KEY is required");
}
