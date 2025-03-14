import { getFullTickerData } from "../ticker/get-full-ticker-data.js";
import { yfinanceMapping } from "../ticker/tickers.js";
import { metaTradeAPI } from "./metaTradeApi.js";
import { formatCurrency } from "../helpers/util.js";

export class Prompt {
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
    return `You are a professional ${tradeType} trader. You analyze ticker data and make highly accurate trading decisions. Based on the given ticker data, provide detailed systematic analysis and recommend whether to BUY or SELL or Avoid trading for now.`;
  }

  static scalpTradePrompt(tickerData) {
    const technicalIndicators = tickerData.quotes.at(-1).technicalIndicators;

    return `
Analyze the following asset data as an expert scalp trader. Follow this structured approach:

1. Market Type Determination:
   - Check ADX: <25 = Ranging, >25 = Trending
   - Examine Bollinger Bands: Narrow width = Ranging, Price near bands = Potential breakout
   - Review price patterns: Consecutive HH/HL (Uptrend) or LH/LL (Downtrend)
   - Check volume: Spikes indicate Volatile/Breakout markets

2. Strategy Selection:
   - Trending Market: Use EMA crossover (9 vs 20), RSI extremes (<30 buy, >70 sell)
   - Ranging Market: Buy near BB lower band/oversold RSI-Stoch, sell near BB upper band/overbought
   - Volatile/Breakout: Use 2x ATR for stops, confirm with volume surge

3. Risk Management:
   - Always set stops: 2x ATR (${2 * technicalIndicators.ATR} ± current price)
   - Profit targets: 1.5x ATR or key technical levels (EMA20 / BB middle band)
   - Position size: Smaller in volatile markets (≤2% risk)

4. Execution Rules:
   - Require 3 confirming signals (e.g. BB position + RSI + EMA alignment)
   - Avoid trades with conflicting indicators
   - Prioritize recent price action (<1hr timeframes)

Given this data: ${JSON.stringify(tickerData, null, 1)}

Critical Price Levels:
- Current Price:
  Buy/Bid = ${tickerData.latestPrice.bid}
  Sell/Ask = ${tickerData.latestPrice.ask}
- BB Upper: ${technicalIndicators.BBANDS.upper}
- BB Lower: ${technicalIndicators.BBANDS.lower}
- EMA9: ${technicalIndicators.EMA9}
- ATR Stop Buffer: ±${2 * technicalIndicators.ATR}

Produce JSON response with:
- Market type from strict ADX threshold
- Strategy matching market type EXACTLY from list
- Clear numeric stops/targets using ATR/BB levels
- Trade ONLY if price at key technical level with confirmation

Response format:
((({
  "market_type": "[Trending/Ranging/Volatile/...]",
  "recommended_strategy": "[Exact strategy name from provided list]",
  "strategy_rationale": "Concise technical justification using 2-3 indicators",
  
  "order_type": "buy/sell/null",
  "take_profit": [calculated numeric value],
  "stop_loss": [calculated numeric value],
  "confidence_score": 1-10
})))

Return '((({"no_trade": true})))' if:
- Confidence < 7
- Conflicting signals
- Price between technical levels without clear edge
`;
  }

  static swingTradePrompt(tickerData) {
    const technicalIndicators = tickerData.quotes.at(-1).technicalIndicators;

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
- Current Price:
  Buy/Bid = ${tickerData.latestPrice.bid}
  Sell/Ask = ${tickerData.latestPrice.ask}
- 50D SMA: ${technicalIndicators.SMA50}
- 200D SMA: ${technicalIndicators.SMA200}

Produce JSON response with:
- Clear identification of dominant chart pattern
- Fundamental/technical alignment assessment
- Price targets based on measurable patterns
- Minimum 2 confirmation signals required

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
  "confidence_factor": 1-10
})))

Reject trades '((({"no_trade": true})))' if:
- Confidence < 7
- Price between key moving averages
- Earnings within 5 trading days
- Volatility < historical average
- Conflicting technical/fundamental signals
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
}

/*
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
