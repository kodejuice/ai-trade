import OpenAI from "openai";
import { waitFor } from "../util.js";

export const getOpenAIReponse = async ({
  systemPrompt,
  userPrompt,
  model = "gpt-4o-mini",
  retryCount = 0,
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
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    if (`${error}`.includes(" (TPM): Limit")) {
      const waitTime = Math.min(70 * (retryCount + 1), 300); // Incremental wait, max 5 minutes
      console.log(`(openai) Rate limit exceeded. Waiting for ${waitTime} seconds...`);
      await waitFor(waitTime);
      return getOpenAIReponse({ 
        systemPrompt, 
        userPrompt, 
        model, 
        retryCount: retryCount + 1 
      });
    }

    console.error("Error getting chat response:", `${error}`);
    return "N/A";
  }
};
