import dotenv from "dotenv";
dotenv.config();

import MetaApi, { SynchronizationListener } from "metaapi.cloud-sdk/esm-node";

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
   * Retrieves the positions for the specified symbol.
   *
   * @param {string} symbol - The trading symbol to retrieve positions for.
   * @returns {Promise<import("metaapi.cloud-sdk").MetatraderPosition[]>} - An array of positions for the specified symbol.
   */
  async getPositionsBySymbol(symbol) {
    try {
      const connection = await this.getConnection();
      const terminalState = connection.terminalState;
      const positions = terminalState.positions;
      return positions.filter(
        (position) =>
          `${position.symbol}`.toLowerCase() === symbol.toLowerCase()
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * @typedef {Object} TradeParams
   * @property {string} symbol - Trading symbol
   * @property {string} tradeType - Type of trade ('scalp' or 'swing')
   * @property {string} order_type - Type of order ('buy' or 'sell')
   * @property {number} take_profit - Take profit price level
   * @property {number} stop_loss - Stop loss price level
   * @property {Object} price - Current price object with bid and ask
   * @property {string} model - Model used for trade
   */

  /**
   * @param {TradeParams} param
   */
  async openTrade(param) {
    if (param?.no_trade || !param?.take_profit || !param?.stop_loss) {
      return;
    }

    try {
      const { symbol, tradeType, order_type, model, stop_loss, take_profit } = param;
      console.log(`Opening [${order_type.toUpperCase()}] trade for ${symbol}...`);

      const connection = await this.getConnection();
      const accountInfo = connection.terminalState.accountInformation;
      const symbolSpec = await this.getSpec(symbol);

      await connection.subscribeToMarketData(symbol);
      await this.#logTradeDetails(param, accountInfo, symbolSpec);

      const volume = await this.#calculateTradeVolume(param, accountInfo, symbolSpec);
      if (!volume) return;

      const tradeResp = await this.#executeTradeOrder(param, volume);
      console.log("Trade response:", tradeResp);
    } catch (err) {
      console.error("Error opening trade:", err?.message);
    } finally {
      console.log("----\n");
    }
  }

  async #calculateTradeVolume(param, accountInfo, symbolSpec) {
    const amountPerTrade = accountInfo.freeMargin / 100;
    const price = param.order_type === "buy" ? param.price.ask : param.price.bid;
    const volume = amountPerTrade / (price * symbolSpec.contractSize);

    if (volume < symbolSpec.minVolume) {
      console.log(`Volume: ${volume} - NOT OK (< ${symbolSpec.minVolume}), exiting trade`);
      return null;
    }

    return Math.min(symbolSpec.maxVolume, Math.floor(volume * 100) / 100);
  }

  async #executeTradeOrder(param, volume) {
    const { symbol, order_type, stop_loss, take_profit, tradeType } = param;
    const tradeOptions = {
      comment: tradeType,
      trailingStopLoss: {
        distance: { distance: 20, units: "RELATIVE_POINTS" }
      }
    };

    console.log(`Volume ${order_type}able: ${volume}`);
    const connection = await this.getConnection();

    return order_type === "buy" 
      ? connection.createMarketBuyOrder(symbol, volume, stop_loss, take_profit, tradeOptions)
      : connection.createMarketSellOrder(symbol, volume, stop_loss, take_profit, tradeOptions);
  }

  async #logTradeDetails(param, accountInfo, symbolSpec) {
    console.log({
      tradeType: param.tradeType,
      model: param.model,
      freeMargin: accountInfo.freeMargin,
      marginPercent: accountInfo.freeMargin / 100,
      takeProfit: param.take_profit,
      stopLoss: param.stop_loss,
      spread: param.spread,
      stopsLevel: param.minStopsLevelInPips,
      contractSize: `${symbolSpec.contractSize} ${param.symbol}`,
      askPrice: `${symbolSpec.baseCurrency} ${param.price.ask}`,
      bidPrice: `${symbolSpec.baseCurrency} ${param.price.bid}`
    });
  }

  /**
   * Calculates the minimum stops distance for a given symbol, including the current spread.
   *
   * @param {string} symbol - The symbol to calculate the stops distance for.
   * @returns {Promise<number>} The minimum stops distance in pips, including the current spread.
   * @throws {Error} If the symbol is not provided.
   */
  #stopsDistanceCache = new Map();

  async getStopsDistance(symbol) {
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    const cached = this.#stopsDistanceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      return cached.value;
    }

    try {
      const stopsLevelPadding = 1; // 1 pip
      const { stopsLevel, digits } = await metaTradeAPI.getSpec(symbol);
      const minStopsLevelInPips =
        (stopsLevel + stopsLevelPadding) / Math.pow(10, digits);

      const { bid, ask } = await metaTradeAPI.getPrice(symbol);
      const spread = Math.abs(ask - bid);
      const result = minStopsLevelInPips + spread;

      this.#stopsDistanceCache.set(symbol, {
        value: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      return 100;
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
      // await connection.unsubscribeFromMarketData(symbol);

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
      // await connection.unsubscribeFromMarketData(symbol);
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

      // add listener
      const listener = new MySynchronizationListener();
      this.connection.addSynchronizationListener(listener);

      await this.connection.connect();
      await this.connection.waitSynchronized();
    }

    return this.connection;
  }
}

class MySynchronizationListener extends SynchronizationListener {
  #lastConnectionStatus = false;

  onConnected(instanceIndex, replicas) {
    console.log(`Instance ${instanceIndex} connected`);
  }

  onHealthStatus(instanceIndex, status) {
    // console.log(`Instance ${instanceIndex} health status changed to ${status}`);
  }

  onDisconnected(instanceIndex) {
    console.log(`Instance ${instanceIndex} disconnected`);
  }

  onBrokerConnectionStatusChanged(instanceIndex, connected) {
    if (this.#lastConnectionStatus === connected) {
      return;
    }
    console.log(
      `Instance ${instanceIndex} broker connection status changed to ${connected}`
    );
    this.#lastConnectionStatus = connected;
  }

  onUnsubscribeRegion(region) {
    console.log(`Unsubscribed from region ${region}`);
  }
}

export const metaTradeAPI = new MetaTradeApi(token);
