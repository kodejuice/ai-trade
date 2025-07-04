import yahooFinance from "yahoo-finance2";
import {
  formatCurrency,
  computePriceChangePercentage,
  getTradingDateNDaysAgo,
  formatNumber,
  formatPercentageValue,
  roundObjectValues,
} from "../helpers/util.js";

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
import { getTopNews } from "../helpers/news-sentiment.js";
// import { calculateScalpScore } from "./scalp-score.js";
// import { calculateSwingScore } from "./swing-score.js";

yahooFinance.suppressNotices(["yahooSurvey"]);

/**
 * Fetches and returns fundamental data for the given ticker symbol.
 * The function retrieves various financial metrics, market pricing information,
 * and analyst data from the Yahoo Finance API.
 */
export async function getFundamentals(symbol) {
  try {
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

    const fundamentals = {
      symbol,

      marketStatus: {
        state: quote.marketState?.toLowerCase(), // "prepre", "pre", "post", "postpost", "regular", "closed"
      },

      priceRanges: {
        "Day's Range": `${formatCurrency(
          quoteSummary.price.regularMarketDayLow
        )} - ${formatCurrency(quoteSummary.price.regularMarketDayHigh)}`,
        "52 Week Range": `${formatCurrency(
          quoteSummary.summaryDetail?.fiftyTwoWeekLow
        )} - ${formatCurrency(quoteSummary.summaryDetail?.fiftyTwoWeekHigh)}`,
        "50Day Average": formatCurrency(
          quoteSummary.summaryDetail?.fiftyDayAverage
        ),
        "200Day Average": formatCurrency(
          quoteSummary.summaryDetail?.twoHundredDayAverage
        ),
      },

      valuation: {
        TrailingPE: quoteSummary.summaryDetail?.trailingPE?.toFixed(2),
        ForwardPE: quoteSummary.summaryDetail?.forwardPE?.toFixed(2),
        "PE Ratio (TTM)": quoteSummary.summaryDetail?.trailingPE
          ? formatNumber(quoteSummary.summaryDetail?.trailingPE)
          : undefined,
        "Beta (5Y Monthly)": quoteSummary.summaryDetail?.beta
          ? quoteSummary.summaryDetail?.beta?.toFixed(2)
          : null,
        marketCap: quoteSummary.price.marketCap
          ? formatCurrency(quoteSummary.price.marketCap)
          : undefined,
      },

      financials: {
        "EPS (TTM)": quote.epsTrailingTwelveMonths
          ? formatCurrency(quote.epsTrailingTwelveMonths)
          : undefined,
        Revenue: quoteSummary.financialData?.totalRevenue
          ? formatCurrency(quoteSummary.financialData?.totalRevenue)
          : undefined,
        "Profit Margin": quoteSummary.financialData?.profitMargins
          ? formatPercentageValue(quoteSummary.financialData?.profitMargins)
          : undefined,
        DebtToEquity: quoteSummary.summaryDetail?.debtToEquity,
        "Return On Equity": formatPercentageValue(
          quoteSummary.financialData?.returnOnEquity
        ),
        "Revenue Growth": formatPercentageValue(
          quoteSummary.financialData?.revenueGrowth
        ),
        DividendYield: quoteSummary.summaryDetail?.dividendYield
          ? formatPercentageValue(
              quoteSummary.summaryDetail?.dividendYield * 100
            )
          : undefined,
      },

      // analystData: {
      //   "Recommendation Mean": quoteSummary.financialData?.recommendationMean,
      //   "Recommendation Key": quoteSummary.financialData?.recommendationKey,
      //   "Number Of Analyst Opinions":
      //     quoteSummary.financialData?.numberOfAnalystOpinions,
      // },

      marketPricing: {
        "Regular Market Change Percent": formatPercentageValue(
          quoteSummary.price.regularMarketChangePercent
        ),
        "Regular Market Price": formatCurrency(
          quoteSummary.price.regularMarketPrice
        ),
        "bid/ask": {
          bid: formatCurrency(quoteSummary.summaryDetail?.bid),
          ask: formatCurrency(quoteSummary.summaryDetail?.ask),
          "bid size": quoteSummary.summaryDetail?.bidSize,
          "ask size": quoteSummary.summaryDetail?.askSize,
        },
      },
    };

    return { quoteSummary, quote, fundamentals };
  } catch (error) {
    return {
      error: "Error fetching fundamental data",
    };
  }
}

