import { mergeSort } from "../helpers/merge-sort.js";
import { msToTime, waitFor } from "../helpers/util.js";
import { getAllTickers, yfinanceMapping } from "./tickers.js";

import { TickerComparator } from "./TickerComparator-algorithm.js";
import { getCachedResult, setCachedResult } from "../helpers/cache.js";
import { getTickerPreview } from "./get-preview-ticker-data.js";
import { TICKERS_CACHE_DURATION } from "./get-top-tickers.js";

const LOG_INTERVAL = 1000 * 60 * 5; // 5 minutes

export const sortTickers = async (tradeType) => {
  const tickers = getAllTickers();
  const comparisonCount = ~~(tickers.length * Math.log2(tickers.length));

  // cache preview data for each ticker
  waitFor(3).then(() => console.log(`\nPre-caching ${tickers.length} ticker preview data...`));
  for (const t of tickers) {
    await getCachedResult(
      `ai-trade-preview-${t}`,
      () => getTickerPreview(yfinanceMapping.mapSymbol(t)),
      60 * 60 * 24, // 1 day
    );
  }

  logSortingStart(tickers.length, tradeType, comparisonCount);

  const startTime = Date.now();
  let lastLogTime = startTime;
  let currentComparisonCount = 0;

  const sortedTickers = await mergeSort(tickers, async (ticker1, ticker2) => {
    try {
      currentComparisonCount++;

      const timeSinceLastLog = Date.now() - lastLogTime;
      if (timeSinceLastLog > LOG_INTERVAL) {
        const msElapsed = Date.now() - startTime;
        const msPerComparison = msElapsed / currentComparisonCount;
        const comparisonsLeft = comparisonCount - currentComparisonCount;
        const _30mins = 1000 * 60 * 27;
        const timeRemaining = msToTime(
          msPerComparison * comparisonsLeft - _30mins
        );

        console.log(
          `\n${currentComparisonCount} comparisons in ${msToTime(msElapsed)}
Comparisons left: ${comparisonsLeft}
Estimated time remaining: ${timeRemaining}`
        );
        lastLogTime = Date.now();
      }

      return await TickerComparator.compare(ticker1, ticker2, tradeType);
    } catch (err) {
      return handleComparisonError(err, ticker1, ticker2);
    }
  });

  console.log(
    `sorted ${tickers.length} tickers in ${msToTime(Date.now() - startTime)}`
  );

  return sortedTickers;
};

const handleComparisonError = (err, ticker1, ticker2) => {
  const errString = `${err}`;
  if (errString.includes(yfinanceMapping.mapSymbol(ticker1))) return 1;
  if (errString.includes(yfinanceMapping.mapSymbol(ticker2))) return -1;
  console.log("ERROR", [ticker1, ticker2], err);
  return 0;
};

const logSortingStart = async (tickerCount, tradeType, comparisonCount) => {
  // await waitFor(5);
  console.log(
    `\n[sorting ${tickerCount} tickers for <${tradeType}> trading]\n${comparisonCount} comparisons expected\n`
  );
};

const sortAndCacheTickers = async (tradeType) => {
  const sortedTickers = await sortTickers(tradeType);
  console.log(`${tradeType} tickers => ${JSON.stringify(sortedTickers)}\n`);

  // cache to Redis
  return setCachedResult(
    `ai-trade-sorted-tickers-${tradeType}`,
    sortedTickers,
    TICKERS_CACHE_DURATION
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await sortAndCacheTickers("scalp");
    await sortAndCacheTickers("swing");
  })();
}
