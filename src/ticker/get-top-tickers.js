import { getCachedResult } from "../helpers/cache.js";

import { getFundamentals } from "./get-preview-ticker-data.js";
import { sortTickers } from "./sortTickers.js";
import { yfinanceMapping } from "./tickers.js";

const CACHE_DURATION = 60 * 60 * 24 * 7; // 7 days

export const getTopTickers = async (tradeType = "scalp", n = 7, log = true) => {
  const sortedTickers = await getCachedResult(
    `ai-trade-sorted-tickers-${tradeType}`,
    () => sortTickers(tradeType),
    CACHE_DURATION
  );

  const tradableTickers = await filterTradableTickers(sortedTickers, n);

  if (log) {
    console.log(
      `[[(${tradeType}): ${tradableTickers.length} tickers open for trading]] => [${tradableTickers}]`
    );
  }

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
      console.log("Error getting fundamentals for", ticker);
    }
  }

  return tradable;
};
