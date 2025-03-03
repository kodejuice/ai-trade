import yahooFinance from "yahoo-finance2";

import {
  rsi,
  sma,
  macd,
  atr,
  ema,
  bollingerbands,
  vwap,
  adx,
  stochastic,
  cci,
  obv,
  mfi,
} from "technicalindicators";
import { getTopNews } from "./news-sentiment.js";
import { getFundamentals } from "./get-preview-stocks-data.js";



// ----------------------
// Fetch and Aggregate Stock Data (With some historical data)
// ----------------------
export async function getFullStocksData(symbol, type = "swing") {
  const { quoteSummary, fundamentals } = await getFundamentals(symbol);

  /*
  scalp trading data

  {
    priceMetrics: {},

    fundamentals: {},

    data: [
      {
        date: "3/3/2025, 1:22:09 PM",
        timeAgo: "15 minutes ago",
        open: 100,
        close: 100,
        low: 95,
        high: 105,
        volume: 1000000,
        technicalIndicators: {
          RSI: 50,
          EMA5: 100,
          BANDS: {
            upper: 100,
            lower: 100,
          },
          STOCH: {
            K: 100,
            D: 100,
          },
          VWAP: 100,
          ATR: 100,
        },
      },
      ...
    ]
  }


  swing trading data
  {
    priceMetrics: {},

    fundamentals: {},

    data: [
    {
        date: "3/3/2025, 1:22:09 PM",
        timeAgo: "1 day ago",
        open: 100,
        close: 100,
        low: 95,
        high: 105,
        volume: 1000000,
        technicalIndicators: {
          RSI: 50,
          MACD: 100,
          BANDS: {
            upper: 100,
            lower: 100,
          },
          EMA20: 100,
          EMA50: 100,
          OBV: 100,
          ATR: 100,
        },
      },
      ...
      14 in total
    ]
  }
  */
}
