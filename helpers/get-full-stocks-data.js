import { formatDistanceToNow } from "date-fns";

import {
  getFundamentals,
  getHistoricalData,
  getPriceMetrics,
  getTechnicalIndicators,
} from "./get-preview-stocks-data.js";
import { formatCurrency, formatNumber } from "./util.js";

const timeDistance = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

const showIndicator = (value, tradeType, expected) => {
  if (tradeType == expected) return value;
  return undefined;
};

// ----------------------
// Fetch and Aggregate Stock Data (With some historical data)
// ----------------------
export async function getFullStocksData(symbol, tradeType = "swing") {
  const data = {};

  const historicalData = await getHistoricalData(symbol);
  data["priceMetrics"] = getPriceMetrics(historicalData);

  const { fundamentals } = await getFundamentals(symbol);
  data["fundamentals"] = fundamentals;

  data["quotes"] = [];

  if (tradeType === "swing") {
    const historicalDaily = historicalData.historicalDaily;
    const historicalDailyData = Array.from(historicalDaily.quotes).filter(
      (x) => x.volume > 0
    );

    const historicalIntraday15min = historicalData.historical5m;
    const historicalIntradayData = Array.from(
      historicalIntraday15min.quotes
    ).filter((x) => x.volume > 0);
    const latestIntraDayData = historicalIntradayData.slice(-5, -1); // [_, ..., X, X, X, X, _]

    // Append latest intraday data to historical daily data
    data["quotes"] = [
      ...historicalDailyData.slice(0, -1),
      ...latestIntraDayData,
      historicalDailyData.at(-1),
    ];
  } else if (tradeType === "scalp") {
    const historicalIntraday = historicalData.historical5m;
    const historicalIntradayData = Array.from(historicalIntraday.quotes).filter(
      (x) => x.volume > 0
    );
    data["quotes"] = historicalIntradayData;
  }

  var technicals = getTechnicalIndicators({
    historicalData: data["quotes"],
  });

  data["quotes"] = data["quotes"]
    .map((quote, index) => {
      const isLastQuote = index === data["quotes"].length - 1;
      return {
        date: isLastQuote ? undefined : new Date(quote.date).toLocaleString(),
        timeAgo: isLastQuote ? undefined : timeDistance(quote.date),
        time: isLastQuote ? "latest" : undefined,
        open: formatCurrency(quote.open),
        low: formatCurrency(quote.low),
        high: formatCurrency(quote.high),
        close: formatCurrency(quote.close),
        volume: formatNumber(quote.volume),
        technicalIndicators: {
          // scalp
          VWAP: showIndicator(technicals.VWAP[index], tradeType, "scalp"),
          STOCH: showIndicator(technicals.STOCH[index], tradeType, "scalp"),
          EMA5: showIndicator(technicals.EMA5[index], tradeType, "scalp"),

          // swing
          MACD: showIndicator(technicals.MACD[index], tradeType, "swing"),
          EMA20: showIndicator(technicals.EMA20[index], tradeType, "swing"),
          EMA50: showIndicator(technicals.EMA50[index], tradeType, "swing"),
          OBV: showIndicator(technicals.OBV[index], tradeType, "swing"),

          // common
          BBANDS: technicals.BBANDS[index],
          RSI: technicals.RSI[index],
          ATR: technicals.ATR[index],
        },
      };
    })
    .slice(-14);

  return data;
}

getFullStocksData("META", "swing").then((data) => {
  console.log(JSON.stringify(data, null, 2));
});
