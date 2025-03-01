import fetch from "node-fetch";

// const API_KEY = "HX04KDMNWIOG322B";
const API_KEY = "SR3A82CLU0C9PHN1";
const BASE_URL = "https://www.alphavantage.co/query";

/**
 * Helper: Build URL with query parameters and fetch JSON data.
 */
async function fetchAlphaData(params) {
  const url = new URL(BASE_URL);
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key])
  );
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    const r = await response.json();
    // console.log(url, r);
    // console.log(url, r);
    return r;
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
}

/**
 * Formatting helper functions
 */
function formatCurrency(value) {
  if (value == null) return null;
  // Converts to number and formats with commas and 2 decimals
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  if (value == null) return null;
  return Number(value).toFixed(2);
}

function formatPercentageValue(value) {
  if (value == null) return null;
  return `${Number(value).toFixed(2)}%`;
}

function formatPercent(value) {
  return value != null ? `${value.toFixed(2)}%` : null;
}

/**
 * API wrapper functions for technical & sentiment endpoints.
 */
async function fetchIntraday(
  symbol,
  interval = "15min",
  outputsize = "compact"
) {
  return fetchAlphaData({
    function: "TIME_SERIES_INTRADAY",
    symbol,
    interval,
    outputsize,
    apikey: API_KEY,
  });
}

async function fetchDaily(symbol, outputsize = "compact") {
  return fetchAlphaData({
    function: "TIME_SERIES_DAILY",
    symbol,
    outputsize,
    apikey: API_KEY,
  });
}

async function fetchSMA(symbol, interval, timePeriod, seriesType = "close") {
  return fetchAlphaData({
    function: "SMA",
    symbol,
    interval,
    time_period: timePeriod,
    series_type: seriesType,
    apikey: API_KEY,
  });
}

async function fetchVWAP(symbol, interval) {
  return fetchAlphaData({
    function: "VWAP",
    symbol,
    interval,
    apikey: API_KEY,
  });
}

async function fetchEMA(symbol, interval, timePeriod, seriesType = "close") {
  return fetchAlphaData({
    function: "EMA",
    symbol,
    interval,
    time_period: timePeriod,
    series_type: seriesType,
    apikey: API_KEY,
  });
}

async function fetchRSI(symbol, interval, timePeriod, seriesType = "close") {
  return fetchAlphaData({
    function: "RSI",
    symbol,
    interval,
    time_period: timePeriod,
    series_type: seriesType,
    apikey: API_KEY,
  });
}

async function fetchMACD(symbol, interval, seriesType = "close") {
  return fetchAlphaData({
    function: "MACD",
    symbol,
    interval,
    series_type: seriesType,
    apikey: API_KEY,
  });
}

async function fetchATR(symbol, interval, timePeriod) {
  return fetchAlphaData({
    function: "ATR",
    symbol,
    interval,
    time_period: timePeriod,
    apikey: API_KEY,
  });
}

async function fetchBBANDS(
  symbol,
  interval,
  timePeriod,
  nbdevup = 2,
  nbdevdn = 2,
  seriesType = "close"
) {
  return fetchAlphaData({
    function: "BBANDS",
    symbol,
    interval,
    time_period: timePeriod,
    series_type: seriesType,
    nbdevup,
    nbdevdn,
    apikey: API_KEY,
  });
}

async function fetchADX(symbol, interval, timePeriod = 14) {
  return fetchAlphaData({
    function: "ADX",
    symbol,
    interval,
    time_period: timePeriod,
    apikey: API_KEY,
  });
}

async function fetchSTOCH(
  symbol,
  interval,
  fastkperiod = 14,
  slowkperiod = 3,
  slowdperiod = 3,
  slowdmatype = 0
) {
  return fetchAlphaData({
    function: "STOCH",
    symbol,
    interval,
    fastkperiod,
    slowkperiod,
    slowdperiod,
    slowdmatype,
    apikey: API_KEY,
  });
}

