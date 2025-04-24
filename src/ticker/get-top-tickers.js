import { getCachedResult } from "../helpers/cache.js";

import { getFundamentals } from "./get-preview-ticker-data.js";
import { sortTickers } from "./sortTickers.js";
import { yfinanceMapping } from "./tickers.js";

export const TICKERS_CACHE_DURATION = 60 * 60 * 7; // 7 hours

export const getTopTickers = async (tradeType = "scalp", n = 7, log = true) => {
  const sortedTickers = await getCachedResult(
    `ai-trade-sorted-tickers-${tradeType}`,
    () => sortTickers(tradeType),
    TICKERS_CACHE_DURATION
  );

  const tradableTickers = await filterTradableTickers(sortedTickers, n);
  return tradableTickers;
};

const filterTradableTickers = async (tickers, limit) => {
  const tradable = [];

  for (const ticker of tickers) {
    try {
      const yt = yfinanceMapping.mapSymbol(ticker);
      const { fundamentals } = await getFundamentals(yt);
      if (fundamentals.marketStatus?.state === "regular") {
        tradable.push(ticker);
        if (tradable.length >= limit) break;
      }
    } catch (err) {
      // console.log("Error getting fundamentals for", ticker);
    }
  }

  return tradable;
};
