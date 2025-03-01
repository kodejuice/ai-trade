import fetch from "node-fetch";


function getNewsTextSentiment(text) {
  // ...
}

async function getNewsSummaryAndSentimentLabel(url) {
  const response = await fetch(url);
  const data = await response.text();
}


export async function getTopNews(news) {
  if (!news || news.length === 0) {
    return [];
  }

  const top3News = news.slice(0, 3);
  const newsData = top3News.map((item) => {
    const newsDetails = getNewsSummaryAndSentimentLabel(item.link);

    return {
      title: item.title,
      summary: newsDetails.summary,
      sentimentLabel: newsDetails.sentimentLabel,
      publisher: item.publisher,
      date: new Date(item.providerPublishTime).toString(),
    };
  });

  return {
    overallSentiment: getNewsTextSentiment(newsData.map(item => item.summary).join("\n\n---\n\n")),
    news: newsData,
  }
}

