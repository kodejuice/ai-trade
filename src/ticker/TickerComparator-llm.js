import { getCachedResult } from "../helpers/cache.js";
import { LLMResponse } from "../helpers/llm/llm.js";
import { getTickerPreview } from "./get-preview-ticker-data.js";
import { yfinanceMapping } from "./tickers.js";

export class TickerComparator {
  static async compare(ticker1, ticker2, tradeType) {
    const t1 = yfinanceMapping.mapSymbol(ticker1);
    const t2 = yfinanceMapping.mapSymbol(ticker2);
    const data1 = await getCachedResult(
      `ai-trade-preview-${ticker1}`,
      () => getTickerPreview(t1),
      60 * 60 * 24 * 7 // 7 days
    );
    const data2 = await getCachedResult(
      `ai-trade-preview-${ticker2}`,
      () => getTickerPreview(t2),
      60 * 60 * 24 * 7
    );

    const comparisonResult = await LLMResponse({
      systemPrompt: this.getSystemPrompt(tradeType),
      userPrompt: this.getUserPrompt(ticker1, ticker2, data1, data2, tradeType),
    });

    return this.parseComparisonResult(comparisonResult);
  }

  static getSystemPrompt(tradeType) {
    return `You are a financial analyst. You are given two tickers and their data. You need to compare the two tickers and return (((TICKER_1))) if the first ticker is better than the second ticker for ${tradeType} trading, (TICKER_1) if the second ticker is better than the first ticker, and (((EQUAL))) if the two tickers are equally good for ${tradeType} trading.`;
  }

  static getUserPrompt(ticker1, ticker2, data1, data2, tradeType) {
    return `Compare the following two tickers:
TICKER_1: ${ticker1}
${JSON.stringify(data1, null, 1)}

TICKER_2: ${ticker2}
${JSON.stringify(data2, null, 1)}

---

Which ticker is better for ${tradeType} trading? Do an analysis and provide a detailed explanation before making a decision.

Your response should be in the following format:
- "(((TICKER_1)))" if the first ticker is better than the second ticker for ${tradeType} trading.
- "(((TICKER_2)))" if the second ticker is better than the first ticker for ${tradeType} trading.
- "(((EQUAL)))" if the two tickers are equally good for ${tradeType} trading.`;
  }

  static parseComparisonResult(result) {
    if (result.includes("(((TICKER_1)))")) return -1;
    if (result.includes("(((TICKER_2)))")) return 1;
    return 0;
  }
}

