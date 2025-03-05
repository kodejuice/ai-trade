import { getTopTickers } from "./ticker/get-top-tickers.js";

async function main() {
  const tickers = await getTopTickers();
  console.log(tickers);
}

main();
