import dotenv from "dotenv";
dotenv.config();

import { TradeParams } from "./trade/TradeParams.js";
import { metaTradeAPI } from "./trade/metaTradeApi.js";
import { waitFor } from "./helpers/util.js";
import { getTickersForTrading } from "./trade/tradeTickers.js";

async function main() {
  console.log("\n[Begin placing trade]");

  await placeTrades("scalp");
  await placeTrades("swing", 1);

  console.log("\nWaiting for 7 minutes...\n");
  await waitFor(60 * 7);
  main();

  return 0;
}

async function placeTrades(tradeType, maxTrades = null) {
  const tickers = await getTickersForTrading(tradeType);

  let trades = 0;
  for (const ticker of tickers) {
    const params = await TradeParams.getTrade(ticker, tradeType);
    if (!params || params.no_trade) continue;
    if ((await metaTradeAPI.getPositionsBySymbol(ticker)).length) continue;

    await metaTradeAPI.openTrade(params);
    trades++;
    if (maxTrades && trades >= maxTrades) break;

    await waitFor(3);
  }
}

main();

// Spring Pin: 229455
