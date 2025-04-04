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

    let tickerData_1hr =
      tradeType == "scalp"
        ? await getFullTickerData(ticker, "scalp", true)
        : null;

    const userPrompt =
      tradeType === "scalp"
        ? this.scalpTradePrompt(tickerData, tickerData_1hr)
        : this.swingTradePrompt(tickerData);
    return userPrompt;
  }

  static getSystemPrompt(tradeType) {
    // return `You are a professional ${tradeType} trader. You analyze ticker data and make highly accurate trading decisions. Based on the given ticker data, provide detailed systematic analysis and recommend whether to BUY or SELL or Avoid trading for now.`;
    return "";
  }

  static scalpTradePrompt(tickerData, tickerData_1hr) {
    const technicalIndicators =
      tickerData?.quotes?.at(-1)?.technicalIndicators || {};
    const technicalIndicators_1h =
      tickerData_1hr?.quotes?.at(-1).technicalIndicators || {};

    return `Objective: Act as an expert multi-timeframe scalp trader analyzing asset data to identify a high-probability short-term (30min chart focus) trade opportunity, using 1-hour chart context for bias and key levels. Base decisions strictly on the rules provided. Prioritize capital preservation; only recommend a trade if conditions on the 30min timeframe align well with the 1h context and rules are clearly met.

Input Data:
- Lower Timeframe (30min) Ticker Data: ${JSON.stringify(tickerData, null, 1)}
- Lower Timeframe (30min) Technical Indicators:
    - ADX: ${JSON.stringify(technicalIndicators.ADX)}
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
    - ATR (30min): ${technicalIndicators.ATR}
    - Volume (Current/Recent Avg): [Requires Volume data - Assuming available in tickerData or technicalIndicators]

- Higher Timeframe (1h) Technical Indicators:
    - ADX_1h: ${JSON.stringify(technicalIndicators_1h.ADX)}
    - EMA20_1h: ${technicalIndicators_1h.EMA20}
    - EMA50_1h: ${technicalIndicators_1h.EMA50}
    - BB_Upper_1h: ${technicalIndicators_1h.BBANDS?.upper}
    - BB_Lower_1h: ${technicalIndicators_1h.BBANDS?.lower}
    - RSI_1h: ${technicalIndicators_1h.RSI}
    - Most Recent 1h Ticker Data: ${JSON.stringify(tickerData_1hr?.quotes?.at(-1), null, 1)}

Structured Analysis & Decision Process (Follow Sequentially):

Phase 1: Pre-Trade Checks (Fail Fast - Based on 30min Data)

1.  Data Integrity: Are 30min indicators (technicalIndicators.ADX, BBANDS, EMA9, EMA20, RSI, STOCH, ATR) and tickerData.latestPrice available and numeric? Are key 1h indicators (e.g., ADX_1h, EMA20_1h, EMA50_1h) available?
    -   If NO, output 'no_trade' (Reason: Incomplete Data).
2.  Liquidity Check (30min): Is current volume significantly low compared to recent average? [Specify check, e.g., 'current_volume < 0.5 * avg_volume_20_periods']
    -   If YES (low volume), output 'no_trade' (Reason: Low Liquidity).
3.  Spread Check (30min): Calculate Spread = (${tickerData.latestPrice.ask} - ${
      tickerData.latestPrice.bid
    }). Calculate Spread Percentage = (Spread / ${
      tickerData.latestPrice.ask
    }) * 100. Is Spread Percentage > 0.5%?
    -   If YES, output 'no_trade' (Reason: High Spread).

Phase 2: Multi-Timeframe Market Analysis

4.  Higher Timeframe (1h) Context:
    -   1h Trend Direction:
        -   Use 1h ADX (${
          technicalIndicators_1h.ADX
        }) > 25 to gauge trend strength.
        -   Check price relative to key 1h EMAs (e.g., ${
          technicalIndicators_1h.EMA20
        }, ${
      technicalIndicators_1h.EMA50
    }): Price consistently above suggests Uptrend bias, Price consistently below suggests Downtrend bias. Check for EMA crossovers.
        -   Note overall 1h Trend: (e.g., "Strong Uptrend", "Weak Downtrend", "Ranging", "Approaching 1h Resistance").
    -   Key 1h Levels: Identify potential significant Support/Resistance from 1h indicators (e.g., ${
      technicalIndicators_1h.EMA20
    }, ${technicalIndicators_1h.EMA50}, ${
      technicalIndicators_1h.BBANDS?.upper
    }, ${
      technicalIndicators_1h.BBANDS?.lower
    }). Note if the current 30min price (${tickerData.latestPrice.ask}/${
      tickerData.latestPrice.bid
    }) is close to any of these key 1h levels.

5.  Lower Timeframe (30min) Market Type Determination:
    -   ADX Check (30min): Use ADX = ${JSON.stringify(technicalIndicators.ADX)}.
        -   If ADX <= 25: Market is Ranging (30min).
        -   If ADX > 25: Market is Trending (30min).
    -   Volatility Check (30min - using BB Width & Volume):
        -   BB Width (30min) = (${technicalIndicators.BBANDS?.upper} - ${
      technicalIndicators.BBANDS?.lower
    }). Is width expanding?
        -   Is 30min volume surging?
        -   If BB width expanding rapidly OR price breaking 30min bands with high volume: Consider Volatile/Breakout (30min).

6.  Lower Timeframe (30min) Price Location & Key Levels:
    -   Current Ask Price: ${tickerData.latestPrice.ask}
    -   Current Bid Price: ${tickerData.latestPrice.bid}
    -   Identify proximity to 30min key levels: BB Upper (${
      technicalIndicators.BBANDS?.upper
    }), BB Lower (${technicalIndicators.BBANDS?.lower}), BB Middle (${
      technicalIndicators.BBANDS?.middle
    }), EMA9 (${technicalIndicators.EMA9}), EMA20 (${
      technicalIndicators.EMA20
    }).
    -   Is 30min price currently touching or very close (e.g., within 0.25 * ATR (30min)) to one of these 30min key levels?
    -   Is 30min price stuck between levels with no clear pressure? If so, lean towards 'no_trade'.

Phase 3: Strategy Formulation (Integrating HTF Context)

7.  Strategy Selection (Based strictly on 30min Market Type):
    -   If 30min Market Type = Ranging: Select "Ranging - BB/Oscillator Reversion".
        -   Entry Condition: Buy near 30min BB Lower (${
          technicalIndicators.BBANDS?.lower
        }) ONLY IF 30min RSI (${
      technicalIndicators.RSI
    }) <= 30 OR 30min Stoch (${
      technicalIndicators.STOCH?.k
    }) <= 20. Sell near 30min BB Upper (${
      technicalIndicators.BBANDS?.upper
    }) ONLY IF 30min RSI (${technicalIndicators.RSI}) >= 70 OR 30min Stoch (${
      technicalIndicators.STOCH?.k
    }) >= 80.
    -   If 30min Market Type = Trending: Select "Trending - EMA Crossover/RSI Pullback".
        -   Determine 30min Trend Direction: HH/HL or LH/LL? Is 30min EMA9 (${
          technicalIndicators.EMA9
        }) above/below 30min EMA20 (${technicalIndicators.EMA20})?
        -   Entry Condition (Uptrend): Buy on pullbacks towards 30min EMA9/EMA20 ONLY IF 30min RSI (${
          technicalIndicators.RSI
        }) not >70 (ideally near 40-50). Require EMA9 > EMA20.
        -   Entry Condition (Downtrend): Sell on rallies towards 30min EMA9/EMA20 ONLY IF 30min RSI (${
          technicalIndicators.RSI
        }) not <30 (ideally near 50-60). Require EMA9 < EMA20.
    -   If 30min Market Conditions = Volatile/Breakout: Select "Volatile/Breakout - Confirmation Entry".
        -   Entry Condition: Wait for clear 30min breakout confirmed by volume surge & candle close beyond a key 30min level. Enter in direction of breakout.

8.  Confirmation & Context Filter:
    -   Confirmation Signals (30min): Does the specific 30min entry condition have at least 2-3 confirming 30min indicators?
    -   Conflicting Signals (30min): Are there significant conflicting 30min indicators?
    -   HTF Alignment Check (1h):
        -   Does the proposed 30min trade direction align with the identified 1h Trend Context (from Step 4)? (e.g., 30min Buy signal aligns with 1h Uptrend bias). Give STRONG PREFERENCE to aligned trades.
        -   Is the entry point directly conflicting with a major 1h S/R level identified in Step 4? (e.g., Trying to buy just below strong 1h resistance). AVOID entries directly into strong HTF levels.
    -   If 30min confirmation is weak OR conflicts exist OR the trade strongly conflicts with 1h context/levels, output 'no_trade'.

Phase 4: Trade Execution Plan (Only if valid entry identified)

9.  Order Type: 'buy' or 'sell' based on strategy confirmation and 1h alignment.
10. Entry Price Reference: Use Ask Price (${
      tickerData.latestPrice.ask
    }) for Buy, Bid Price (${tickerData.latestPrice.bid}) for Sell.
11. Risk Management Calculation (Based on 30min ATR):
    -   ATR Value (30min): ${technicalIndicators.ATR}
    -   Stop Loss Buffer: 2 * ${technicalIndicators.ATR}
    -   Profit Target Multiplier: 1.5 (aiming for 1.5 * ATR)
    -   Stop Loss (SL):
        -   For Buy: Entry Price (Ask) - (2 * ${technicalIndicators.ATR})
        -   For Sell: Entry Price (Bid) + (2 * ${technicalIndicators.ATR})
    -   Take Profit (TP):
        -   Calculate Initial TP:
            -   For Buy: Entry Price (Ask) + (1.5 * ${technicalIndicators.ATR})
            -   For Sell: Entry Price (Bid) - (1.5 * ${technicalIndicators.ATR})
        -   Check against Key Levels: Compare Initial TP with nearest significant 30min resistance/support (e.g., BB Middle/Opposite Band) AND nearest significant 1h S/R level (from Step 4).
        -   Final TP: Use the target that is CLOSER to the entry price between the calculated TP and the key S/R levels (prioritize respecting key levels over fixed ATR multiple if level is closer).
    -   Risk/Reward Ratio (RRR): Calculate Potential Profit (Final TP - Entry) / Potential Loss (Entry - SL). Is RRR >= 1.5?
        -   If RRR < 1.5, output 'no_trade' (Reason: Poor RRR).
12. Position Sizing Consideration: Note if 30min market is Volatile (smaller size needed).
13. Confidence Score: Assign score (1-10). Base higher scores on: Strong 30min signal confluence + Clear alignment with 1h trend context + Entry not directly into major 1h S/R level + Good RRR. Lower score for borderline signals or minor HTF conflicts.

Phase 5: Final Output Generation

14. Synthesize Findings: Construct the JSON response.
15. Final Check: Does the situation strongly match all rules, including 1h context? Default to 'no_trade' if doubt remains.

Output Format:

-   If a valid trade is identified:
    ((({
      "market_type_30min": "[Trending/Ranging/Volatile/Breakout]", // Determined in Step 5
      "higher_timeframe_context_1h": "[e.g., 1h Uptrend, Approaching 1h Resistance at Y, 1h Ranging]", // Determined in Step 4
      "recommended_strategy": "[Exact strategy name selected in Step 7]",
      "strategy_rationale": "Concise 30min justification (e.g., Price at 30m BB Lower ${
        technicalIndicators.BBANDS?.lower
      }, RSI ${
      technicalIndicators.RSI
    } < 30) + HTF Alignment (e.g., Aligned with 1h Uptrend bias).",
      "order_type": "[buy/sell]", // Determined in Step 9
      "entry_price_reference": [Ask price for Buy, Bid price for Sell], // Reference price used for calculation
      "take_profit": [Calculated numeric value from Step 11],
      "stop_loss": [Calculated numeric value from Step 11],
      "risk_reward_ratio": [Calculated numeric value from Step 11],
      "confidence_score": [1-10 integer based on Step 13]
    })))

-   If no trade is recommended:
    ((({"no_trade": true, "reason": "[Specific reason, e.g., High Spread, Conflicting 30min Signals, Poor RRR, Strong Conflict with 1h Trend/Level, Price Between Levels]"})))

Execute the analysis now based only on the provided data and the strict rules outlined above. Perform a step-by-step reasoning process before generating the final JSON output.
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

