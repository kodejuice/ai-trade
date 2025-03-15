import MetaApi from "metaapi.cloud-sdk/esm-node";

const token = process.env.META_API_CLOUD_TOKEN;
const accountId = process.env.META_API_CLOUD_ACCOUNT_ID;

class MetaTradeApi {
  /**
   * @type {Record<string, import("metaapi.cloud-sdk").MetatraderSymbolSpecification>}
   */
  specCache = {};

  constructor(token) {
    if (!token) {
      throw new Error("META_API_CLOUD_TOKEN is required");
    }
    this.api = new MetaApi(token);
  }

  async initialize(accountId) {
    if (this.initializing) {
      return;
    }

    this.initializing = true;
    try {
      if (this.account) {
        return this.account;
      }
      if (!accountId) {
        throw new Error("Account ID is required");
      }
      const accounts =
        await this.api.metatraderAccountApi.getAccountsWithInfiniteScrollPagination(
          { state: "DEPLOYED" }
        );
      const account = accounts.find((acc) => acc.id === accountId);
      if (!account) {
        throw new Error(`Account "${accountId}" not found, is it Deployed?`);
      }
      // console.log(`Account`, account);
      this.account = account;
      return account;
    } catch (error) {
      console.log(`Failed to initialize MetaTradeApi: ${error.message}`);
    } finally {
      this.initializing = false;
    }
  }

  /**
   * @param {Object} param - Trade parameters
   * @param {string} param.symbol - Trading symbol
   * @param {string} param.tradeType - Type of trade ('scalp' or 'swing')
   * @param {string} param.market_type - Type of market (e.g. 'Ranging Market')
   * @param {string} param.recommended_strategy - Trading strategy to use
   * @param {string} param.strategy_rationale - Explanation of strategy choice
   * @param {string} param.order_type - Type of order ('buy' or 'sell')
   * @param {number} param.take_profit - Take profit price level
   * @param {number} param.stop_loss - Stop loss price level
   * @param {Object} param.price - Current price object
   * @param {number} param.price.bid - Bid price
   * @param {number} param.price.ask - Ask price
   * @param {number} param.stopsLevel - Stops level of the symbol
   * @param {boolean} param.no_trade - Flag indicating whether to execute the trade
   * @param {string} param.model - Model used for trade
   * @param {number} param.spread - Spread of the symbol
   * @param {number} param.minStopsLevelInPips - Minimum stops level in pips
   */
  async openTrade(param) {
    if (param?.no_trade || !param?.take_profit || !param?.stop_loss) {
      return;
    }

    try {
      const { symbol, tradeType, order_type, model, stop_loss, take_profit } =
        param;

      console.log(
        `Opening [${order_type.toUpperCase()}] trade for ${symbol}...`
      );
      const connection = await this.getConnection();
      const accountInfo = connection.terminalState.accountInformation; // {currency, balance, equity, margin, freeMargin, leverage, marginLevel}
      const symbolSpec = await this.getSpec(symbol);

      await connection.subscribeToMarketData(symbol);

      // 1 volume of symbol = {spec.contractSize} of symbol

      console.log(tradeType);
      console.log("LLM Model:", model);
      console.log("Free margin:", accountInfo.freeMargin);
      console.log("1% of free margin:", accountInfo.freeMargin / 100);
      console.log(`> Take profit: ${param.take_profit}`);
      console.log(`> Stop loss: ${param.stop_loss}`);
      console.log(
        `> [Spread: ${param.spread} || Stops level: ${param.minStopsLevelInPips}]`
      );

      let tradeResp;
      if (order_type == "buy") {
        console.log(`Buy price: ${symbolSpec.baseCurrency} ${param.price.bid}`);
        console.log(`1 volume: ${symbolSpec.contractSize} ${symbol}`);
        // how much volume can be bought with 1% of our free margin?
        const amountPerTrade = accountInfo.freeMargin / 100;
        const volume =
          amountPerTrade / (param.price.bid * symbolSpec.contractSize);
        const meetsMinVolume = volume >= symbolSpec.minVolume;
        if (!meetsMinVolume) {
          console.log(
            `Volume buyable: ${volume} - NOT OK (< ${symbolSpec.minVolume}), exiting trade`
          );
          return;
        }
        const volumeInLots = Math.min(
          symbolSpec.maxVolume,
          Math.floor(volume * 100) / 100
        );
        console.log(`Volume buyable: ${volumeInLots}`);

        tradeResp = await connection.createMarketBuyOrder(
          symbol,
          volumeInLots,
          // null,
          stop_loss,
          take_profit,
          {
            comment: param.model,
            trailingStopLoss: {
              distance: {
                distance: 50,
                units: "RELATIVE_POINTS",
              },
            },
          }
        );
      } else if (param.order_type == "sell") {
        console.log(
          `Sell price: ${symbolSpec.baseCurrency} ${param.price.ask}`
        );
        console.log(`1 volume: ${symbolSpec.contractSize} ${symbol}`);

        // how much volume can be sold with 1% of our free margin?
        const amountPerTrade = accountInfo.freeMargin / 100;
        const volume =
          amountPerTrade / (param.price.ask * symbolSpec.contractSize);
        const meetsMinVolume = volume >= symbolSpec.minVolume;
        if (!meetsMinVolume) {
          console.log(
            `Volume sellable: ${volume} - NOT OK (< ${symbolSpec.minVolume}), exiting trade`
          );
          return;
        }
        const volumeInLots = Math.min(
          symbolSpec.maxVolume,
          Math.floor(volume * 100) / 100
        );
        console.log(`Volume sellable: ${volumeInLots}`);

        tradeResp = await connection.createMarketSellOrder(
          symbol,
          volumeInLots,
          // null,
          stop_loss,
          take_profit,
          {
            // comment: param.model,
            // clientId: `${tradeType}_${symbol}_${Date.now()}`,
            trailingStopLoss: {
              distance: {
                distance: 50,
                units: "RELATIVE_POINTS",
              },
            },
          }
        );
      }

      console.log("Trade response:", tradeResp);

      await connection.unsubscribeFromMarketData(symbol);
    } catch (err) {
      console.error("Error opening trade:", err?.message);
    } finally {
      console.log("----\n");
    }
  }

