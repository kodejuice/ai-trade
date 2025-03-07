import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

import { getCachedDataIO } from "./cache.js";
import { waitFor } from "./util.js";

const getOpenAIReponse = async ({
  systemPrompt,
  userPrompt,
  model = "gpt-4o-mini",
}) => {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: messages,
      temperature: 0.3,
      // max_completion_tokens: 300,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    if (`${error}`.includes("RateLimitError: 429")) {
      await waitFor(70);
      console.log("(openai) Rate limit exceeded. Waiting for 70 seconds...");
      return getOpenAIReponse({ systemPrompt, userPrompt, model });
    }

    console.error("Error getting chat response:", error);
    return "N/A";
  }
};

let geminiModels = [
  "gemini-2.0-flash-thinking-exp-01-21",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];
const M = geminiModels.slice();
const getGeminiReponse = async ({
  systemPrompt,
  userPrompt,
  model = geminiModels[0],
}) => {
  const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 65536,
    responseMimeType: "text/plain",
  };

  async function tryGeminiModel(model) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelInstance = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    const chatSession = modelInstance.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(userPrompt);
    return result.response.text();
  }

  try {
    return await tryGeminiModel(model);
  } catch (error) {
    if (!`${error}`.includes("429")) {
      return getOpenAIReponse({ systemPrompt, userPrompt });
    }

    // Try fallback models only if using the default model
    if (model === geminiModels[0]) {
      for (const fallbackModel of geminiModels.slice(1)) {
        try {
          const res = await tryGeminiModel(fallbackModel);
          geminiModels = [fallbackModel, ...geminiModels.filter((m) => m !== model)];
          console.log(`Using ${fallbackModel} as fallback model.`);
          return res;
        } catch(err) {
          continue;
        }
      }
    }

    console.log("Rate limit exceeded for Gemini API.");
    geminiModels = M; // Reset the models array
    return getOpenAIReponse({ systemPrompt, userPrompt });
  }
};

export async function LLMResponse({ systemPrompt, userPrompt }) {
  return getCachedDataIO(`${systemPrompt}::${userPrompt}`, async () => {
    // const response = await getOpenAIReponse({ systemPrompt, userPrompt });
    const response = await getGeminiReponse({ systemPrompt, userPrompt });
    return response;
  });
}
