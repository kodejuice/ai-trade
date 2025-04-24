import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";

import { getCachedResult } from "../cache.js";
import { getGeminiReponse } from "./gemini.js";
import { getGroqResponse } from "./groq.js";
import { getOpenAIReponse } from "./openai.js";

export async function LLMResponse({ systemPrompt, userPrompt }) {
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${systemPrompt}:${userPrompt}`)
    .digest("hex");
  return getCachedResult(
    `${cacheKey}`,
    async () => {
      const response = await getGeminiReponse({ systemPrompt, userPrompt });
      return response;
    },
    60 * 60 * 24 // 1 day
  );
}

export async function getLLMResponse({
  systemPrompt,
  userPrompt,
  platform,
  model = undefined,
}) {
  if (platform === "gemini") {
    return getGeminiReponse({
      systemPrompt,
      userPrompt,
      model: model || "gemini-2.5-flash-preview-04-17",
    });
  }
  if (platform === "groq") {
    return getGroqResponse({ systemPrompt, userPrompt });
  }
  if (platform === "openai") {
    return getOpenAIReponse({ systemPrompt, userPrompt, model });
  }

  return LLMResponse({ systemPrompt, userPrompt });
}
