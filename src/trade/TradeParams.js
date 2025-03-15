import * as fs from "node:fs/promises";

import { getGeminiModel, getGeminiReponse } from "../helpers/llm/gemini.js";
import { getGroqModel } from "../helpers/llm/groq.js";
import { metaTradeAPI } from "./metaTradeApi.js";
import { TradePromptGenerator } from "./Prompt.js";
import { extractAmountFromText } from "../helpers/util.js";
import { getLLMResponse } from "../helpers/llm/llm.js";

const NoTradeObject = { no_trade: true };

export class TradeParams {
  static async getTrade(symbol, tradeType = "scalp") {
    try {
      const params =
        (await this.getTradeParams(symbol, tradeType)) || NoTradeObject;

      await this.adjustTradeParams(params, symbol);

      if (params.no_trade) {
        return NoTradeObject;
      }

      return params;
    } catch (error) {
      console.log(`Failed to get params [${symbol}] ${error}`);
      return NoTradeObject;
    }
  }

  static async adjustTradeParams(params, symbol) {
    if (params.stop_loss) {
      // update minimal distance from the current market price to stops price
      params.stop_loss = extractAmountFromText(`${params.stop_loss}`);
      params.take_profit = extractAmountFromText(`${params.take_profit}`);

      const { stopsLevel, digits } = await metaTradeAPI.getSpec(symbol);
      const minStopsLevelInPips = stopsLevel / Math.pow(10, digits);

      const { bid, ask } = await metaTradeAPI.getPrice(symbol);
      const spread = Math.abs(ask - bid);

      params.spread = spread;
      params.minStopsLevelInPips = minStopsLevelInPips;

      const minDistanceForStopLoss = minStopsLevelInPips + spread;

      if (params.order_type == "buy") {
        const minStopLoss = bid - minDistanceForStopLoss;
        const minTakeProfit = bid + minDistanceForStopLoss;

        // params.adjusted_stop_loss = Math.min(params.stop_loss, minStopLoss);
        if (params.stop_loss > minStopLoss) {
          params.stop_loss = minStopLoss;
        }

        // params.adjusted_take_profit = Math.max(params.take_profit, minTakeProfit);
        if (params.take_profit < minTakeProfit) {
          params.take_profit = minTakeProfit;
        }
      } else if (params.order_type == "sell") {
        const minStopLoss = ask + minDistanceForStopLoss;
        const minTakeProfit = ask - minDistanceForStopLoss;

        // params.adjusted_stop_loss = Math.max(params.stop_loss, minStopLoss);
        if (params.stop_loss < minStopLoss) {
          params.stop_loss = minStopLoss;
        }

        // params.adjusted_take_profit = Math.min(params.take_profit, minTakeProfit);
        if (params.take_profit > minTakeProfit) {
          params.take_profit = minTakeProfit;
        }
      }
      params.price = { bid, ask };

      params.spread = Math.round(spread * 100) / 100;
      params.stopsLevel = Math.round(stopsLevel * 100) / 100;
      // params.take_profit = Math.floor(params.take_profit * 100) / 100;
      // params.stop_loss = Math.floor(params.stop_loss * 100) / 100;
    }
  }

  static async getTradeParams(symbol, tradeType = "scalp") {
    const systemPrompt = TradePromptGenerator.getSystemPrompt(tradeType);

    let userPrompt = await TradePromptGenerator.getPrompt(symbol, tradeType);
    let response = await getLLMResponse({
      systemPrompt,
      userPrompt,
      platform: "groq",
      // platform: "gemini",
    });
    const model = getGroqModel() || getGeminiModel() || "gpt";
    const params = await this.extractTradeParamsFromResponse(response);

    this.logTrade({
      symbol,
      tradeType,
      userPrompt,
      response,
      model,
    });

    if (
      !params ||
      params.no_trade == true ||
      !["buy", "sell"].includes(params.order_type) ||
      params.confidence_score < 6.5
    ) {
      return null;
    }

    params.tradeType = tradeType;
    params.symbol = symbol;
    params.model = model;

    return params;
  }

  static async extractTradeParamsFromResponse(response) {
    const p = this.parseParamsResult(response);
    if (p) return p;

    // use LLM to extract the trade params from the response
    const systemPrompt = `
You are a trading assistant. Extract the trade parameters from the given response.
The response should contain a JSON object with the following format:
{
  "order_type": "buy" or "sell",
  "take_profit": number,
  "stop_loss": number
} OR {"no_trade": true}`;

    const userPrompt = `Extract the trade parameters from this response:
${response}

Return valid JSON.`;

    return getGeminiReponse({
      systemPrompt,
      userPrompt,
    })
      .then((result) => {
        // Remove markdown json wrapper if present
        if (result.startsWith("```json") && result.endsWith("```")) {
          result = result.slice(7, -3).trim();
        }
        return this.parseParamsResult(result);
      })
      .catch(() => {
        return null;
      });
  }

  static parseParamsResult(result) {
    let match = result.match(/\(\(\(({[\s\S]*?})\)\)\)/);
    if (!match) match = result.match(/({[\s\S]*?})/);

    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      // console.log("error extracting params, ", `"...${result.slice(-150)}"`);
      return null;
    }
  }

  static async logTrade({ symbol, tradeType, userPrompt, response, model }) {
    // Store prompt and response for analysis
    const logPath = "./tmp/trade-logs";

    // Ensure log directory exists
    await fs.mkdir(logPath, { recursive: true });

    const logData = `timestamp: ${new Date().toISOString()},
symbol: ${symbol}
tradeType: ${tradeType}
model: ${model}

prompt: ${userPrompt}

=======

response: ${response}`;

    await fs.writeFile(
      `${logPath}/${symbol}-${tradeType}-${Date.now()}.txt`,
      logData
    );

    // loop over files in log directory and delete old files
    // read time from filename
    const files = await fs.readdir(logPath);
    // Keep only files from the last 3 hours
    const _3hrs = Date.now() - 3 * 60 * 60 * 1000;
    for (const file of files) {
      const timestamp = parseInt(file.split("-").pop().replace(".txt", ""));
      if (timestamp < _3hrs) {
        await fs.unlink(`${logPath}/${file}`);
      }
    }
  }
}
