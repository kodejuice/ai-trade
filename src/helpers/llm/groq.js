import OpenAI from "openai";

import { getGeminiReponse } from "./gemini.js";

const groqModels = [
  "deepseek-r1-distill-llama-70b",
  "llama-3.2-90b-vision-preview",
  "deepseek-r1-distill-qwen-32b",
  // "qwen-2.5-32b",
  // "qwen-qwq-32b",
];

let lastModelUsed = null;

export function getGroqModel() {
  return lastModelUsed;
}

/**
 * Get chat response from Groq API
 */
export const getGroqResponse = async ({ systemPrompt, userPrompt }) => {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    maxRetries: 2,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  for (const model of groqModels) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: messages,
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 10000,
      });
      lastModelUsed = model;
      return completion.choices[0].message.content;
    } catch (error) {
      continue;
    }
  }

  lastModelUsed = null;
  // console.log("\nGroq models failed to generate response, using Gemini");
  return getGeminiReponse({
    systemPrompt,
    userPrompt,
    model: "gemini-2.0-flash-thinking-exp-01-21",
  });
};