  async getPrice(symbol) {
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    try {
      const connection = await this.getConnection();
      await connection.subscribeToMarketData(symbol);

      const price = connection.terminalState.price(symbol);
      await connection.unsubscribeFromMarketData(symbol);

      return price ? { ask: price.ask, bid: price.bid } : {};
    } catch (error) {
      console.error(`Failed to get price for ${symbol}:`, error.message);
      return {};
    }
  }

  async getSpec(symbol) {
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    if (symbol in this.specCache) {
      return this.specCache[symbol];
    }

    try {
      const connection = await this.getConnection();
      await connection.subscribeToMarketData(symbol);
      const spec = connection.terminalState.specification(symbol);
      await connection.unsubscribeFromMarketData(symbol);
      return (this.specCache[symbol] = spec);
    } catch (error) {
      console.error(`Failed to get spec for ${symbol}:`, error);
      return {};
    }
  }

  async getConnection() {
    if (!this.account) {
      await this.initialize(accountId);
    }

    if (!this.connection) {
      this.connection = this.account.getStreamingConnection();
      await this.connection.connect();
      await this.connection.waitSynchronized();
    }

    return this.connection;
  }
}

export const metaTradeAPI = new MetaTradeApi(token);

/*
  // get accounts
  const accounts = await api.metatraderAccountApi.getAccountsWithInfiniteScrollPagination({
    state: 'DEPLOYED',
  });
  const account = accounts.find(account => account.id === 'c82a1111-99e3-47c1-844c-d8348c02ab8f')

  // real-time
  const connection = account.getStreamingConnection();
  await connection.connect();

  // access local copy of terminal state
  const terminalState = connection.terminalState;

  // wait until synchronization completed
  await connection.waitSynchronized();

  // console.log(terminalState.connected);
  // console.log(terminalState.connectedToBroker);
  // console.log(terminalState.positions); [...]
  console.log(terminalState.price('BCHUSD'));

  connection.close();
*/

// 329 => 341