/**
 * Calculates various price metrics for a ticker based on historical price data.
 * including the current price, price changes over different time periods
 */
export function getPriceMetrics({
  historical1m,
  historical5m,
  historical15min,
  historicalDaily,
}) {
  const currentPrice =
    historical5m.quotes.length > 0 ? historical5m.quotes.at(-1).close : null;
  const priceMetrics = {
    currentPrice: formatCurrency(currentPrice),
    priceChange5min: computePriceChangePercentage(historical5m.quotes, 1),
    priceChange15min: computePriceChangePercentage(historical15min.quotes, 1),
    priceChange30min: computePriceChangePercentage(historical15min.quotes, 2),
    priceChange1hr: computePriceChangePercentage(historical15min.quotes, 4),
    priceChange3hr: computePriceChangePercentage(historical15min.quotes, 12),
    priceChange7hr: computePriceChangePercentage(historical15min.quotes, 28),
    priceChange1day: computePriceChangePercentage(historicalDaily.quotes, 1),
    priceChange3days: computePriceChangePercentage(historicalDaily.quotes, 3),
    priceChange7days: computePriceChangePercentage(historicalDaily.quotes, 7),
    priceChange30days: computePriceChangePercentage(historicalDaily.quotes, 30),
  };
  // if (!priceMetrics.currentPrice) {
  //   console.log("No current price found for", symbol, " => ", currentPrice);
  // }
  return priceMetrics;
}

export function getVolumeMetrics({ historical1mData, quoteSummary }) {
  const _15minData = historical1mData.slice(-15);
  const _15minVolume = formatNumber(
    _15minData.reduce((s, record) => s + record.volume || 0, 0)
  );
  const _30minData = historical1mData.slice(-30);
  const _30minVolume = formatNumber(
    _30minData.reduce((s, record) => s + record.volume || 0, 0)
  );
  const isVolumeEmpty =
    (quoteSummary.summaryDetail?.regularMarketVolume || 0) === 0 &&
    (quoteSummary.summaryDetail?.averageVolume10days || 0) === 0;
  return isVolumeEmpty
    ? {}
    : {
        // "current volume (15 min)": _15minVolume,
        "current volume (30 min)": _30minVolume,
        "average volume (10 days)": formatNumber(
          quoteSummary.summaryDetail?.averageVolume10days
        ),
        "regular market volume": formatNumber(
          quoteSummary.summaryDetail?.regularMarketVolume
        ),
      };
}

/**
 * Fetches historical ticker data for the given symbol at different time intervals.
 * Returns an object containing the historical data for daily, 15-minute, 5-minute, and 1-minute intervals.
 */
export async function getHistoricalData(symbol) {
  // 2 months of daily data for price metrics.
  const _2monthAgo = getTradingDateNDaysAgo(62);
  const historicalDaily = await yahooFinance.chart(symbol, {
    period1: _2monthAgo,
    interval: "1d",
    includePrePost: true,
  });

  // For intraday (4hr intervals) 
  const _5daysAgo = getTradingDateNDaysAgo(5);
  const historical1hr = await yahooFinance.chart(symbol, {
    period1: _5daysAgo, 
    interval: "60m",
    includePrePost: true
  });

  // For intraday (30min intervals)
  const historical30min = await yahooFinance.chart(symbol, {
    period1: _5daysAgo,
    interval: "30m",
    includePrePost: true,
  });

  // For intraday (15min intervals)
  const historical15min = await yahooFinance.chart(symbol, {
    period1: _5daysAgo,
    interval: "15m",
    includePrePost: true,
  });

  // For intraday (1min intervals)
  const _1hrAgo = new Date();
  _1hrAgo.setMinutes(_1hrAgo.getMinutes() - 60);
  const historical1m = await yahooFinance.chart(symbol, {
    period1: _1hrAgo,
    interval: "1m",
    includePrePost: true,
  });

  // For intraday (5min intervals)
  const _2daysAgo = getTradingDateNDaysAgo(2);
  const historical5m = await yahooFinance.chart(symbol, {
    period1: _2daysAgo,
    interval: "5m",
    includePrePost: true,
  });

  return {
    historical1m,
    historical5m,
    historical15min,
    historical30min,
    historical1hr,
    historicalDaily,
  };
}

