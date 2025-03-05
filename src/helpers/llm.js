import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

import { getCachedData } from "./cache.js";

const getOpenAIReponse = async ({ systemPrompt, userPrompt, model="gpt-4o-mini" }) => {
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
    console.error("Error getting chat response:", error);
    return "N/A";
  }
};

const getGeminiReponse = async ({ systemPrompt, userPrompt, model="gemini-2.0-flash-thinking-exp-01-21" }) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    const _model = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 65536,
      responseMimeType: "text/plain",
    };

    const chatSession = _model.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(userPrompt);

    return result.response.text();
  } catch (error) {
    return getOpenAIReponse({ systemPrompt, userPrompt });
  }
};

export async function LLMResponse({ systemPrompt, userPrompt }) {
  return getCachedData(`${systemPrompt}::${userPrompt}`, async () => {
    // const response = await getOpenAIReponse({ systemPrompt, userPrompt });
    const response = await getGeminiReponse({ systemPrompt, userPrompt });
    return response;
  });
}
