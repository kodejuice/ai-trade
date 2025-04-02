import yahooFinance from "yahoo-finance2";

import { formatDistanceToNow } from "date-fns";

import {
  getFundamentals,
  getHistoricalData,
  getPriceMetrics,
  getTechnicalIndicators,
  getVolumeMetrics,
} from "./get-preview-ticker-data.js";
import { formatCurrency, formatNumber } from "../helpers/util.js";
import { getTopNews } from "../helpers/news-sentiment.js";

const timeDistance = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

const showIndicator = (value, tradeType, expected) => {
  if (tradeType == expected) return value;
  return undefined;
};

// ----------------------
// Fetch and Aggregate Ticker Data (With some historical data)
// ----------------------
export async function getFullTickerData(symbol, tradeType = "swing") {
  try {
    const data = {};

    const { fundamentals, quoteSummary } = await getFundamentals(symbol);
    data["fundamentals"] = fundamentals;

    const historicalData = await getHistoricalData(symbol);
    data["priceMetrics"] = getPriceMetrics(historicalData);

    data["volumeMetrics"] = getVolumeMetrics({
      historical1mData: Array.from(historicalData.historical1m.quotes),
      quoteSummary,
    });

    data["quotes"] = [];

    if (tradeType === "swing") {
      const historicalDaily = historicalData.historicalDaily;
      const historicalDailyData = Array.from(historicalDaily.quotes).filter(
        (x) =>
          symbol.toLowerCase().includes("=x")
            ? true /* forex quotes dont have volume */
            : x.volume > 0
      );
      if (historicalDailyData.length < 1) {
        return data;
      }

      // const historicalIntraday15min = historicalData.historical5m;
      // const historicalIntradayData = Array.from(
      //   historicalIntraday15min.quotes
      // ).filter((x) =>
      //   symbol.toLowerCase().includes("=x")
      //     ? true /* forex quotes dont have volume */
      //     : x.volume > 0
      // );
      // const latestIntraDayData = historicalIntradayData.slice(-3, -1); // [_, ..., X, X, _]

      data["quotes"] = historicalDailyData;
    } else if (tradeType === "scalp") {
      const historicalIntraday = historicalData.historical30min;
      const historicalIntradayData = Array.from(
        historicalIntraday.quotes
      ).filter((x) =>
        symbol.toLowerCase().includes("=x")
          ? true /* forex quotes dont have volume */
          : x.volume > 0
      );
      data["quotes"] = historicalIntradayData;
    }

    // add news
    const searchResult = await yahooFinance.search(symbol);
    const newsWithSentiment = await getTopNews(
      searchResult.news,
      tradeType == "scalp"
    );
    data["recent_news"] = newsWithSentiment;

    var technicals = getTechnicalIndicators({
      historicalData: data["quotes"],
    });

    const Q = data["quotes"].map((quote, index) => {
      return {
        date: new Date(quote.date).toLocaleString(),
        timeAgo: timeDistance(quote.date),
        open: formatCurrency(quote.open),
        low: formatCurrency(quote.low),
        high: formatCurrency(quote.high),
        close: formatCurrency(quote.close),
        volume: formatNumber(quote.volume),
        technicalIndicators: {
          // scalp
          VWAP: showIndicator(technicals.VWAP[index], tradeType, "scalp"),
          // EMA5: showIndicator(technicals.EMA5[index], tradeType, "scalp"),
          EMA9: showIndicator(technicals.EMA9[index], tradeType, "scalp"),

          // swing
          OBV: showIndicator(technicals.OBV[index], tradeType, "swing"),
          MACD: showIndicator(technicals.MACD[index], tradeType, "swing"),
          EMA50: showIndicator(technicals.EMA50[index], tradeType, "swing"),
          EMA200: showIndicator(technicals.EMA200[index], tradeType, "swing"),
          SMA50: showIndicator(technicals.SMA50[index], tradeType, "swing"),
          SMA200: showIndicator(technicals.SMA200[index], tradeType, "swing"),

          // common
          EMA20: technicals.EMA20[index],
          STOCH: technicals.STOCH[index],
          BBANDS: technicals.BBANDS[index],
          RSI: technicals.RSI[index],
          ATR: technicals.ATR[index],
          ADX: technicals.ADX[index],
        },
      };
    });

    if (tradeType === "swing") {
      data["quotes"] = [
        ...Q.slice(-42, -35), // show data from 42 to 35 points ago
        // ...Q.slice(-35, -28), // hidden: data from 35 to 28 points ago
        ...Q.slice(-28, -21), // show data from 28 to 21 points ago
        // ...Q.slice(-21, -14), // hidden: data from 21 to 14 points ago
        ...Q.slice(-14), // show most recent 14 points of data
      ];
    } else if (tradeType === "scalp") {
      data["quotes"] = [
        // ...Q.slice(-42, -35), // show data from 42 to 35 points ago
        // ...Q.slice(-35, -28), // hidden: data from 35 to 28 points ago
        ...Q.slice(-33, -26), // show data from 28 to 21 points ago
        // ...Q.slice(-21, -14), // hidden: data from 21 to 14 points ago
        ...Q.slice(-19), // show most recent 19 points of data
      ];
    }

    return data;
  } catch (err) {
    return {
      message: "Error fetching ticker data",
      err: `${err}`,
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const symbol = argv[0] || "AAPL";
  const tradeType = argv[1] || "swing";

  getFullTickerData(symbol, tradeType)
    .then((data) => {
      console.log(JSON.stringify(data, null, 1));
      console.log("\nsymbol:", symbol);
      console.log("tradeType:", tradeType);
    })
    .finally(() => process.exit(0));
}
