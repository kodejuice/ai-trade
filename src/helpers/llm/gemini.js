import { GoogleGenerativeAI } from "@google/generative-ai";

import { getOpenAIReponse } from "./openai.js";

let geminiModels = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-pro-exp-03-25",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-thinking-exp-01-21",
];
const M = geminiModels.slice();

let lastModelUsed = null;
export function getGeminiModel() {
  return lastModelUsed;
}

export const getGeminiReponse = async ({
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
    const resp = await tryGeminiModel(model);
    lastModelUsed = model;
    return resp;
  } catch (error) {
    // console.log("Error with Gemini model:", model, error);

    // Try fallback models
    for (const fallbackModel of geminiModels) {
      try {
        const res = await tryGeminiModel(fallbackModel);
        geminiModels[0] = fallbackModel;
        lastModelUsed = fallbackModel;
        return res;
      } catch (err) {
        continue;
      }
    }

    // console.log("Rate limit exceeded for Gemini API.");
    lastModelUsed = null;
    geminiModels = M; // Reset the models array
    return getOpenAIReponse({ systemPrompt, userPrompt });
  }
};
