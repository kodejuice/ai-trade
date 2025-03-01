import yahooFinance from "yahoo-finance2";
import {
  formatCurrency,
  computePriceChangePercentage,
  getTradingDateNDaysAgo,
  formatNumber,
  formatPercentageValue,
} from "./util.js";

import {
  rsi,
  sma,
  macd,
  atr,
  ema,
  bollingerbands,
  vwap,
  adx,
  stochastic,
  cci,
  obv,
  mfi,
} from "technicalindicators";
import { getTopNews } from "./news-sentiment.js";


// ----------------------
// Main Function: Fetch and Aggregate Stock Data
// ----------------------

export async function getStockData(symbol) {
  // Fetch quote summary for fundamentals.
  // Using several modules to get a broad range of fundamental info.
  const modules = [
    "price",
    "summaryDetail",
    "financialData",
    "defaultKeyStatistics",
    "summaryProfile",
    "earningsHistory",
  ];
  const quoteSummary = await yahooFinance.quoteSummary(symbol, { modules });
  const quote = await yahooFinance.quote(symbol);
  const searchResult = await yahooFinance.search(symbol);
  const newsAndSentiment = await getTopNews(searchResult.news);

  console.log(news);

  // 2 months of daily data for price metrics.
  const _2monthAgo = getTradingDateNDaysAgo(60);
  const historicalDaily = await yahooFinance.chart(symbol, {
    period1: _2monthAgo,
    interval: "1d",
  });

  // For intraday (15min intervals)
  const _5daysAgo = getTradingDateNDaysAgo(5);
  const historical15min = await yahooFinance.chart(symbol, {
    period1: _5daysAgo,
    interval: "15m",
  });

  // For intraday (1min intervals)
  const _15minAgo = new Date();
  _15minAgo.setMinutes(_15minAgo.getMinutes() - 15);
  const historical1m = await yahooFinance.chart(symbol, {
    period1: _15minAgo,
    interval: "1m",
  });

  const historicalDailyData = Array.from(historicalDaily.quotes).filter(
    (x) => x.volume > 0
  );
  const historical15minData = Array.from(historical15min.quotes).filter(
    (x) => x.volume > 0
  );
  const historical1mData = Array.from(historical1m.quotes).filter(
    (x) => x.volume > 0
  );

  // const dailyCloseData = historicalDailyData.map((x) => x.close);
  // const _1mCloseData = historical1mData.map((x) => x.close);
  //
  const _15minLowData = historical15minData.map((x) => x.low);
  const _15minHighData = historical15minData.map((x) => x.high);
  const _15minCloseData = historical15minData.map((x) => x.close);
  const _15minVolumeData = historical15minData.map((x) => x.volume);

  // ----------------------
  // Price Metrics
  // ----------------------
  const currentPrice =
    historical15minData.length > 0 ? historical15minData[0].close : null;
  const priceMetrics = {
    currentPrice: formatCurrency(currentPrice),
    priceChange15min: computePriceChangePercentage(historical15minData, 1),
    priceChange30min: computePriceChangePercentage(historical15minData, 2),
    priceChange1hr: computePriceChangePercentage(historical15minData, 4),
    priceChange3hr: computePriceChangePercentage(historical15minData, 12),
    priceChange7hr: computePriceChangePercentage(historical15minData, 28),
    priceChange1day: computePriceChangePercentage(historicalDailyData, 1),
    priceChange3days: computePriceChangePercentage(historicalDailyData, 3),
    priceChange7days: computePriceChangePercentage(historicalDailyData, 7),
    priceChange30days: computePriceChangePercentage(historicalDailyData, 30),
  };

  // ----------------------
  // Volume Metrics
  // ----------------------
  // const currentVolume =
  //   historical15minData.length > 0 ? historical15minData[0].volume : null;
  const _15minData = historical1mData.slice(0, 15);

  const volumeMetrics = {
    "current volume (15 min)": _15minData.reduce(
      (sum, record) => sum + record.volume || 0,
      0
    ),
    "average volume (10 days)": quoteSummary.summaryDetail?.averageVolume10days,
    "regular market volume": quoteSummary.summaryDetail?.regularMarketVolume,
  };

  // ----------------------
  // Technical Indicators
  // ----------------------
  const technicalIndicatorsData = {
    movingAverage10hr: sma({ period: 40, values: _15minCloseData }).at(-1), // 15*40 = 600min = 10hrs
    movingAverage24hr: sma({ period: 96, values: _15minCloseData }).at(-1), // 15*96 = 1440min = 24hrs

    RSI: rsi({
      period: 14,
      values: _15minCloseData,
      reversedInput: false,
    }).at(-1),

    MACD: macd({
      values: _15minCloseData,
      signalPeriod: 9,
      slowPeriod: 26,
      fastPeriod: 12,
    }).at(-1),

    ATR1: atr({
      low: _15minLowData,
      high: _15minHighData,
      close: _15minCloseData,
      period: 14,
      reversedInput: false,
    }).at(-1),

    EMA10hr: ema({
      period: 40,
      values: _15minCloseData,
      reversedInput: false,
    }).at(-1),

    BBANDS: bollingerbands({
      period: 20,
      stdDev: 2,
      reversedInput: false,
      values: _15minCloseData,
    }).at(-1),

    VWAP: vwap({
      high: _15minHighData,
      low: _15minLowData,
      close: _15minCloseData,
      volume: _15minVolumeData,
      reversedInput: false,
    }).at(-1),

    ADX: adx({
      period: 14,
      close: _15minCloseData,
      high: _15minHighData,
      low: _15minLowData,
    }).at(-1),

    STOCH: stochastic({
      period: 14,
      high: _15minHighData,
      low: _15minLowData,
      close: _15minCloseData,
      signalPeriod: 3,
    }).at(-1),

    CCI: cci({
      period: 20,
      high: _15minHighData,
      low: _15minLowData,
      close: _15minCloseData,
    }).at(-1),

    OBV: obv({
      close: _15minCloseData,
      volume: _15minVolumeData,
    }).at(-1),

    MFI: mfi({
      period: 14,
      high: _15minHighData,
      low: _15minLowData,
      close: _15minCloseData,
      volume: _15minVolumeData,
    }).at(-1),
  };

  const technicalIndicators = {
    timeFrame: "15min (latest)",
    data: technicalIndicatorsData,
  };

  // ----------------------
  // Quote Summary (Fundamentals)
  // ----------------------
  const fundamentals = {
    // REGULAR
    // CLOSED
    // PRE
    // PREPRE
    // POST
    // POSTPOST
    marketState: quote.marketState,

    "Day's Range": `${
      formatCurrency(quoteSummary.price.regularMarketDayLow)} - ${formatCurrency(quoteSummary.price.regularMarketDayHigh)
    }`,

    "52 Week Range": `${
      formatCurrency(quoteSummary.summaryDetail?.fiftyTwoWeekLow)} - ${formatCurrency(quoteSummary.summaryDetail?.fiftyTwoWeekHigh)
    }`,
    
    "50Day Average": formatCurrency(quoteSummary.summaryDetail?.fiftyDayAverage),
    "200Day Average": formatCurrency(quoteSummary.summaryDetail?.twoHundredDayAverage),

    "TrailingPE": quoteSummary.summaryDetail?.trailingPE ? quoteSummary.summaryDetail?.trailingPE.toFixed(2) : undefined,
    "ForwardPE": quoteSummary.summaryDetail?.forwardPE ? quoteSummary.summaryDetail?.forwardPE.toFixed(2) : undefined,

    "Beta (5Y Monthly)": quoteSummary.summaryDetail?.beta.toFixed(2),

    marketCap: quoteSummary.price.marketCap
      ? formatCurrency(quoteSummary.price.marketCap)
      : undefined,

    "PE Ratio (TTM)": quoteSummary.summaryDetail?.trailingPE
      ? formatNumber(quoteSummary.summaryDetail?.trailingPE)
      : undefined,

    "EPS (TTM)": quote.epsTrailingTwelveMonths
      ? formatCurrency(quote.epsTrailingTwelveMonths)
      : undefined,

    DividendYield: quoteSummary.summaryDetail?.dividendYield
      ? formatPercentageValue(quoteSummary.summaryDetail?.dividendYield * 100)
      : undefined,

    "Revenue": quoteSummary.financialData?.totalRevenue
      ? formatCurrency(quoteSummary.financialData?.totalRevenue)
      : undefined,

    "Profit Margin": quoteSummary.financialData?.profitMargins
      ? formatPercentageValue(quoteSummary.financialData?.profitMargins)
      : undefined,

    DebtToEquity: quoteSummary.summaryDetail?.debtToEquity,
    "Return On Equity": formatPercentageValue(quoteSummary.financialData?.returnOnEquity),
    "Revenue Growth": formatPercentageValue(quoteSummary.financialData?.revenueGrowth),

    "Recommendation Mean": quoteSummary.financialData?.recommendationMean,
    "Recommendation Key": quoteSummary.financialData?.recommendationKey,
    "Number Of Analyst Opinions": quoteSummary.financialData?.numberOfAnalystOpinions,

    "Regular Market Change Percent": formatPercentageValue(quoteSummary.price.regularMarketChangePercent),
    "Regular Market Price": formatCurrency(quoteSummary.price.regularMarketPrice),

    "bid/ask": {
      bid: formatCurrency(quoteSummary.summaryDetail?.bid),
      ask: formatCurrency(quoteSummary.summaryDetail?.ask),
      "bid size": quoteSummary.summaryDetail?.bidSize,
      "ask size": quoteSummary.summaryDetail?.askSize,
    },

    tradeable: quoteSummary.summaryDetail?.tradeable,
  };

  return fundamentals;

  // ----------------------
  // Sentiment & Recent News (Placeholders)
  // ----------------------
  // Yahoo Finance may provide some news in the quote summary,
  // but for now we leave these as placeholders.
  const sentimentNews = {
    newsSentimentScore: null,
    sentimentLabel: null,
  };
  const recentNews = []; // Placeholder for recent news articles.

  // ----------------------
  // Economic Indicators (Placeholders)
  // ----------------------
  // These can be obtained from other free sources if needed.
  const economicIndicators = {
    treasuryYield: null,
    inflation: null,
    sectorPerformance: null,
  };

  // ----------------------˚
  // Final Aggregated Data Object
  // ----------------------
  return {
    priceMetrics,
    volumeMetrics,
    technicalIndicators,
    fundamentals,
    sentimentNews,
    recent_news: recentNews,
    economicIndicators,
  };
}

// ----------------------
// Example Usage
// ----------------------
getStockData("MSFT")
  .then((data) => console.log(JSON.stringify(data, null, 2)))
  .catch((error) => console.error("Error fetching stock data:", error));