async function fetchCCI(symbol, interval, timePeriod, seriesType = "close") {
  return fetchAlphaData({
    function: "CCI",
    symbol,
    interval,
    time_period: timePeriod,
    series_type: seriesType,
    apikey: API_KEY,
  });
}

async function fetchOBV(symbol, interval) {
  return fetchAlphaData({
    function: "OBV",
    symbol,
    interval,
    apikey: API_KEY,
  });
}

async function fetchMFI(symbol, interval, timePeriod) {
  return fetchAlphaData({
    function: "MFI",
    symbol,
    interval,
    time_period: timePeriod,
    apikey: API_KEY,
  });
}

async function fetchOverview(symbol) {
  return fetchAlphaData({
    function: "OVERVIEW",
    symbol,
    apikey: API_KEY,
  });
}

async function fetchNewsSentiment(symbol) {
  return fetchAlphaData({
    function: "NEWS_SENTIMENT",
    tickers: symbol,
    apikey: API_KEY,
  });
}

/**
 * Additional macroeconomic/fundamental endpoints:
 */
// Fetch Treasury Yield data (e.g., 10-year yield)
async function fetchTreasuryYield(interval = "monthly", maturity = "10year") {
  return fetchAlphaData({
    function: "TREASURY_YIELD",
    interval,
    maturity,
    apikey: API_KEY,
  });
}

// Fetch Inflation data
async function fetchInflation() {
  return fetchAlphaData({
    function: "INFLATION",
    apikey: API_KEY,
  });
}

// Fetch Sector Performance data
async function fetchSectorPerformance() {
  return fetchAlphaData({
    function: "SECTOR",
    apikey: API_KEY,
  });
}

/**
 * Helper: Compute percentage change between the latest value and the value 'periods' ago.
 */
function computePriceChange(timeSeries, periods) {
  const sortedTimestamps = Object.keys(timeSeries).sort(
    (a, b) => new Date(b) - new Date(a)
  );
  if (sortedTimestamps.length < periods + 1) return null;
  const current = parseFloat(timeSeries[sortedTimestamps[0]]["4. close"]);
  const past = parseFloat(timeSeries[sortedTimestamps[periods]]["4. close"]);
  return ((current - past) / past) * 100;
}

/**
 * Helper: Compute the average volume over the last N days.
 */
function computeAverageVolume(dailySeries, numDays = 10) {
  const sortedDates = Object.keys(dailySeries).sort(
    (a, b) => new Date(b) - new Date(a)
  );
  const volumes = sortedDates
    .slice(0, numDays)
    .map((date) => parseInt(dailySeries[date]["5. volume"], 10));
  const avg = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  return Math.round(avg);
}

/**
 * Generic helper: Extract the latest value from a technical indicator response.
 */
function extractLatestIndicator(data, key) {
  const series = data && data[`Technical Analysis: ${key}`];
  if (!series) return null;
  const latestTimestamp = Object.keys(series).sort(
    (a, b) => new Date(b) - new Date(a)
  )[0];
  return parseFloat(series[latestTimestamp][key]);
}

/**
 * Helper: Extract Bollinger Bands values from the latest timestamp.
 */
function extractLatestBBANDS(data) {
  const series = data && data["Technical Analysis: BBANDS"];
  if (!series) return null;
  const latestTimestamp = Object.keys(series).sort(
    (a, b) => new Date(b) - new Date(a)
  )[0];
  const bands = series[latestTimestamp];
  return {
    upperBand: parseFloat(bands["Real Upper Band"]),
    middleBand: parseFloat(bands["Real Middle Band"]),
    lowerBand: parseFloat(bands["Real Lower Band"]),
  };
}

/**
 * Helper: Extract Stochastic Oscillator values from the latest timestamp.
 */
function extractLatestSTOCH(data) {
  const series = data && data["Technical Analysis: STOCH"];
  if (!series) return null;
  const latestTimestamp = Object.keys(series).sort(
    (a, b) => new Date(b) - new Date(a)
  )[0];
  const stochData = series[latestTimestamp];
  return {
    slowK: parseFloat(stochData["SlowK"]),
    slowD: parseFloat(stochData["SlowD"]),
  };
}

