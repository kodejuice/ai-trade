import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import { formatDistanceToNow } from "date-fns";

import { LLMResponse } from "./llm/llm.js";
import { getCachedResult } from "./cache.js";

async function getNewsSentiment(text) {
  const sentiment = await LLMResponse({
    systemPrompt: `You are a sentiment analysis model. You analyze news articles and determine the sentiment of the article.`,
    userPrompt: `Given the following text, classify the sentiment as positive, negative, or neutral. Dont include any additional text, just the single sentiment label:
${text}
-----

Return a single sentiment label: "Bullish" or "Bearish" or "Neutral". No additional text, just a single sentiment label.
`,
  });
  return sentiment.replaceAll("\n", "");
}

async function getNewsSummary(text) {
  return LLMResponse({
    systemPrompt: `Summarize the news article, focus on the points that can help a trader make a decision. Dont include any opinions or biases. No additional text, just the summary.`,
    userPrompt: text,
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

export async function getTopNews(news) {
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
