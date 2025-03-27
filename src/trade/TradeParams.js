import * as fs from "node:fs/promises";

import { getGeminiModel, getGeminiReponse } from "../helpers/llm/gemini.js";
import { getGroqModel } from "../helpers/llm/groq.js";
import { metaTradeAPI } from "./metaTradeApi.js";
import { TradePromptGenerator } from "./Prompt.js";
import { extractAmountFromText } from "../helpers/util.js";
import { getLLMResponse } from "../helpers/llm/llm.js";
import { getOpenAIModel } from "../helpers/llm/openai.js";

const NoTradeObject = { no_trade: true };

// Store prompt and response for analysis
const LOG_PATH = `./tmp/trade-logs`;

export class TradeParams {
  static async getTrade(symbol, tradeType = "scalp") {
    this.cleanupOldLogs();

    try {
      const params =
        (await this._getTradeParams(symbol, tradeType)) || NoTradeObject;

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
      params.stop_loss = extractAmountFromText(`${params.stop_loss}`);
      params.take_profit = extractAmountFromText(`${params.take_profit}`);

      const { stopsLevel, digits } = await metaTradeAPI.getSpec(symbol);
      const minStopsLevelInPips = (stopsLevel + 3) / Math.pow(10, digits);

      const { bid, ask } = await metaTradeAPI.getPrice(symbol);
      const spread = Math.abs(ask - bid);

      params.spread = spread;
      params.minStopsLevelInPips = minStopsLevelInPips;

      const minDistanceForStopLoss = minStopsLevelInPips + spread;

      if (params.order_type == "buy") {
        const minStopLoss = bid - minDistanceForStopLoss;
        const minTakeProfit = bid + minDistanceForStopLoss;

        if (params.stop_loss > minStopLoss) params.stop_loss = minStopLoss;
        if (params.take_profit < minTakeProfit)
          params.take_profit = minTakeProfit;

        // Ensure risk:reward ratio of at least 1:2
        const riskDistance = Math.abs(bid - params.stop_loss);
        const minRewardDistance = riskDistance * 2;
        const requiredTakeProfit = bid + minRewardDistance;
        if (params.take_profit < requiredTakeProfit) {
          params.take_profit = requiredTakeProfit;
        }
      } else if (params.order_type == "sell") {
        const minStopLoss = ask + minDistanceForStopLoss;
        const minTakeProfit = ask - minDistanceForStopLoss;

        if (params.stop_loss < minStopLoss) params.stop_loss = minStopLoss;
        if (params.take_profit > minTakeProfit)
          params.take_profit = minTakeProfit;

        // Ensure risk:reward ratio of at least 1:2
        const riskDistance = Math.abs(ask - params.stop_loss);
        const minRewardDistance = riskDistance * 2;
        const requiredTakeProfit = ask - minRewardDistance;
        if (params.take_profit > requiredTakeProfit) {
          params.take_profit = requiredTakeProfit;
        }
      }
      params.price = { bid, ask };

      params.spread = spread.toFixed(digits);
      params.stopsLevel = stopsLevel.toFixed(digits);
      params.take_profit = +params.take_profit.toFixed(digits);
      params.stop_loss = +params.stop_loss.toFixed(digits);
    }
    console.log(`<< ${symbol} -> ${JSON.stringify(params)}>>`);
  }

  static async _getTradeParams(symbol, tradeType = "scalp") {
    const systemPrompt = TradePromptGenerator.getSystemPrompt(tradeType);
    const userPrompt = await TradePromptGenerator.getPrompt(symbol, tradeType);

    // Get trade params from two different LLM platforms for confirmation
    const firstParams = await this._getLLMTradeParams(
      systemPrompt,
      userPrompt,
      "gemini"
    );
    if (!this._isValidTradeParams(firstParams)) return null;

    const secondParams = await this._getLLMTradeParams(
      systemPrompt,
      userPrompt,
      "groq"
    );
    if (
      !this._isValidTradeParams(secondParams) ||
      secondParams.order_type !== firstParams.order_type
    ) {
      return null;
    }

    // Log the successful trade parameters
    const model = `${firstParams.model} -> ${secondParams.model}`;
    await this.logTrade({
      symbol,
      tradeType,
      userPrompt,
      response: secondParams.response,
      model,
    });
    secondParams.response = undefined;

    return {
      ...secondParams,
      tradeType,
      symbol,
      model,
    };
  }

  static async _getLLMTradeParams(systemPrompt, userPrompt, platform) {
    const response = await getLLMResponse({
      systemPrompt,
      userPrompt,
      platform,
    });
    const model = this._getModelForPlatform(platform);
    const params = await this.extractTradeParamsFromResponse(response);

    return { ...params, model, response };
  }

  static _getModelForPlatform(platform) {
    if (platform === "gemini")
      return getGeminiModel() || getOpenAIModel() || getGroqModel();
    return getGroqModel() || getGeminiModel() || getOpenAIModel();
  }

  static _isValidTradeParams(params) {
    if (!params) return false;
    return (
      !params.no_trade &&
      ["buy", "sell"].includes(params.order_type) &&
      params.confidence_score >= 7
    );
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
  "stop_loss": number,
  ...
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
      return null;
    }
  }

  static async logTrade({ symbol, tradeType, userPrompt, response, model }) {
    const logPath = LOG_PATH;

    // Ensure log directory exists
    await fs.mkdir(`${logPath}/${symbol}`, { recursive: true });

    const logData = `timestamp: ${new Date().toString()},
symbol: ${symbol}
tradeType: ${tradeType}
model: ${model}
time: ${new Date().toLocaleString()}

prompt: ${userPrompt}

=======

response: ${response}`;

    const fname = `${tradeType}-${Date.now()}`;
    await fs.writeFile(`${logPath}/${symbol}/${fname}.txt`, logData);
    this.cleanupOldLogs(logPath);
  }

  static async cleanupOldLogs() {
    // Store prompt and response for analysis
    const logPath = LOG_PATH;

    // Ensure log directory exists
    await fs.mkdir(logPath, { recursive: true });

    // Keep only files from the last 3 hours
    const files = await fs.readdir(logPath, { recursive: true });
    const maxTime = Date.now() - 7 * 60 * 60 * 1000; // 7 hours ago

    for (const file of files) {
      const dirName = file.split("/")[1];
      if (
        dirName &&
        (await metaTradeAPI.getPositionsBySymbol(dirName)).length
      ) {
        // if there are any positions for this symbol, don't delete the dir
        continue;
      }

      const timestamp = parseInt(file.split("-").pop().replace(".txt", ""));
      if (timestamp < maxTime) {
        // check if file exists
        if (await fs.stat(`${logPath}/${file}`)) {
          await fs.unlink(`${logPath}/${file}`);
        }
      }
    }

    // delete empty dirs
    const dirs = await fs.readdir(logPath, {
      withFileTypes: true,
      recursive: true,
    });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const dirPath = `${logPath}/${dir.name}`;
        const files = await fs.readdir(dirPath);
        if (files.length === 0) {
          await fs.rmdir(dirPath);
        }
      }
    }
  }
}
