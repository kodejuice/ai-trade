import yahooFinance from "yahoo-finance2";
import {
  formatCurrency,
  computePriceChangePercentage,
  getTradingDateNDaysAgo,
  formatNumber,
  formatPercentageValue,
} from "./util.js";

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



// ----------------------
// Fetch and Aggregate Stock Data (With some historical data)
// ----------------------
