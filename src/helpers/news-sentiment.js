import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import { formatDistanceToNow } from "date-fns";

import { getLLMResponse } from "./llm/llm.js";
import { getCachedResult } from "./cache.js";

async function getNewsSentiment(text) {
  const sentiment = await getLLMResponse({
    systemPrompt: `You are a sentiment analysis model. You analyze news articles and determine the sentiment of the article.`,
    userPrompt: `Given the following text, classify the sentiment as positive, negative, or neutral. Dont include any additional text, just the single sentiment label:
${text}
-----

Return a single sentiment label: "Bullish" or "Bearish" or "Neutral". No additional text, just a single sentiment label.
`,
    platform: "openai",
    model: "gpt-4o-mini",
  });
  return sentiment.replaceAll("\n", "");
}

async function getNewsSummary(text) {
  return getLLMResponse({
    systemPrompt: `Summarize the news article, focus on the points that can help a trader make a decision. Dont include any opinions or biases. No additional text, just the summary.`,
    userPrompt: text,
    platform: "openai",
    model: "gpt-4o-mini",
  });
}

async function getNewsSummaryAndSentimentLabel(url) {
  return getCachedResult(
    url,
    async () => {
      const response = await fetch(url);
      const html = await response.text();

      // Parse HTML
      const dom = new JSDOM(html);
      const articleDiv = dom.window.document.querySelector("div.article");
      const articleText = articleDiv ? articleDiv.textContent.trim() : html;

      return {
        summary: await getNewsSummary(articleText),
        sentimentLabel: await getNewsSentiment(articleText),
      };
    },
    60 * 60 * 4 // 4 hours
  );
}

export async function getTopNews(news, fetchRecent = false) {
  news = (news || []).filter((item) => {
    const date = new Date(item.providerPublishTime);
    const now = new Date();
    const diff = now - date;
    if (fetchRecent) {
      return diff < 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    } else {
      return diff < 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    }
  });

  if (!news || news.length === 0) {
    return [];
  }

  news.sort(
    (a, b) => new Date(b.providerPublishTime) - new Date(a.providerPublishTime)
  );

  const top3News = Array.from(news).slice(0, 3);
  const timeDistance = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch (error) {
      return date;
    }
  };
  const newsData = await Promise.all(
    top3News.map(async (item) => {
      const newsDetails = await getNewsSummaryAndSentimentLabel(item.link);

      return {
        title: item.title,
        summary: newsDetails.summary,
        sentimentLabel: newsDetails.sentimentLabel,
        // publisher: item.publisher,
        date: new Date(item.providerPublishTime).toLocaleString(),
        timeAgo: timeDistance(item.providerPublishTime),
      };
    })
  );

  return {
    overallSentiment: await getNewsSentiment(
      newsData
        .map((item) => `${item.summary}\nWhen?: ${timeDistance(item.date)}`)
        .join("\n\n---\n\n")
    ),
    news: newsData,
  };
}
