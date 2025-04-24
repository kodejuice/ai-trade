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

    return `Objective: Act as an expert multi-timeframe scalp trader simulating discretionary judgment. Analyze asset data to identify HIGH-PROBABILITY, short-term (30min chart focus) trade opportunities, rigorously filtering signals using 1-hour context, price action, momentum quality, and reversal checks. Base decisions strictly on the enhanced rules. Prioritize capital preservation; only recommend a trade if multiple categories of evidence strongly align and risk is well-defined. Aim to filter for trades with a higher likelihood of success (>66% target requires filtering out borderline setups).

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
    - Stochastic (%K, %D): ${technicalIndicators.STOCH?.k}, ${technicalIndicators.STOCH?.d}
    - ATR (30min): ${technicalIndicators.ATR}
    - Volume (Current/Recent Avg):
      Current: ${tickerData.volumeMetrics?.["current volume (30 min)"]} (30 min)
    - Recent Candles (e.g., Last 3-5 OHLC)

- Higher Timeframe (1h) Technical Indicators:
    - ADX_1h: ${JSON.stringify(technicalIndicators_1h.ADX)}
    - EMA20_1h: ${technicalIndicators_1h.EMA20}
    - EMA50_1h: ${technicalIndicators_1h.EMA50}
    - BB_Upper_1h: ${technicalIndicators_1h.BBANDS?.upper}
    - BB_Lower_1h: ${technicalIndicators_1h.BBANDS?.lower}
    - RSI_1h: ${technicalIndicators_1h.RSI}
    - Most Recent 1h Ticker Data: ${JSON.stringify(tickerData_1hr?.quotes?.at(-1), null, 1)}

Structured Analysis & Decision Process (Follow Sequentially & Rigorously):

Phase 1: Pre-Trade Checks (Fail Fast - Based on 30min Data)

1.  Data Integrity: All required 30min and 1h indicators, price, volume, and recent candle data available and numeric? If NO, output 'no_trade' (Reason: Incomplete Data).
2.  Liquidity/Spread Check: Calculate Spread = (${tickerData.latestPrice.ask} - ${
      tickerData.latestPrice.bid
    }). Calculate Spread Percentage = (Spread / ${
      tickerData.latestPrice.ask
    }) * 100. Is Spread Percentage > 0.5%?
    -   If YES, output 'no_trade' (Reason: High Spread).
3.  Market Condition Check: Avoid known low-volatility periods or just before major news if context is available.

Phase 2: Multi-Timeframe Market Analysis & Context

4.  Higher Timeframe (1h) Context:
    -   1h Trend: Determine direction (using EMAs, price structure) and strength (ADX_1h). Note overall 1h bias (Uptrend/Downtrend/Ranging).
        -   Use 1h ADX (${
          technicalIndicators_1h.ADX
        }) > 25 to gauge trend strength.
        -   Check price relative to key 1h EMAs (e.g., ${
          technicalIndicators_1h.EMA20
        }, ${
      technicalIndicators_1h.EMA50
    }): Price consistently above suggests Uptrend bias, Price consistently below suggests Downtrend bias. Check for EMA crossovers.
        -   Note overall 1h Trend: (e.g., "Strong Uptrend", "Weak Downtrend", "Ranging", "Approaching 1h Resistance").
    -   Key 1h Levels: Identify major S/R from 1h EMAs/BBs. Note proximity of current price.
    -   1h Momentum: Check 1h RSI position (overbought/oversold/neutral).

5.  Lower Timeframe (30min) Market Type Determination:
    -   ADX (30min): Use ADX = ${JSON.stringify(technicalIndicators.ADX)}.
      Determine Ranging (<=25) or Trending (>25).
    -   Volatility (30min): Assess BB width (expanding/contracting) and ATR (spiking/stable/low). Note if volatility seems unusually high (potential exhaustion) or low (potential consolidation setup).
        -   BB Width (30min) = (upper: ${technicalIndicators.BBANDS?.upper} - lower: ${technicalIndicators.BBANDS?.lower}).
    Is width expanding?
      -   Is 30min volume surging?
      -   If BB width expanding rapidly OR price breaking 30min bands with high volume: Consider Volatile/Breakout (30min).

6.  Lower Timeframe (30min) Price Action & Location:
    -   Current Ask Price: ${tickerData.latestPrice.ask}
    -   Current Bid Price: ${tickerData.latestPrice.bid}
    -   Price Location: Identify proximity to 30min key levels (BBs, EMAs). Is price AT a level or BETWEEN levels?
    BB Upper (${
      technicalIndicators.BBANDS?.upper
    }), BB Lower (${technicalIndicators.BBANDS?.lower}), BB Middle (${
      technicalIndicators.BBANDS?.middle
    }), EMA9 (${technicalIndicators.EMA9}), EMA20 (${
      technicalIndicators.EMA20
    }).
    -   Micro-Structure (Last 3-5 candles): Analyze recent candles. Is there a clear impulse move? Consolidation/flag? Rejection wicks? Deceleration near a level?

Phase 3: Strategy Formulation & Rigorous Filtering

7.  Initial Strategy Selection (Based strictly on 30min Market Type:
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


8.  Entry Condition Check & Quality Assessment:
    -   Check specific entry conditions for the selected strategy (e.g., Buy near BB Low + RSI <= 30 + Stoch <= 20 for Ranging).
    -   Momentum Quality: Is the oscillator (RSI/Stoch) decisively moving into/out of OB/OS zones, or just hovering? Is the crossover (if applicable) sharp?
    -   Volume Confirmation: Does volume support the potential move (e.g., increasing volume on potential breakout, low volume on pullback)?

9.  Reversal Risk Assessment (CRITICAL FILTER):
    -   Divergence Check: Look for regular bearish divergence (Price HH vs RSI LH) before longs, or regular bullish divergence (Price LL vs RSI HL) before shorts on BOTH 30m and 1h RSI. If present against the trade direction, assign HIGH REVERSAL RISK.
    -   Exhaustion Check: Has price made a large, multi-candle move recently without pullback? Is ATR (30min) spiking significantly now? If YES, assign HIGH REVERSAL RISK.
    -   HTF Level Conflict: Is the entry point directly AT or just below/above a strong conflicting 1h S/R level identified in Step 4? If YES, assign HIGH REVERSAL RISK unless breakout is confirmed.
    -   Candlestick Rejection: Do the last 1-2 candles show strong rejection wicks against the intended trade direction near the entry level? If YES, assign HIGH REVERSAL RISK.

10. Confluence & Final Filter:
    -   Require Strong Confluence: Need confirmation from at least **2-3 DIFFERENT categories** (Price Level, Momentum Oscillator, Trend Indicator/Bias, Volume, Supportive Price Action). List the supporting factors.
    -   HTF Alignment: MUST align with or be neutral to the 1h Trend Bias (from Step 4). Trading directly against a strong 1h trend requires exceptional 30min confirmation and clear reversal signals.
    -   Reversal Risk Filter: If 'HIGH REVERSAL RISK' was assigned in Step 9 from ANY check, output 'no_trade' (Reason: High Reversal Risk).
    -   Conflicting Signals: Are there any significant contradictions between indicators (even if minimum confirmation met)? If YES, output 'no_trade' (Reason: Conflicting Signals).

Phase 4: Trade Execution Plan (Only if ALL filters passed)

11. Order Type: 'buy' or 'sell'.
12. Entry Price Reference: Ask for Buy, Bid for Sell. Consider waiting for candle close confirmation or slight pullback after signal if appropriate.
13. Risk Management Calculation (Based on 30min ATR):
    -   ATR Value (30min): ${technicalIndicators.ATR}
    -   Stop Loss (SL): Entry Price +/- (2 * ${technicalIndicators.ATR}). Ensure SL is placed logically beyond the opposing structure/level where possible.
    -   Take Profit (TP): Calculate Initial TP = Entry Price +/- (1.5 * ${technicalIndicators.ATR}). Check if nearest significant 30min OR 1h S/R level is CLOSER than initial TP. Final TP = the CLOSER of the calculated TP or the key S/R level.
    -   "Room to Move" Check: Is the distance to the first minor opposing level (e.g., 30m BB Middle Band, nearest EMA) > 0.75 * ATR? If not, trade might be too constrained. Consider 'no_trade' (Reason: Lack of Space).
    -   Risk/Reward Ratio (RRR): Calculate (Final TP - Entry) / (Entry - SL). MUST be >= 1.5. If RRR < 1.5, output 'no_trade' (Reason: Poor RRR).
14. Confidence Score: Assign score (1-10). Higher scores (8+) require: Strong confluence across categories, Clear alignment with 1h context, No reversal warnings passed filter, Clear price action, Good RRR with room to move. Lower scores (5-7) for adequate but less perfect setups. Below 5 should likely be filtered out by earlier steps.

Phase 5: Final Output Generation

15. Synthesize Findings: Construct JSON.
16. Final Sanity Check: Does this trade feel forced or is it a clear, high-probability setup based on the stringent rules? If any doubt, default to 'no_trade'.

Output Format:
-   If valid trade:
    ((({
      "market_type_30min": "[Trending/Ranging/Volatile/Breakout]", // Determined in Step 5
      "higher_timeframe_context_1h": "[e.g., 1h Uptrend, Approaching 1h Resistance at Y, 1h Ranging]", // Determined in Step 4
      "recommended_strategy": "[Exact strategy name selected in Step 7]",
      "strategy_rationale": "Concise 30min justification (e.g., Price at 30m BB Lower ${
        technicalIndicators.BBANDS?.lower
      }, RSI ${
      technicalIndicators.RSI
    } < 30) + HTF Alignment (e.g., Aligned with 1h Uptrend bias). Make sure to mention key confirmations and lack of reversal signals",
      "order_type": "[buy/sell]", // Determined in Step 9
      "entry_price_reference": [Ask price for Buy, Bid price for Sell], // Reference price used for calculation
      "take_profit": [Calculated numeric value from Step 11],
      "stop_loss": [Calculated numeric value from Step 11],
      "risk_reward_ratio": [Calculated numeric value from Step 11],
      "confidence_score": [1-10 integer based on Step 13]
    })))

-   If no trade:
    ((({"no_trade": true, "reason": "[Specific reason, e.g., High Spread, High Reversal Risk (Divergence), High Reversal Risk (Exhaustion), Strong Conflict with 1h Level, Insufficient Confluence, Conflicting Signals, Poor RRR, Lack of Space, Price Between Levels]"})))

Execute analysis based ONLY on data and these rules. Perform detailed step-by-step reasoning, explicitly checking each filter.
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

Execute analysis based ONLY on data and this framework. Perform detailed step-by-step reasoning before returning a JSON response
`;
  }
}
