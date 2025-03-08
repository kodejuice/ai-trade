import { getFullTickerData } from "../ticker/get-full-ticker-data.js";
import { yfinanceMapping } from "../ticker/tickers.js";
import { getGeminiReponse } from "../helpers/llm/gemini.js";
import { getGroqResponse } from "../helpers/llm/groq.js";

export class TradeParams {
  static async getTradeParams(ticker, tradeType = "scalp") {
    ticker = yfinanceMapping.mapSymbol(ticker);

    const tickerData = await getFullTickerData(ticker, tradeType);

    if (!tickerData.priceMetrics) {
      console.log(`no ticker data for ${ticker}`);
      return null;
    }

    const systemPrompt = this.getSystemPrompt(tradeType);
    const userPrompt =
      tradeType === "scalp"
        ? this.scalpTradePrompt(tickerData)
        : this.swingTradePrompt(tickerData);

    const response = await getGroqResponse({ systemPrompt, userPrompt });
    let params = this.parseParamsResult(response);
    if (!params) {
      console.log('no param matched, using LLM');
      params = await this.extractTradeParamsFromResponse(response);
    }
    console.log(`${ticker} params`, params);
    return params;
  }

  static getSystemPrompt(tradeType) {
    return `You are a professional ${tradeType} trader. You analyze ticker data and make highly accurate trading decisions. Based on the given ticker data, provide detailed analysis and recommend whether to BUY or SELL.`;
  }

  static scalpTradePrompt(tickerData) {
    return `
Given the following asset data:

${JSON.stringify(tickerData, null, 1)}

I need you to analyse the available data and make a scalp trade order, given what you know about the available technical indicator data present : [STOCH, EMA5, VWAP, BBANDS, RSI and ATR].  Analyse their values the way an expert scalp trader would, and use that data to make a trading decision

Do a proper analysis before making a trading decision

Give response in the following format, the JSON object within the brackets should be a valid JSON object:

((({
   "order_type": "buy" or "sell",
   "take_profit": ...,
   "stop_loss": ...
})))

Make sure it is wrapped with (((( )))

If it is prefferable to not make a trade, then return a {"trade": false} object
`;
  }

  static swingTradePrompt(tickerData) {
    return `
Given the following asset data:

${JSON.stringify(tickerData, null, 1)}

I need you to analyse the available data and make a swing trade order, given what you know about the available technical indicator data present : [MACD, EMA20, EMA50, OBV, BBANDS, RSI and ATR] and also take a good look at the fundamentals.  Analyse their values the way an expert swing trader would, and use that data to make a trading decision

Do a proper analysis before making a trading decision

Give response in the following format, the JSON object within the brackets should be a valid JSON object:

((({
   "order_type": "buy" or "sell",
   "take_profit": ...,
   "stop_loss": ...
})))

Make sure it is wrapped with (((( )))

If it is prefferable to not make a trade, then return a {"trade": false} object
`;
  }

  static parseParamsResult(result) {
    let match = result.match(/\(\(\(({[\s\S]*?})\)\)\)/);
    if (!match) match = result.match(/({[\s\S]*?})/);

    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      // console.log("error extracting params, ", `"...${result.slice(-150)}"`);
      return null;
    }
  }

  static async extractTradeParamsFromResponse(response) {
    // use LLM to extract the trade params from the response
    const systemPrompt = `
You are a trading assistant. Extract the trade parameters from the given response.
The response should contain a JSON object with the following format:
{
  "order_type": "buy" or "sell",
  "take_profit": number,
  "stop_loss": number
} OR {"trade": false}`;
    const userPrompt = `Extract the trade parameters from this response:
${response}

Return valid JSON.`;

    return getGeminiReponse({
      systemPrompt,
      userPrompt,
    })
      .then((result) => {
        // Remove markdown json wrapper if present
        if (result.startsWith('```json') && result.endsWith('```')) {
          result = result.slice(7, -3).trim();
        }
        return this.parseParamsResult(result);
      })
      .catch((error) => {
        return null;
      });
  }
}
