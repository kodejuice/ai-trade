import * as fs from "node:fs/promises";

import { getFullTickerData } from "../ticker/get-full-ticker-data.js";
import { yfinanceMapping } from "../ticker/tickers.js";
import { getGeminiReponse } from "../helpers/llm/gemini.js";
import { getGroqResponse } from "../helpers/llm/groq.js";
import { metaTradeAPI } from "./metaTradeApi.js";
import { extractAmountFromText, formatCurrency } from "../helpers/util.js";

const NoTradeObject = { no_trade: true };

export class TradeParams {
  static async getTrade(ticker, tradeType = "scalp") {
    try {
      const params =
        (await this.getTradeParams(ticker, tradeType)) || NoTradeObject;

      // update stop-loss to be 800 points distance from current price
      if (params.stop_loss) {
        params.stop_loss = extractAmountFromText(`${params.stop_loss}`);
        params.take_profit = extractAmountFromText(`${params.take_profit}`);

        const { bid, ask } = await metaTradeAPI.getPrice(symbol);
        if (params.order_type == "buy") {
          const minStopLoss = ask - 0.08;
          params.adjusted_stop_loss = Math.min(params.stop_loss, minStopLoss);
        } else if (params.order_type == "sell") {
          const minStopLoss = bid + 0.08;
          params.adjusted_stop_loss = Math.max(params.stop_loss, minStopLoss);
        }
        params.price = { bid, ask };
      }

      return params;
    } catch (error) {
      return NoTradeObject;
    }
  }

  static async getTradeParams(symbol, tradeType = "scalp") {
    // get prompt
    const systemPrompt = this.getSystemPrompt(tradeType);

    let userPrompt = await this.getPrompt(symbol, tradeType);
    // const response1 = await getGroqResponse({ systemPrompt, userPrompt });
    const response1 = await getGeminiReponse({
      systemPrompt,
      userPrompt,
      model: "gemini-2.0-flash-thinking-exp-01-21",
    });
    const params1 = await this.extractTradeParamsFromResponse(response1);

    if (!params1 || params1.no_trade == true) {
      return null;
    }

    userPrompt = await this.getPrompt(symbol, tradeType);
    // const response2 = await getGroqResponse({ systemPrompt, userPrompt });
    const response2 = await getGeminiReponse({
      systemPrompt,
      userPrompt,
      model: "gemini-2.0-flash-thinking-exp-01-21",
    });
    const params2 = await this.extractTradeParamsFromResponse(response2);

    if (
      !params2 ||
      params2.no_trade == true ||
      params1.order_type !== params2.order_type
    ) {
      return null;
    }

    this.logTrade({
      symbol,
      tradeType,
      userPrompt,
      response: response2,
    });

    // params1.take_profit and params2.take_profit must be within 1% of each other
    const tp1 = extractAmountFromText(`${params1.take_profit}`);
    const tp2 = extractAmountFromText(`${params2.take_profit}`);
    const percentageDiff = Math.abs((tp1 - tp2) / Math.max(tp1, tp2)) * 100;

    // Return null if difference is more than 1%
    if (percentageDiff > 1) {
      // console.log(
      //   `Trade params take-profit levels are not within 1% of each other: ${JSON.stringify(params1)} vs ${JSON.stringify(params2)}`
      // );
      return null;
    }

    return params2;
  }

  static async getPrompt(symbol, tradeType) {
    const ticker = yfinanceMapping.mapSymbol(symbol);
    const tickerData = await getFullTickerData(ticker, tradeType);

    // get bid and ask prices
    const { bid, ask } = await metaTradeAPI.getPrice(symbol);
    tickerData.latestPrice = {
      bid: formatCurrency(bid),
      ask: formatCurrency(ask),
    };
    if (!bid || !ask) {
      const bid = (ask = tickerData.priceMetrics?.currentPrice);
      tickerData.latestPrice = { bid, ask };
    }

    const userPrompt =
      tradeType === "scalp"
        ? this.scalpTradePrompt(tickerData)
        : this.swingTradePrompt(tickerData);
    return userPrompt;
  }

  static getSystemPrompt(tradeType) {
    return `You are a professional ${tradeType} trader. You analyze ticker data and make highly accurate trading decisions. Based on the given ticker data, provide detailed analysis and recommend whether to BUY or SELL or Avoid trading for now.`;
  }

  static scalpTradePrompt(tickerData) {
    return `
Given the following asset data:

${JSON.stringify(tickerData, null, 1)}

I need you to analyse the available data and make a scalp trade order, given what you know about the available technical indicators data present.  Analyse their values the way an expert scalp trader would, and use that data to make a trading decision

Do proper analysis before making a trading decision

${this.getStrategyPrompt()}

Current Buy Price: ${tickerData.latestPrice?.ask}
Current Sell Price: ${tickerData.latestPrice?.bid}

Give response in the following format, the JSON object within the brackets should be a valid JSON object:

((({
  "market_type": ...,
  "recommended_strategy": ...,
  "strategy_rationale": "[Brief explanation of why the recommended strategy is suitable for the inferred market type. One to two sentences.]",

  "order_type": "buy" or "sell",
   "take_profit": ...,
   "stop_loss": ...
})))

The stop loss must be 800 points below the buy price if we are buying, and 800 points above the sell price if we are selling.
(1 point = 0.0001 of the price)

Make sure it is wrapped with (((( )))

If it is not the best time to enter a trade, just return a {"no_trade": true} object
`;
  }

