import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";

import { getCachedResult } from "../cache.js";
import { getGeminiReponse } from "./gemini.js";


export async function LLMResponse({ systemPrompt, userPrompt }) {
  const cacheKey = crypto.createHash("sha256").update(userPrompt).digest("hex");
  return getCachedResult(
    `${cacheKey}`,
    async () => {
      // console.log(userPrompt.match(/TICKER_1: [a-zA-Z0-9.]+/g)[0]);
      const response = await getGeminiReponse({ systemPrompt, userPrompt });
      return response;
    },
    60 * 60 * 24 // 1 day
  );
}
