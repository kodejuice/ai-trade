import { getTradableTickers } from "../ticker/get-tradable-tickers";

export const getTickersForTrading = async (tradeType) => {
  const tickers = await getTradableTickers(tradeType, 100);

  // return first 47% of the tickers
  const T =
    tickers.length >= 100
      ? tickers.slice(0, Math.floor(tickers.length * 0.47))
      : tickers;

  console.log(
    `[${tradeType}]: ${T.length} tickers ready for trading => ${T}\n`
  );

  return T;
};
