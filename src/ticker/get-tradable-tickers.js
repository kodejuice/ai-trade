import { getFundamentals } from "./get-preview-ticker-data.js";
import { getAllTickers, yfinanceMapping } from "./tickers.js";

export const getTradableTickers = async (n = 7) => {
  const tradableTickers = await filterTradableTickers(getAllTickers(), n);
  return tradableTickers;
};

export const filterTradableTickers = async (tickers, limit) => {
  const tradable = [];

  for (const ticker of tickers) {
    try {
      const yt = yfinanceMapping.mapSymbol(ticker);
      const { fundamentals } = await getFundamentals(yt);
      if (fundamentals.marketStatus?.state === "regular") {
        tradable.push(ticker);
        if (tradable.length >= limit) break;
      }
    } catch (err) {}
  }

  return tradable;
};
