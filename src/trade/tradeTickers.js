import { getTradableTickers } from "../ticker/get-tradable-tickers.js";

export const getTickersForTrading = async (tradeType) => {
  const tickers = await getTradableTickers(tradeType, 100);

  // return first 47% of the tickers
  const T =
    tickers.length >= 100
      ? tickers.slice(0, Math.floor(tickers.length * 0.47))
      : tickers;

  if (T.length == 0) {
    console.log(
      `[${tradeType}]: No tickers available for trading, is your internet connected? \n`
    );
    return [];
  }

  console.log(
    `[${tradeType}]: ${T.length} tickers ready for trading: ${T}\n`
  );

  return T;
};
