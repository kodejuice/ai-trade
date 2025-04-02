import { mergeSort } from "../helpers/merge-sort.js";
import { getTopTickers } from "../ticker/get-top-tickers.js";
import { metaTradeAPI } from "./metaTradeApi.js";

export const getTickersForTrading = async (tradeType) => {
  const tickers = await getTopTickers(tradeType, 100);

  // return first 46% of the tickers
  const T =
    tickers.length >= 100
      ? tickers.slice(0, Math.floor(tickers.length * 0.46))
      : tickers;

  console.log(
    `[${tradeType}]: ${T.length} tickers ready for trading => ${T}\n`
  );

  return T;
};