  static swingTradePrompt(tickerData) {
    return `
Given the following asset data:

${JSON.stringify(tickerData, null, 1)}

I need you to analyse the available data and make a swing trade order, given what you know about the available technical indicators data present and also take a good look at the fundamentals and news.  Analyse their values the way an expert swing trader would, and use that data to make a trading decision

Do proper analysis before making a trading decision

${this.getStrategyPrompt()}

Current Buy Price: ${tickerData.latestPrice?.ask}
Current Sell Price: ${tickerData.latestPrice?.bid}

Give response in the following format, the JSON object within the brackets should be a valid JSON object:

((({
  "market_type": ...,
  "recommended_strategy": ...,
  "strategy_rationale": "[Brief explanation of why the recommended strategy is suitable for the inferred market type. One to two sentences.]",

  "order_type": "buy" or "sell",
   "take_profit": ...,
   "stop_loss": ...
})))

The stop loss must be 800 points below the buy price if we are buying, and 800 points above the sell price if we are selling.
(1 point = 0.0001 of the price)

Make sure it is wrapped with (((( )))

If it is not the best time to enter a trade, just return a {"no_trade": true} object
`;
  }

  static getStrategyPrompt() {
    return `Examine the market type from the quote data and use the following strategies to make trading decisions.

1. If its a Trending market
Indicators: Strong directional movement (e.g., ADX > 25), consecutive higher highs/lows (uptrend) or lower highs/lows (downtrend)
Strategy to use:
  Trend-following : Use moving average crossovers (e.g., 50/200-day or 9/20 MA) or momentum indicators (RSI > 70 for overbought, RSI < 30 for oversold)
  Breakout Trading : Identify key resistance/support levels and enter when price breaks out.
  Pullback Trading : Enter trades on minor retracements within the trend.
  Momentum Trading : Buy strong-moving assets with high volume and volatility.

2. If its a Ranging Market (Sideways or Consolidating)
A ranging market moves within a defined horizontal price range, showing no clear trend.
Indicators: Low volatility (e.g., Bollinger Bands narrowing), price oscillating within support/resistance levels
Strategy to use:
  Mean reversion: Buy near support, sell near resistance. Use RSI or stochastic oscillators to identify overbought/oversold levels 
  Scalping: Take small profits frequently within the range.

3. If its a Volatile Market
These markets experience high fluctuations in price within short periods.
Indicators : Sudden price gaps, abnormal volume spikes, or external signals (earnings reports, geopolitical events)
Strategy to use:
  Recommend smaller position sizes to mitigate risk.
  Anticipate periods of low volatility followed by breakouts. Enter trades when price breaks out of a defined range or volatility contraction, expecting a significant price move.

Considerations: Set tight stop-loss orders to limit potential losses.

4. If its a Breakout Market
Indicators : Price breaking through key resistance/support with high volume .
Strategy to use:
  Momentum entry : Enter trades in the breakout direction with trailing stop-losses

5. News/Gap-Driven Market:
Strategy: Cautious/Short-Term Tactical.
Action:
  If entering a trade, apply very tight stop-loss orders.

Considerations: Evaluate the impact of the news before making a trade.

6. Illiquid Markets
These markets have low trading volumes, causing large bid-ask spreads and slow execution.

Strategy to use:
  Long-Term Position Trading : Avoid short-term trades and hold positions for extended periods.
  Market Making : Profit from the spread between bid and ask prices.

7. Choppy Markets:
Avoid trading in choppy markets.
Recognize that choppy markets are difficult to trade profitably with most strategies. The best strategy is to abstain from trading and wait for clearer market conditions.
Specific Technique: Market Neutral approach - actively not taking positions or only taking very low-risk, short-term positions. Focus on observation and analysis rather than execution.

------

Risk-Management Rules:
  Stop-Loss : Set dynamic stops (e.g., ATR-based) or fixed % stops based on volatility

------
`;
  }

  static async extractTradeParamsFromResponse(response) {
    const p = this.parseParamsResult(response);
    if (p) return p;

    // use LLM to extract the trade params from the response
    const systemPrompt = `
You are a trading assistant. Extract the trade parameters from the given response.
The response should contain a JSON object with the following format:
{
  "order_type": "buy" or "sell",
  "take_profit": number,
  "stop_loss": number
} OR {"no_trade": true}`;

    const userPrompt = `Extract the trade parameters from this response:
${response}

Return valid JSON.`;

    return getGeminiReponse({
      systemPrompt,
      userPrompt,
    })
      .then((result) => {
        // Remove markdown json wrapper if present
        if (result.startsWith("```json") && result.endsWith("```")) {
          result = result.slice(7, -3).trim();
        }
        return this.parseParamsResult(result);
      })
      .catch(() => {
        return null;
      });
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

  static async logTrade({ symbol, tradeType, userPrompt, response }) {
    // Store prompt and response for analysis
    const logPath = "./tmp/trade-logs";

    // Ensure log directory exists
    await fs.mkdir(logPath, { recursive: true });

    const logData = `timestamp: ${new Date().toISOString()},
symbol: ${symbol},
tradeType: ${tradeType},

prompt: ${userPrompt},

=======

response: ${response}`;

    await fs.writeFile(
      `${logPath}/${symbol}-${tradeType}-${Date.now()}.txt`,
      logData
    );

    // loop over files in log directory and delete old files
    // read time from filename
    const files = await fs.readdir(logPath);
    // Keep only files from the last 10 hours
    const _10hrs = Date.now() - 10 * 60 * 60 * 1000;
    for (const file of files) {
      const timestamp = parseInt(file.split("-").pop().replace(".txt", ""));
      if (timestamp < _10hrs) {
        await fs.unlink(`${logPath}/${file}`);
      }
    }
  }
}
