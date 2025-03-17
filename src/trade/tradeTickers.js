import { mergeSort } from "../helpers/merge-sort.js";
import { getTopTickers } from "../ticker/get-top-tickers.js";
import { metaTradeAPI } from "./metaTradeApi.js";

export const getTickersForTrading = async (tradeType) => {
  const tickers = await getTopTickers(tradeType, 100);

  // sort by stops distance
  // so symbols with the lowest (stops distance + spread) are at the top
  await mergeSort(tickers, async (sym1, sym2) => {
    const stopsDist1 = await metaTradeAPI.getStopsDistance(sym1);
    const stopsDist2 = await metaTradeAPI.getStopsDistance(sym2);
    return stopsDist1 - stopsDist2;
  });

  // return first 47% of the tickers
  const T = tickers.slice(0, Math.floor(tickers.length * 0.47));

  console.log(
    `[${tradeType}]: ${T.length} tickers sorted by stops distance => ${T}\n`
  );

  return T;
};