/**
 * Main function: Fetch and aggregate all stock data and additional indicators.
 */
export async function getStockData(symbol) {
  // Fetch data concurrently from multiple endpoints
  const [
    intradayData,
    dailyData,
    sma10hr,
    sma24hr,
    rsiData,
    vwapData,
    macdData,
    atrData,
    overviewData,
    newsData,
    ema10hr,
    ema24hr,
    ema7days,
    bbandsData,
    adxData,
    stochData,
    cciData,
    obvData,
    mfiData,
    treasuryYieldData,
    inflationData,
    sectorPerformanceData,
  ] = await Promise.all([
    fetchIntraday(symbol, "15min", "compact"),
    fetchDaily(symbol, "compact"),
    fetchSMA(symbol, "15min", 40),
    fetchSMA(symbol, "15min", 96),
    fetchRSI(symbol, "15min", 14),
    fetchVWAP(symbol, "15min"),
    fetchMACD(symbol, "15min"),
    fetchATR(symbol, "15min", 14),
    fetchOverview(symbol),
    fetchNewsSentiment(symbol),
    fetchEMA(symbol, "15min", 40),
    fetchEMA(symbol, "15min", 96),
    fetchEMA(symbol, "15min", 96 * 7),
    fetchBBANDS(symbol, "15min", 20, 2, 2),
    fetchADX(symbol, "15min", 14),
    fetchSTOCH(symbol, "15min", 14, 3, 3, 0),
    fetchCCI(symbol, "15min", 20),
    fetchOBV(symbol, "15min"),
    fetchMFI(symbol, "15min", 14),
    fetchTreasuryYield("monthly", "10year"),
    fetchInflation(),
    fetchSectorPerformance(),
  ]);

  const intradaySeries = intradayData && intradayData["Time Series (15min)"];
  const dailySeries = dailyData && dailyData["Time Series (Daily)"];

  // Price Metrics (formatted for human friendliness)
  const sortedIntraday = intradaySeries
    ? Object.keys(intradaySeries).sort((a, b) => new Date(b) - new Date(a))
    : [];
  const currentIntraday = sortedIntraday[0]
    ? intradaySeries[sortedIntraday[0]]
    : null;

  const priceMetrics = {
    currentPrice: currentIntraday
      ? `$${parseFloat(currentIntraday["4. close"]).toFixed(2)}`
      : null,
    priceChange15min: intradaySeries
      ? formatPercent(computePriceChange(intradaySeries, 1))
      : null,
    priceChange30min: intradaySeries
      ? formatPercent(computePriceChange(intradaySeries, 2))
      : null,
    priceChange1hr: intradaySeries
      ? formatPercent(computePriceChange(intradaySeries, 4))
      : null,
    priceChange3hr: intradaySeries
      ? formatPercent(computePriceChange(intradaySeries, 12))
      : null, // 3hrs = 12 intervals (15min each)
    priceChange7hr: intradaySeries
      ? formatPercent(computePriceChange(intradaySeries, 28))
      : null, // 7hrs = 28 intervals
    priceChange1day: dailySeries
      ? formatPercent(computePriceChange(dailySeries, 1))
      : null,
    priceChange3days: dailySeries
      ? formatPercent(computePriceChange(dailySeries, 3))
      : null,
    priceChange7days: dailySeries
      ? formatPercent(computePriceChange(dailySeries, 7))
      : null,
    priceChange30days: dailySeries
      ? formatPercent(computePriceChange(dailySeries, 30))
      : null,
  };

  // Volume Metrics
  const volumeMetrics = {
    currentVolume: {
      period: "15min",
      volume: currentIntraday
        ? parseInt(currentIntraday["5. volume"], 10)
        : null,
    },
    averageVolume: {
      period: "10 days",
      volume: dailySeries ? computeAverageVolume(dailySeries, 10) : null,
    },
  };

  // Technical Indicators (wrap with timeframe info)
  const technicalIndicatorsData = {
    movingAverage10hr: sma10hr ? extractLatestIndicator(sma10hr, "SMA") : null,
    movingAverage24hr: sma24hr ? extractLatestIndicator(sma24hr, "SMA") : null,
    RSI: rsiData ? extractLatestIndicator(rsiData, "RSI") : null,
    VWAP: vwapData ? extractLatestIndicator(vwapData, "VWAP") : null,
    MACD: macdData ? extractLatestIndicator(macdData, "MACD") : null,
    ATR: atrData ? extractLatestIndicator(atrData, "ATR") : null,
    EMA10hr: ema10hr ? extractLatestIndicator(ema10hr, "EMA") : null,
    EMA24hr: ema24hr ? extractLatestIndicator(ema24hr, "EMA") : null,
    EMA7days: ema7days ? extractLatestIndicator(ema7days, "EMA") : null,
    BBANDS: bbandsData ? extractLatestBBANDS(bbandsData) : null,
    ADX: adxData ? extractLatestIndicator(adxData, "ADX") : null,
    STOCH: stochData ? extractLatestSTOCH(stochData) : null,
    CCI: cciData ? extractLatestIndicator(cciData, "CCI") : null,
    OBV: obvData ? extractLatestIndicator(obvData, "OBV") : null,
    MFI: mfiData ? extractLatestIndicator(mfiData, "MFI") : null,
  };
  const technicalIndicators = {
    timeFrame: "15min (latest)",
    data: technicalIndicatorsData,
  };

  // Volatility & Risk (using beta from fundamentals)
  const volatilityRisk = {
    beta: overviewData ? parseFloat(overviewData["Beta"]) : null,
    // historicalVolatility: null, // Not directly provided by Alpha Vantage
  };

  // Fundamental data (formatted)
  const fundamentals = overviewData
    ? {
        marketCap: formatCurrency(overviewData.MarketCapitalization),
        PERatio: overviewData.PERatio
          ? formatNumber(overviewData.PERatio)
          : null,
        EPS: overviewData.EPS ? formatCurrency(overviewData.EPS) : null,
        DividendYield: overviewData.DividendYield
          ? formatPercentageValue(overviewData.DividendYield)
          : null,
        RevenueTTM: overviewData.RevenueTTM
          ? formatCurrency(overviewData.RevenueTTM)
          : null,
        ProfitMargin: overviewData.ProfitMargin
          ? formatPercentageValue(overviewData.ProfitMargin)
          : null,
        DebtToEquity: overviewData.DebtToEquity
          ? formatNumber(overviewData.DebtToEquity)
          : null,
        ReturnOnEquityTTM: overviewData.ReturnOnEquityTTM
          ? formatPercentageValue(overviewData.ReturnOnEquityTTM)
          : null,
        AnalystTargetPrice: overviewData["AnalystTargetPrice"] ?? null,
        AnalystRatingStrongBuy: overviewData["AnalystRatingStrongBuy"] ?? null,
        AnalystRatingBuy: overviewData["AnalystRatingBuy"] ?? null,
        AnalystRatingHold: overviewData["AnalystRatingHold"] ?? null,
        AnalystRatingSell: overviewData["AnalystRatingSell"] ?? null,
        AnalystRatingStrongSell:
          overviewData["AnalystRatingStrongSell"] ?? null,
        TrailingPE: overviewData["TrailingPE"] ?? null,
        ForwardPE: overviewData["ForwardPE"] ?? null,
        QuarterlyEarningsGrowthYOY:
          overviewData["QuarterlyEarningsGrowthYOY"] ?? null,
        "52WeekHigh": overviewData["52WeekHigh"] ?? null,
        "52WeekLow": overviewData["52WeekLow"] ?? null,
        "50DayMovingAverage": overviewData["50DayMovingAverage"] ?? null,
        "200DayMovingAverage": overviewData["200DayMovingAverage"] ?? null,
      }
    : null;

  // Sentiment & News
  let newsSentimentScore = null,
    sentimentLabel = "Neutral",
    newsVolume3hr = 0,
    newsVolume1day = 0;
  if (newsData && newsData.feed && Array.isArray(newsData.feed)) {
    let totalSentiment = 0;
    newsData.feed.forEach((article) => {
      totalSentiment += article.overall_sentiment_score;
      const publishedAt = new Date(article.time_published);
      const hoursAgo = (new Date() - publishedAt) / (1000 * 60 * 60);
      if (hoursAgo <= 3) newsVolume3hr++;
      if (hoursAgo <= 24) newsVolume1day++;
    });
    newsSentimentScore = newsData.feed.length
      ? Number((totalSentiment / newsData.feed.length).toFixed(2))
      : null;
    // Add sentiment label based on score ranges
    if (newsSentimentScore) {
      if (newsSentimentScore <= -0.35) sentimentLabel = "Bearish";
      else if (newsSentimentScore <= -0.15) sentimentLabel = "Somewhat-Bearish";
      else if (newsSentimentScore < 0.15) sentimentLabel = "Neutral";
      else if (newsSentimentScore < 0.35) sentimentLabel = "Somewhat-Bullish";
      else sentimentLabel = "Bullish";
    }
  }

  const sentimentNews = {
    newsSentimentScore,
    sentimentLabel,
    newsVolume3hr,
    newsVolume1day,
    socialMediaSentiment: null, // Not available from Alpha Vantage
  };

  // Extract recent 3 news articles (if available)
  const recentNews =
    newsData && newsData.feed && Array.isArray(newsData.feed)
      ? newsData.feed.slice(0, 3).map((article) => {
          let sentiment_label;
          const score = article.overall_sentiment_score;

          if (score <= -0.35) sentiment_label = "Bearish";
          else if (score <= -0.15) sentiment_label = "Somewhat-Bearish";
          else if (score < 0.15) sentiment_label = "Neutral";
          else if (score < 0.35) sentiment_label = "Somewhat-Bullish";
          else sentiment_label = "Bullish";

          return {
            title: article.title || "No Title",
            summary: article.summary || "No Summary",
            time_published: article.time_published,
            sentiment_label,
          };
        })
      : [];

  // Economic Indicators extracted from additional endpoints
  const economicIndicators = {
    treasuryYield: treasuryYieldData
      ? extractLatestTreasuryYield(treasuryYieldData)
      : null,
    inflation: inflationData ? extractLatestInflation(inflationData) : null,
    sectorPerformance: sectorPerformanceData || null,
  };

  // Liquidity & Events (not provided by Alpha Vantage)
  const liquidity = {
    bidAskSpread: null,
    marketDepth: null,
  };
  const eventsContext = {
    corporateEvents: null,
    sectorTrend: null,
  };

  return {
    priceMetrics,
    volumeMetrics,
    technicalIndicators,
    volatilityRisk,
    fundamentals,
    sentimentNews,
    // liquidity,
    // eventsContext,
    recent_news: recentNews,
    economicIndicators,
  };
}

/**
 * Helper: Extract latest Treasury Yield (assumes data.data is an array of yield objects)
 */
function extractLatestTreasuryYield(data) {
  if (!data || !data.data) return null;
  const sorted = data.data.sort((a, b) => new Date(b.date) - new Date(a.date));
  return {
    name: data.name,
    interval: data.interval,
    latest: sorted[0] ? `${sorted[0]["value"]}%` : null,
  };
}

/**
 * Helper: Extract latest Inflation (assumes data.data is an array of inflation objects)
 */
function extractLatestInflation(data) {
  if (!data || !data.data) return null;
  const sorted = data.data.sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted[0] ? `${sorted[0]["value"]}%` : null;
}

// Example usage: fetch data for TSLA and log the human-friendly aggregated result.
getStockData("META")
  .then((data) => console.log("Stock Data:", JSON.stringify(data, null, 2)))
  .catch((error) => console.error("Error fetching stock data:", error));


