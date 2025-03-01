import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import { formatDistanceToNow } from "date-fns";

import { LLMResponse } from "./llm.js";

async function getNewsSentiment(text) {
  return LLMResponse({
    systemPrompt: `Given the following text, classify the sentiment as positive (bullish), negative (bearish), or neutral. Dont include any additional text, just the sentiment label.`,
    userPrompt: text,
  });
}

async function getNewsSummary(text) {
  return LLMResponse({
    systemPrompt: `Summarize the news article, focus on the points that can help a trader make a decision. Dont include any opinions or biases. No additional text, just the summary.`,
    userPrompt: text,
  });
}

async function getNewsSummaryAndSentimentLabel(url) {
  const response = await fetch(url);
  const html = await response.text();

  // Parse HTML
  const dom = new JSDOM(html);
  const articleDiv = dom.window.document.querySelector("div.article");
  const articleText = articleDiv ? articleDiv.textContent.trim() : html;

  const r = {
    summary: await getNewsSummary(articleText),
    sentimentLabel: await getNewsSentiment(articleText),
  };
  return r;
}

export async function getTopNews(news) {
  if (!news || news.length === 0) {
    return [];
  }

  news.sort(
    (a, b) => new Date(b.providerPublishTime) - new Date(a.providerPublishTime)
  );

  const top3News = Array.from(news).slice(0, 3);
  const newsData = await Promise.all(
    top3News.map(async (item) => {
      const newsDetails = await getNewsSummaryAndSentimentLabel(item.link);

      return {
        title: item.title,
        summary: newsDetails.summary,
        sentimentLabel: newsDetails.sentimentLabel,
        // publisher: item.publisher,
        date: new Date(item.providerPublishTime).toString(),
        timeAgo: formatDistanceToNow(new Date(item.providerPublishTime), {
          addSuffix: true,
        }),
      };
    })
  );

  return {
    overallSentiment: await getNewsSentiment(
      newsData.map((item) => item.summary).join("\n\n---\n\n")
    ),
    news: newsData,
  };
}
