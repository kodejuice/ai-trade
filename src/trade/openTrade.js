import { getFullTickerData } from "../ticker/get-full-ticker-data.js";


export async function openTrade(ticker, tradeType="scalp") {
  const tickerData = await getFullTickerData(ticker, tradeType);

}


export async function getTradeParams(ticker, tradeType="scalp") {
  const tickerData = await getFullTickerData(ticker);
}

