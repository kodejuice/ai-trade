import { getFullTickerData } from "../ticker/get-full-ticker-data.js";
import { yfinanceMapping } from "../ticker/tickers.js";
import { metaTradeAPI } from "./metaTradeApi.js";
import { formatCurrency } from "../helpers/util.js";

export class TradePromptGenerator {
  static async getPrompt(symbol, tradeType) {
    const ticker = yfinanceMapping.mapSymbol(symbol);
    const tickerData = await getFullTickerData(ticker, tradeType);

    // get bid and ask prices
    const { bid, ask } = await metaTradeAPI.getPrice(symbol);
    const { stopsLevel } = await metaTradeAPI.getSpec(symbol);
    tickerData.latestPrice = {
      bid: formatCurrency(bid),
      ask: formatCurrency(ask),
      stopsLevel,
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
    // return `You are a professional ${tradeType} trader. You analyze ticker data and make highly accurate trading decisions. Based on the given ticker data, provide detailed systematic analysis and recommend whether to BUY or SELL or Avoid trading for now.`;
    return "";
  }

  static scalpTradePrompt(tickerData) {
    const technicalIndicators =
      tickerData?.quotes?.at(-1)?.technicalIndicators || {};

    return `
Objective: Act as an expert short-term scalp trader analyzing asset data to identify a high-probability trade opportunity based strictly on the rules provided. Prioritize capital preservation; only recommend a trade if conditions are clearly met.

Input Data:
- Ticker Data: ${JSON.stringify(tickerData, null, 1)}
- Technical Indicators:
    - ADX: ${technicalIndicators.ADX}
    - Bollinger Bands (BB):
        - Upper: ${technicalIndicators.BBANDS?.upper}
        - Middle: ${technicalIndicators.BBANDS?.middle}
        - Lower: ${technicalIndicators.BBANDS?.lower}
    - EMA9: ${technicalIndicators.EMA9}
    - EMA20: ${technicalIndicators.EMA20}
    - RSI: ${technicalIndicators.RSI}
    - Stochastic (%K, %D): ${technicalIndicators.STOCH?.k}, ${
      technicalIndicators.STOCH?.d
    }
    - ATR: ${technicalIndicators.ATR}
    - Volume (Current/Recent Avg): [Requires Volume data - Assuming available in tickerData or technicalIndicators]

Structured Analysis & Decision Process (Follow Sequentially):

Phase 1: Pre-Trade Checks (Fail Fast)

1.  Data Integrity: Is 'technicalIndicators.ADX', 'BBANDS', 'EMA9', 'EMA20', 'RSI', 'STOCH', 'ATR' and 'tickerData.latestPrice' available and numeric?
    -   If NO, output 'no_trade' (Reason: Incomplete Data).
2.  Liquidity Check: Is current volume significantly low compared to recent average? [Specify how to check this if data available, e.g., 'current_volume < 0.5 * avg_volume_20_periods']
    -   If YES (low volume), output 'no_trade' (Reason: Low Liquidity).
3.  Spread Check:
      Calculate Spread = '(${tickerData.latestPrice.ask} - ${
      tickerData.latestPrice.bid
    })'.
      Calculate Spread Percentage = '(Spread / ${
        tickerData.latestPrice.ask
      }) * 100'.
      Is Spread Percentage > 0.5%?
    -   If YES, output 'no_trade' (Reason: High Spread).

Phase 2: Market Analysis

4.  Market Type Determination:
    -   ADX Check: Use 'ADX = ${technicalIndicators.ADX}'.
        -   If 'ADX <= 25': Market is Ranging.
        -   If 'ADX > 25': Market is Trending.
    -   Volatility Check (using BB Width & Volume):
        -   BB Width = '(${technicalIndicators.BBANDS?.upper} - ${
      technicalIndicators.BBANDS?.lower
    })'. Is width significantly expanding compared to recent periods? [Requires historical width context if possible, otherwise use judgment based on current price action relative to bands].
        -   Is volume surging significantly above average?
        -   If BB width is expanding rapidly OR price is breaking out of bands with high volume: Consider the market Volatile/Breakout. Note: This often overlaps with Trending.

5.  Price Location & Key Levels:
    -   Current Ask Price: '${tickerData.latestPrice.ask}'
    -   Current Bid Price: '${tickerData.latestPrice.bid}'
    -   Identify proximity to key levels: BB Upper ('${
      technicalIndicators.BBANDS?.upper
    }'), BB Lower ('${technicalIndicators.BBANDS?.lower}'), BB Middle ('${
      technicalIndicators.BBANDS?.middle
    }'), EMA9 ('${technicalIndicators.EMA9}'), EMA20 ('${
      technicalIndicators.EMA20
    }').
    -   Is price currently touching or very close (e.g., within 0.25 * ATR) to one of these key levels?
    -   Is price stuck between key levels with no clear directional pressure? If so, lean towards 'no_trade'.

Phase 3: Strategy Formulation

6.  Strategy Selection (Based strictly on Market Type):
    -   If Market Type = Ranging: Select "Ranging - BB/Oscillator Reversion".
        -   Entry Condition: Look to Buy near BB Lower ('${
          technicalIndicators.BBANDS?.lower
        }') ONLY IF RSI ('${technicalIndicators.RSI}') <= 30 OR Stoch ('${
      technicalIndicators.STOCH?.k
    }') <= 20. Look to Sell near BB Upper ('${
      technicalIndicators.BBANDS?.upper
    }') ONLY IF RSI ('${technicalIndicators.RSI}') >= 70 OR Stoch ('${
      technicalIndicators.STOCH?.k
    }') >= 80.
    -   If Market Type = Trending: Select "Trending - EMA Crossover/RSI Pullback".
        -   Determine Trend Direction: Recent price making Higher Highs/Higher Lows (Uptrend) or Lower Highs/Lower Lows (Downtrend)? Is EMA9 ('${
          technicalIndicators.EMA9
        }') above EMA20 ('${
      technicalIndicators.EMA20
    }') (Uptrend signal) or below (Downtrend signal)?
        -   Entry Condition (Uptrend): Look to Buy on pullbacks towards EMA9/EMA20 ONLY IF RSI ('${
          technicalIndicators.RSI
        }') is NOT overbought (>70) and ideally near 40-50 support. Require EMA9 > EMA20 confirmation.
        -   Entry Condition (Downtrend): Look to Sell on rallies towards EMA9/EMA20 ONLY IF RSI ('${
          technicalIndicators.RSI
        }') is NOT oversold (<30) and ideally near 50-60 resistance. Require EMA9 < EMA20 confirmation.
    -   If Market Conditions = Volatile/Breakout: Select "Volatile/Breakout - Confirmation Entry".
        -   Entry Condition: Wait for a clear breakout confirmed by a significant volume surge and candle close beyond a key level (e.g., BB band). Enter in the direction of the breakout. Use tighter confirmation criteria.

7.  Confirmation Signal Check:
    -   Does the specific entry condition for the selected strategy have at least 2-3 confirming indicators? (e.g., For Ranging Buy: Price at BB Lower + RSI Oversold + Stoch Oversold).
    -   Are there significant conflicting signals? (e.g., ADX Ranging, but price breaking BB Upper strongly? Or EMA cross bullish, but RSI severely overbought?).
    -   If confirmation is weak OR conflicts exist, output 'no_trade'.

Phase 4: Trade Execution Plan (Only if a valid entry is identified)

8.  Order Type: 'buy' or 'sell' based on strategy confirmation.
9.  Entry Price Reference: Use Ask Price ('${
      tickerData.latestPrice.ask
    }') for Buy orders, Bid Price ('${
      tickerData.latestPrice.bid
    }') for Sell orders.
10. Risk Management Calculation:
    -   ATR Value: '${technicalIndicators.ATR}'
    -   Stop Loss Buffer: '2 * ${technicalIndicators.ATR}'
    -   Profit Target Multiplier: '1.5' (aiming for 1.5 * ATR)
    -   Stop Loss (SL):
        -   For Buy: 'Entry Price (Ask) - (2 * ${technicalIndicators.ATR})'
        -   For Sell: 'Entry Price (Bid) + (2 * ${technicalIndicators.ATR})'
    -   Take Profit (TP):
        -   For Buy: 'Entry Price (Ask) + (1.5 * ${
          technicalIndicators.ATR
        })' OR nearest significant resistance (e.g., BB Middle/Upper). Use the closer target.
        -   For Sell: 'Entry Price (Bid) - (1.5 * ${
          technicalIndicators.ATR
        })' OR nearest significant support (e.g., BB Middle/Lower). Use the closer target.
    -   Risk/Reward Ratio (RRR): Calculate 'Potential Profit (TP - Entry) / Potential Loss (Entry - SL)'. Is RRR >= 1.5? (Note: Prompt originally asked for 1:2, adjusted here to match 1.5x ATR target vs 2x ATR stop which is closer to 1:1.5 - adjust if 1:2 is strict).
        -   If RRR < 1.5, output 'no_trade' (Reason: Poor RRR).
11. Position Sizing Consideration: If market flagged as Volatile, mentally note that position size should be smaller (rule: ≤2% risk per trade - calculation not required in output).
12. Confidence Score: Assign a score (1-10) based on the clarity and confluence of signals, proximity to ideal entry, and lack of conflicting data. High confluence = higher score. Borderline signals = lower score.

Phase 5: Final Output Generation

13. Synthesize Findings: Based on the above steps, construct the JSON response.
14. Final Check: Does the situation strongly match the rules? If any doubt or ambiguity remains, default to 'no_trade'.

Output Format:

-   If a valid trade is identified:
    ((({
      "market_type": "[Trending/Ranging/Volatile/Breakout]", // Determined in Step 4
      "recommended_strategy": "[Exact strategy name selected in Step 6]",
      "strategy_rationale": "Concise justification using 2-3 specific indicator values and price action relative to levels (e.g., Price at BB Lower ${
        technicalIndicators.BBANDS?.lower
      }, RSI ${technicalIndicators.RSI} < 30, Stoch ${
      technicalIndicators.STOCH?.k
    } < 20).",
      "order_type": "[buy/sell]", // Determined in Step 8
      "entry_price_reference": [Ask price for Buy, Bid price for Sell], // Reference price used for calculation
      "take_profit": [Calculated numeric value from Step 10],
      "stop_loss": [Calculated numeric value from Step 10],
      "risk_reward_ratio": [Calculated numeric value from Step 10],
      "confidence_score": [1-10 integer based on Step 12]
    })))

-   If no trade is recommended (due to any 'no_trade' condition triggered above):
    ((({"no_trade": true, "reason": "[Specific reason, e.g., High Spread, Conflicting Signals, Price Between Levels, Low Liquidity, Poor RRR, Incomplete Data]"})))

Execute the analysis now based only on the provided data and the strict rules outlined above. Perform a step-by-step reasoning process internally before generating the final JSON output.
`;
  }

  static swingTradePrompt(tickerData) {
    const technicalIndicators =
      tickerData?.quotes?.at(-1)?.technicalIndicators || {};

    return `
Analyze the following asset data as a professional swing trader. Use this framework:

1. Market Phase Identification:
   - Trend Analysis: 50D/200D EMA relationship (Golden Cross/Death Cross)
   - Weekly Chart Patterns: Higher highs/lows (uptrend), lower highs/lows (downtrend)
   - Key Levels: 52-week range position, Fibonacci retracement levels (38.2%, 50%, 61.8%)
   - Sentiment: PE ratios vs sector averages, institutional ownership changes

2. Strategy Selection Matrix:
   - Trend Continuation:
     - Entry: Pullback to 20D EMA + RSI(14) < 40 in uptrend
     - Confirm with MACD histogram turning positive
   - Mean Reversion:
     - Entry: Price < -1 STD Bollinger Band + RSI(14) < 30
     - Exit at 50D SMA or midline BB
   - Breakout/Retest:
     - Confirm close above 3-month resistance with >avg volume
     - Buy retest with tight stop
   - Fundamental Catalyst:
     - Pair strong EPS growth with technical setup
     - Post-earnings continuation plays

3. Risk Parameters:
   - Stop-Loss: 5% below entry OR 2x 14-day ATR
   - Profit Targets: 1:3 risk/reward minimum
   - Max Drawdown: 8% trailing stop

4. Data Prioritization:
   - Weighting: 50% technicals, 30% fundamentals, 20% market structure
   - Key Metrics:
     - 50D EMA slope angle
     - 3-month volume profile
     - Short interest ratio
     - Institutional accumulation/distribution

Given this data: ${JSON.stringify(tickerData, null, 1)}

Critical Levels:
- Current Price: ${tickerData.latestPrice.bid}
- 50D SMA: ${technicalIndicators.SMA50}
- 200D SMA: ${technicalIndicators.SMA200}

Produce JSON response with:
- Clear identification of dominant chart pattern
- Fundamental/technical alignment assessment
- Price targets based on measurable patterns
- Minimum 2 confirmation signals required

Note:
- AVOID trading when there's low liquidity / low volume
- AVOID trading if the provided data is incomplete
- AVOID trading when there is a wide spread between bid/ask

Response format:
((({
  "market_phase": ["Accumulation","Uptrend","Distribution","Downtrend"],
  "trading_strategy": ["Trend Pullback","Breakout Play","Mean Reversion","Earnings Momentum"],
  "rationale": "Combine technical setup with fundamental catalyst in <50 words",
  
  "order_type": "buy/sell/null",
  "entry_range": [support_level, resistance_level],
  "take_profit": target_price,
  "stop_loss": calculated_price,
  "time_horizon": "5-14 days",
  "confidence_score": 1-10
})))

Reject trades '((({"no_trade": true})))' if:
- Price between key moving averages
- Earnings within 5 trading days
- Volatility < historical average
- Not enough confirmation
- Conflicting technical/fundamental signals
- There is low liquidity or volume

If we are avoiding a trade return ((({"no_trade": true})))

Do a deep dive analysis before returning a JSON response
`;
  }
}

/*

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

static scalpTradePrompt(tickerData) {
    return `
Given the following asset data:

${JSON.stringify(tickerData, null, 1)}

I need you to analyse the available data and make a scalp trade order, given what you know about the available technical indicators data present.  Analyse their values the way an expert scalp trader would, and use that data to make a trading decision

Do proper analysis before making a trading decision

${this.getStrategyPrompt()}

Current Buy Price: ${tickerData.latestPrice?.ask}
Current Sell Price: ${tickerData.latestPrice?.bid}
Stops Level: ${tickerData.stopsLevel}

Give response in the following format, the JSON object within the brackets should be a valid JSON object:

((({
  "market_type": ...,
  "recommended_strategy": ...,
  "strategy_rationale": "[Brief explanation of why the recommended strategy is suitable for the inferred market type. One to two sentences.]",

  "order_type": "buy" or "sell",
   "take_profit": ...,
   "stop_loss": ...
})))

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
Stops Level: ${tickerData.stopsLevel}

Give response in the following format, the JSON object within the brackets should be a valid JSON object:

((({
  "market_type": ...,
  "recommended_strategy": ...,
  "strategy_rationale": "[Brief explanation of why the recommended strategy is suitable for the inferred market type. One to two sentences.]",

  "order_type": "buy" or "sell",
   "take_profit": ...,
   "stop_loss": ...
})))

Make sure it is wrapped with (((( )))

If it is not the best time to enter a trade, just return a {"no_trade": true} object
`;

    // The stop loss must be 800 points below the buy price if we are buying, and 800 points above the sell price if we are selling.
    // (1 point = 0.0001 of the price)
  }
*/
