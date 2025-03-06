import { getCachedResult } from "../helpers/cache.js";
import { LLMResponse } from "../helpers/llm.js";
import { mergeSort } from "../helpers/merge-sort.js";
import { waitFor } from "../helpers/util.js";
import {
  getTickerPreview,
  getFundamentals,
} from "./get-preview-ticker-data.js";
import { SYMBOLS, yfinanceMapping } from "./tickers.js";

/**
 * Gets the top tickers for a given trade type, based on an LLM analysis.
 *
 * @param {string} [tradeType="scalp"] - The type of trading to optimize, "scalp" or "swing".
 * @param {number} [n=7] - The number of top tickers to return.
 * @param {boolean} [log=true] - Whether to log the list of open tickers.
 * @returns {Promise<string[]>} - An array of the top tickers for the given trade type.
 */
export const getTopTickers = async (tradeType = "scalp", n = 7, log = true) => {
  const sortedTickers = await getCachedResult(
    `ai-trade-sorted-tickers-${tradeType}`,
    async () => sortTickers(tradeType),
    60 * 60 * 24 // 1 day
  );

  // get the tickers that are open for trading
  const tradableTickers = [];
  for (const ticker of sortedTickers) {
    try {
      const yt = yfinanceMapping.mapSymbol(ticker);
      const fundamentals = await getFundamentals(yt);
      if (fundamentals.marketStatus?.state === "regular") {
        tradableTickers.push(ticker);
        if (tradableTickers.length >= n) break;
      }
    } catch (err) {
      console.log("Error getting fundamentals for", ticker, err);
    }
  }

  if (log) {
    connsole.log(
      `[[(${tradeType}): ${tradableTickers.length} tickers open for trading]] => [${tradableTickers}]`
    );
  }

  return tradableTickers;
};

/**
 * Sorts a list of tickers using an LLM to determine the best tickers for a given trade type.
 *
 * @param {string} tradeType - The type of trading to optimize, "scalp" | "swing"
 * @returns {Promise<string[]>} - A sorted array of tickers, with the best tickers for the given trade type first.
 */
const sortTickers = async (tradeType) => {
  const tickers = [
    ...SYMBOLS.forex,
    ...SYMBOLS.crypto,
    ...SYMBOLS.ETF,
    ...SYMBOLS.stocks.us,
    ...SYMBOLS.stocks.japan,
  ];
  // shuffle
  tickers.sort(() => Math.random() - 0.5);

  waitFor(5).then(() => {
    console.log(`\nsorting ${tickers.length} tickers for ${tradeType} trading`);
  });

  const startTime = Date.now();

  const sortedTickers = await mergeSort(tickers, async (ticker1, ticker2) => {
    try {
      const data1 = await getTickerPreview(yfinanceMapping.mapSymbol(ticker1));
      const data2 = await getTickerPreview(yfinanceMapping.mapSymbol(ticker2));

      const comparisonResult = await LLMResponse({
        systemPrompt: `You are a financial analyst. You are given two tickers and their data. You need to compare the two tickers and return (((TICKER_1))) if the first ticker is better than the second ticker for ${tradeType} trading, (TICKER_1) if the second ticker is better than the first ticker, and (((EQUAL))) if the two tickers are equally good for ${tradeType} trading.`,
        userPrompt: `Compare the following two tickers:
TICKER_1: ${ticker1}
${JSON.stringify(data1, null, 1)}

TICKER_2: ${ticker2}
${JSON.stringify(data2, null, 1)}

---

Which ticker is better for ${tradeType} trading? Do an analysis and provide a detailed explanation before making a decision.

Your response should be in the following format:
- "(((TICKER_1)))" if the first ticker is better than the second ticker for ${tradeType} trading.
- "(((TICKER_2)))" if the second ticker is better than the first ticker for ${tradeType} trading.
- "(((EQUAL)))" if the two tickers are equally good for ${tradeType} trading.
`,
      });

      const better = comparisonResult.includes("(((TICKER_1)))")
        ? ticker1
        : comparisonResult.includes("(((TICKER_2)))")
        ? ticker2
        : "EQUAL";
      // console.log("\nComparing :", ticker1, ticker2);
      // console.log("better", better);

      return better === ticker1 ? -1 : better === ticker2 ? 1 : 0;
    } catch (err) {
      if (`${err}`.includes(yfinanceMapping.mapSymbol(ticker1))) {
        return 1;
      } else if (`${err}`.includes(yfinanceMapping.mapSymbol(ticker2))) {
        return -1;
      }

      console.log("ERROR", [ticker1, ticker2], err);
      return 0;
    }
  });

  const endTime = Date.now();
  console.log(
    `sorted ${tickers.length} tickers in ${(
      (endTime - startTime) /
      1000 /
      60
    ).toFixed(2)} minutes`
  );

  return sortedTickers;
};
