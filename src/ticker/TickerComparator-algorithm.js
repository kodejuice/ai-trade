import { getCachedResult } from "../helpers/cache.js";
import { getTickerPreview } from "./get-preview-ticker-data.js";
import { betterForScalpTrade } from "./scalp-score.js";
import { betterForSwingTrade } from "./swing-score.js";
import { yfinanceMapping } from "./tickers.js";

export class TickerComparator {
  static async compare(ticker1, ticker2, tradeType) {
    const t1 = yfinanceMapping.mapSymbol(ticker1);
    const t2 = yfinanceMapping.mapSymbol(ticker2);
    const data1 = await getCachedResult(
      `ai-trade-preview-${ticker1}`,
      () => getTickerPreview(t1),
      60 * 60 * 24 // 24 hours
    );

    const data2 = await getCachedResult(
      `ai-trade-preview-${ticker2}`,
      () => getTickerPreview(t2),
      60 * 60 * 24
    );

    if (tradeType === "scalp") {
      return betterForScalpTrade(data1, data2) ? -1 : 1;
    } else {
      return betterForSwingTrade(data1, data2) ? -1 : 1;
    }
  }
}
