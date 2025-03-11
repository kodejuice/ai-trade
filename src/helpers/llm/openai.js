import OpenAI from "openai";

import { waitFor } from "../util.js";

export const getOpenAIReponse = async ({
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
      temperature: 0.8,
      // max_completion_tokens: 300,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    if (`${error}`.includes(" (TPM): Limit")) {
      await waitFor(70);
      console.log("(openai) Rate limit exceeded. Waiting for 70 seconds...");
      return getOpenAIReponse({ systemPrompt, userPrompt, model });
    }

    console.error("Error getting chat response:", `${error}`);
    return "N/A";
  }
};