/**
 * Calculates various technical indicators based on the provided historical ticker data.
 */
export function getTechnicalIndicators({ historicalData }) {
  if (!historicalData || historicalData.every((x) => !x)) {
    return {};
  }

  var historicalCloseData = historicalData.map((data) => data.close);
  var historicalHighData = historicalData.map((data) => data.high);
  var historicalLowData = historicalData.map((data) => data.low);
  var historicalVolumeData = historicalData.map((data) => data.volume);

  const movingAverage10hr = sma({ period: 40, values: historicalCloseData }); // assuming 15min interval, 15*40 = 600min = 10hrs
  const movingAverage24hr = sma({ period: 96, values: historicalCloseData }); // assuming 15min interval, 15*96 = 1440min = 24hrs

  const RSI = rsi({
    period: 14,
    values: historicalCloseData,
    reversedInput: false,
  });
  const MACD = macd({
    values: historicalCloseData,
    signalPeriod: 9,
    slowPeriod: 26,
    fastPeriod: 12,
  });
  const ATR = atr({
    low: historicalLowData,
    high: historicalHighData,
    close: historicalCloseData,
    period: 14,
    reversedInput: false,
  });
  const EMA5 = ema({
    period: 5,
    values: historicalCloseData,
  });
  const EMA9 = ema({
    period: 9,
    values: historicalCloseData,
  });
  const EMA20 = ema({
    period: 20,
    values: historicalCloseData,
  });
  const EMA50 = ema({
    period: 50,
    values: historicalCloseData,
  });
  const EMA200 = ema({
    period: 200,
    values: historicalCloseData,
  });
  const SMA50 = sma({
    period: 50,
    values: historicalCloseData,
  });
  const SMA200 = ema({
    period: 200,
    values: historicalCloseData,
  });
  const EMA10hr = ema({
    period: 40, // assuming 15min interval, 15*40 = 600min = 10hrs
    values: historicalCloseData,
  });
  const BBANDS = bollingerbands({
    period: 20,
    stdDev: 2,
    reversedInput: false,
    values: historicalCloseData,
  });
  const STOCH = stochastic({
    period: 14,
    high: historicalHighData,
    low: historicalLowData,
    close: historicalCloseData,
    signalPeriod: 3,
  });
  const VWAP = vwap({
    high: historicalHighData,
    low: historicalLowData,
    close: historicalCloseData,
    volume: historicalVolumeData,
    reversedInput: false,
  });
  const OBV = obv({
    close: historicalCloseData,
    volume: historicalVolumeData,
    reversedInput: false,
  });
  const CCI = cci({
    period: 20,
    high: historicalHighData,
    low: historicalLowData,
    close: historicalCloseData,
  });
  const MFI = mfi({
    period: 14,
    high: historicalHighData,
    low: historicalLowData,
    close: historicalCloseData,
    volume: historicalVolumeData,
  });
  const ADX = adx({
    period: 14,
    close: historicalCloseData,
    high: historicalHighData,
    low: historicalLowData,
  });

  const values = {
    RSI,
    MACD,
    ATR,
    EMA5,
    EMA9,
    EMA20,
    EMA50,
    EMA200,
    SMA50,
    SMA200,
    EMA10hr,
    BBANDS,
    STOCH,
    VWAP,
    CCI,
    MFI,
    OBV,
    ADX,
    movingAverage10hr,
    movingAverage24hr,
  };

  const fullLength = historicalData.length;
  for (var key in values) {
    values[key] = roundObjectValues(values[key], 2);
    if (["OBV", "VWAP"].includes(key)) {
      values[key] = values[key].map((x) => formatNumber(x));
    }

    // pad
    if (values[key].length < fullLength) {
      values[key] = Array(fullLength - values[key].length)
        .fill(undefined)
        .concat(values[key]);
    }
  }

  return values;
}

