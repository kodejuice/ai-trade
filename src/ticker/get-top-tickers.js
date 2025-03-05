// sort tickers using LLM

import { mergeSort } from "../helpers/merge-sort.js";
import { getTickerPreview } from "./get-preview-ticker-data.js";
import { SYMBOLS, yfinanceMapping } from "./tickers.js";

export const getTopTickers = async (tradeType = "scalp", n = 10) => {
  // ...
  const tickers = [
    ...SYMBOLS.forex,
    ...SYMBOLS.crypto,
    ...SYMBOLS.ETF,
    ...SYMBOLS.stocks.us,
    ...SYMBOLS.stocks.japan,
  ];

  const sortedTickers = await mergeSort(tickers, async (ticker1, ticker2) => {
    ticker1 = yfinanceMapping.mapSymbol(ticker1);
    ticker2 = yfinanceMapping.mapSymbol(ticker2);

    console.log("\nComparing :", ticker1, ticker2, "\n");
    try {
      const ticker1Data = await getTickerPreview(ticker1);
      const ticker2Data = await getTickerPreview(ticker2);

      console.log("Ticker1Data :", ticker1Data, "\n");
      console.log("Ticker2Data :", ticker2Data);
      console.log("-----");

      return [0, 1, -1][Math.floor(Math.random() * 3)];
    } catch (err) {
      return 0;
    }
  });

  return sortedTickers.slice(0, n);
};