// ----------------------
// Fetch and Aggregate Ticker Data (Preview)
// We'll use this for sorting tickers
// ----------------------
export async function getTickerPreview(symbol) {
  console.log("getTickerPreview", symbol);

  try {
    const { quoteSummary, fundamentals } = await getFundamentals(symbol);
    const searchResult = await yahooFinance.search(symbol);
    const newsWithSentiment = await getTopNews(searchResult.news);

    const { historical1m, historical5m, historical15min, historicalDaily } =
      await getHistoricalData(symbol);

    const historical15minData = Array.from(historical15min.quotes).filter((x) =>
      symbol.toLowerCase().includes("=x")
        ? true /* forex quotes dont have volume */
        : x.volume > 0
    );
    const historical1mData = Array.from(historical1m.quotes).filter((x) =>
      symbol.toLowerCase().includes("=x")
        ? true /* forex quotes dont have volume */
        : x.volume > 0
    );

    // ----------------------
    // Price Metrics
    // ----------------------
    const priceMetrics = getPriceMetrics({
      historical1m,
      historical5m,
      historical15min,
      historicalDaily,
    });

    // ----------------------
    // Volume Metrics
    // ----------------------
    const volumeMetrics = getVolumeMetrics({
      historical1mData,
      quoteSummary,
    });

    // ----------------------
    // Technical Indicators
    // ----------------------
    var technicals = getTechnicalIndicators({
      historicalData: historical15minData,
    });
    const technicalIndicatorsData = !technicals.movingAverage10hr
      ? {}
      : {
          movingAverage10hr: technicals.movingAverage10hr.at(-1),
          movingAverage24hr: technicals.movingAverage24hr.at(-1),
          RSI: technicals.RSI.at(-1),
          MACD: technicals.MACD.at(-1),
          ATR: technicals.ATR.at(-1),
          EMA10hr: technicals.EMA10hr.at(-1),
          BBANDS: technicals.BBANDS.at(-1),
          VWAP: technicals.VWAP.at(-1),
          ADX: technicals.ADX.at(-1),
          STOCH: technicals.STOCH.at(-1),
          CCI: technicals.CCI.at(-1),
          OBV: technicals.OBV.at(-1),
          MFI: technicals.MFI.at(-1),
          EMA5: technicals.EMA5.at(-1),
          EMA9: technicals.EMA9.at(-1),
          EMA20: technicals.EMA20.at(-1),
          EMA50: technicals.EMA50.at(-1),
          EMA200: technicals.EMA200.at(-1),
          SMA50: technicals.SMA50.at(-1),
          SMA200: technicals.SMA200.at(-1),
        };

    const technicalIndicators = {
      timeFrame: "15min (latest)",
      data: technicalIndicatorsData,
    };

    // ----------------------
    // Sentiment & Recent News
    // ----------------------
    const recentNews = newsWithSentiment;

    // ----------------------˚
    // Final Aggregated Data Object
    // ----------------------
    return {
      priceMetrics,
      volumeMetrics,
      technicalIndicators,
      fundamentals,
      recent_news: recentNews,
    };
  } catch (error) {
    console.error("Error fetching ticker data:", error);
    return {
      message: "Error fetching ticker data",
    };
  }
}

// ----------------------
// Example Usage
// ----------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const symbol = argv[0] || "AAPL";

  getTickerPreview(symbol)
    .then((data) => console.log(JSON.stringify(data, null, 1)))
    .catch((error) => console.error("Error fetching ticker data:", error))
    .finally(() => process.exit(0));

  // (async () => {
  //   const t1 = "msft", t2 = "btc-usd";
  //   const data1 = await getTickerPreview(t1);
  //   const data2 = await getTickerPreview(t2);

  //   console.log(`${t1} scalp`, calculateScalpScore(data1));
  //   console.log(`${t2} scalp`, calculateScalpScore(data2));
  //   console.log(`${t1} swing`, calculateSwingScore(data1));
  //   console.log(`${t2} swing`, calculateSwingScore(data2));
  // })();
}
