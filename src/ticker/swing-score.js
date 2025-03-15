/**
 * Determines if the first stock data is better for swing trading than the second
 * @param {Object} data1 - First stock data object
 * @param {Object} data2 - Second stock data object
 * @return {Boolean} - True if data1 is better for swing trading, false otherwise
 */
export function betterForSwingTrade(data1, data2) {
  const score1 = calculateSwingScore(data1);
  const score2 = calculateSwingScore(data2);

  return score1 > score2;
}

/**
 * Calculates a composite swing trading score based on multiple factors
 * @param {Object} data - Stock data object
 * @return {Number} - Composite score for swing trading suitability
 */
export function calculateSwingScore(data) {
  // Initialize score
  let score = 0;

  // Extract and parse necessary data
  const parsedData = parseStockData(data);
  // console.log("Parsed Data:", parsedData);

  // --- SCORING FACTORS ---

  // 1. Price Momentum Analysis (30% of total score)
  const momentumScore = analyzeRecentMomentum(parsedData);

  // 2. Technical Indicator Analysis (40% of total score)
  const technicalScore = analyzeTechnicalIndicators(parsedData);

  // 3. Volume Analysis (15% of total score)
  const volumeScore = analyzeVolume(parsedData);

  // 4. Fundamental Analysis (10% of total score)
  const fundamentalScore = analyzeFundamentals(parsedData);

  // 5. Sentiment Analysis (5% of total score)
  const sentimentScore = analyzeSentiment(parsedData);

  // Combine scores with updated weights
  score =
    momentumScore * 0.3 +
    technicalScore * 0.4 +
    volumeScore * 0.15 +
    fundamentalScore * 0.1 +
    sentimentScore * 0.05;

  // Scale to 0-100 range
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Parses string values from stock data into numbers for analysis
 * @param {Object} data - Raw stock data object
 * @return {Object} - Parsed data object with numeric values
 */
function parseStockData(data) {
  const parsed = {
    price: {},
    volume: {},
    technical: {},
    fundamentals: {},
    sentiment: {},
  };

  // Parse price data
  if (data.priceMetrics) {
    parsed.price.current = parseFloatFromCurrency(
      data.priceMetrics.currentPrice
    );

    // Parse price changes
    const priceChangeKeys = [
      "priceChange5min",
      "priceChange15min",
      "priceChange30min",
      "priceChange1hr",
      "priceChange3hr",
      "priceChange7hr",
      "priceChange1day",
      "priceChange3days",
      "priceChange7days",
      "priceChange30days",
    ];

    parsed.price.changes = {};
    priceChangeKeys.forEach((key) => {
      if (data.priceMetrics[key]) {
        parsed.price.changes[key] = parsePercentageValue(
          data.priceMetrics[key]
        );
      }
    });
  }

  // Parse volume data
  if (data.volumeMetrics) {
    parsed.volume.current = parseIntFromFormattedNumber(
      data.volumeMetrics["current volume (15 min)"]
    );
    parsed.volume.average10days = parseIntFromFormattedNumber(
      data.volumeMetrics["average volume (10 days)"]
    );
    parsed.volume.regularMarket = parseIntFromFormattedNumber(
      data.volumeMetrics["regular market volume"]
    );
  }

  // Parse technical indicators
  if (data.technicalIndicators && data.technicalIndicators.data) {
    const technicalData = data.technicalIndicators.data;

    // Direct number assignments
    parsed.technical.RSI = technicalData.RSI;
    parsed.technical.MA10 = technicalData.movingAverage10hr;
    parsed.technical.MA24 = technicalData.movingAverage24hr;
    parsed.technical.ATR = technicalData.ATR;
    parsed.technical.EMA10 = technicalData.EMA10hr;
    parsed.technical.CCI = technicalData.CCI;
    parsed.technical.MFI = technicalData.MFI;
    parsed.technical.EMA5 = technicalData.EMA5;
    parsed.technical.EMA9 = technicalData.EMA9;
    parsed.technical.EMA20 = technicalData.EMA20;
    parsed.technical.EMA50 = technicalData.EMA50;
    parsed.technical.SMA50 = technicalData.SMA50;

    // Nested objects
    if (technicalData.MACD) {
      parsed.technical.MACD = { ...technicalData.MACD };
    }

    if (technicalData.BBANDS) {
      parsed.technical.BBANDS = { ...technicalData.BBANDS };
    }

    if (technicalData.ADX) {
      parsed.technical.ADX = { ...technicalData.ADX };
    }

    if (technicalData.STOCH) {
      parsed.technical.STOCH = { ...technicalData.STOCH };
    }

    // Parse string values
    parsed.technical.VWAP = parseFloatFromCurrency(technicalData.VWAP);
    parsed.technical.OBV = parseIntFromFormattedNumber(technicalData.OBV);
  }

  // Parse fundamentals
  if (data.fundamentals) {
    parsed.fundamentals.marketStatus = data.fundamentals.marketStatus?.state;

    // Parse price ranges
    if (data.fundamentals.priceRanges) {
      parsed.fundamentals.ranges = {};

      if (data.fundamentals.priceRanges["Day's Range"]) {
        const [low, high] =
          data.fundamentals.priceRanges["Day's Range"].split(" - ");
        parsed.fundamentals.ranges.dayLow = parseFloatFromCurrency(low);
        parsed.fundamentals.ranges.dayHigh = parseFloatFromCurrency(high);
      }

      if (data.fundamentals.priceRanges["52 Week Range"]) {
        const [low, high] =
          data.fundamentals.priceRanges["52 Week Range"].split(" - ");
        parsed.fundamentals.ranges.yearLow = parseFloatFromCurrency(low);
        parsed.fundamentals.ranges.yearHigh = parseFloatFromCurrency(high);
      }

      parsed.fundamentals.ma50day = parseFloatFromCurrency(
        data.fundamentals.priceRanges["50Day Average"]
      );
      parsed.fundamentals.ma200day = parseFloatFromCurrency(
        data.fundamentals.priceRanges["200Day Average"]
      );
    }

    // Parse valuation metrics
    if (data.fundamentals.valuation) {
      parsed.fundamentals.valuation = {};
      parsed.fundamentals.valuation.trailingPE = parseFloat(
        data.fundamentals.valuation.TrailingPE
      );
      parsed.fundamentals.valuation.forwardPE = parseFloat(
        data.fundamentals.valuation.ForwardPE
      );
      parsed.fundamentals.valuation.peRatio = parseFloat(
        data.fundamentals.valuation["PE Ratio (TTM)"]
      );
      parsed.fundamentals.valuation.beta = parseFloat(
        data.fundamentals.valuation["Beta (5Y Monthly)"]
      );
      parsed.fundamentals.valuation.marketCap = parseFloatFromCurrency(
        data.fundamentals.valuation.marketCap
      );
    }

    // Parse financial metrics
    if (data.fundamentals.financials) {
      parsed.fundamentals.financials = {};
      parsed.fundamentals.financials.eps = parseFloatFromCurrency(
        data.fundamentals.financials["EPS (TTM)"]
      );
      parsed.fundamentals.financials.revenue = parseFloatFromCurrency(
        data.fundamentals.financials.Revenue
      );
      parsed.fundamentals.financials.profitMargin = parsePercentageValue(
        data.fundamentals.financials["Profit Margin"]
      );
      parsed.fundamentals.financials.roe = parsePercentageValue(
        data.fundamentals.financials["Return On Equity"]
      );
      parsed.fundamentals.financials.revenueGrowth = parsePercentageValue(
        data.fundamentals.financials["Revenue Growth"]
      );
      parsed.fundamentals.financials.dividendYield = parsePercentageValue(
        data.fundamentals.financials["DividendYield"]
      );
    }
  }

  // Parse sentiment and news
  if (data.recent_news) {
    parsed.sentiment = {
      overall: data.recent_news.overallSentiment,
      newsCount: data.recent_news.news ? data.recent_news.news.length : 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
    };

    // Count news sentiment
    if (data.recent_news.news && Array.isArray(data.recent_news.news)) {
      data.recent_news.news.forEach((newsItem) => {
        if (newsItem.sentimentLabel === "Bullish") {
          parsed.sentiment.bullishCount++;
        } else if (newsItem.sentimentLabel === "Bearish") {
          parsed.sentiment.bearishCount++;
        } else {
          parsed.sentiment.neutralCount++;
        }
      });
    }
  }

  return parsed;
}

/**
 * Analyzes price momentum for swing trading potential
 * @param {Object} data - Parsed stock data
 * @return {Number} - Score from 0-100 for momentum factor
 */
function analyzeRecentMomentum(data) {
  let momentumScore = 50; // Neutral starting point

  if (!data.price || !data.price.changes) {
    return momentumScore;
  }

  // Check for short-term momentum (1-7 days) - heavily weighted
  if (data.price.changes.priceChange1day) {
    if (data.price.changes.priceChange1day > 2) {
      momentumScore += 15; // Strong positive momentum
    } else if (data.price.changes.priceChange1day > 0.5) {
      momentumScore += 10; // Moderate positive momentum
    } else if (data.price.changes.priceChange1day < -3) {
      momentumScore -= 10; // Potential overselling, might be good for swing
    } else if (data.price.changes.priceChange1day < -0.5) {
      momentumScore -= 5;
    }
  }

  if (data.price.changes.priceChange3days) {
    if (data.price.changes.priceChange3days > 5) {
      momentumScore += 10;
    } else if (data.price.changes.priceChange3days > 2) {
      momentumScore += 5;
    } else if (data.price.changes.priceChange3days < -5) {
      momentumScore -= 5;
    }
  }

  // Medium-term trends (7-30 days)
  if (data.price.changes.priceChange7days) {
    // Higher weight for medium-term trend in swing trading
    if (data.price.changes.priceChange7days > 5) {
      momentumScore += 10;
    } else if (data.price.changes.priceChange7days > 2) {
      momentumScore += 5;
    } else if (data.price.changes.priceChange7days < -8) {
      momentumScore += 5; // Oversold condition, potential for rebound
    } else if (data.price.changes.priceChange7days < -3) {
      momentumScore -= 5;
    }
  }

  // Longer-term trend - context for the swing
  if (data.price.changes.priceChange30days) {
    if (data.price.changes.priceChange30days > 10) {
      momentumScore += 5; // Strong uptrend
    } else if (data.price.changes.priceChange30days < -15) {
      momentumScore -= 10; // Strong downtrend
    }
  }

  // Check for intraday momentum patterns (recent hours)
  let recentUpticks = 0;
  let recentDownticks = 0;

  [
    "priceChange5min",
    "priceChange15min",
    "priceChange30min",
    "priceChange1hr",
    "priceChange3hr",
  ].forEach((key) => {
    if (data.price.changes[key] > 0.1) {
      recentUpticks++;
    } else if (data.price.changes[key] < -0.1) {
      recentDownticks++;
    }
  });

  // Scoring for intraday patterns
  if (recentUpticks >= 4) {
    momentumScore += 10; // Strong intraday momentum
  } else if (recentUpticks >= 3) {
    momentumScore += 5;
  } else if (recentDownticks >= 4) {
    momentumScore -= 10;
  } else if (recentDownticks >= 3) {
    momentumScore -= 5;
  }

  // Analyze reversal patterns (good for swing trading)
  const hasShortTermReversal =
    (data.price.changes.priceChange30days < 0 &&
      data.price.changes.priceChange7days > 0) ||
    (data.price.changes.priceChange7days < 0 &&
      data.price.changes.priceChange1day > 0);

  if (hasShortTermReversal) {
    momentumScore += 15; // Potential trend reversal is good for swing trading
  }

  // Ensure score is within 0-100 range
  return Math.min(Math.max(momentumScore, 0), 100);
}

/**
 * Analyzes technical indicators for swing trading signals
 * @param {Object} data - Parsed stock data
 * @return {Number} - Score from 0-100 for technical factors
 */
function analyzeTechnicalIndicators(data) {
  let technicalScore = 50; // Neutral starting point

  if (!data.technical) {
    return technicalScore;
  }

  // RSI Analysis (Relative Strength Index)
  if (data.technical.RSI !== undefined) {
    if (data.technical.RSI < 30) {
      technicalScore += 15; // Oversold, potential buying opportunity
    } else if (data.technical.RSI > 70) {
      technicalScore -= 15; // Overbought, potential selling opportunity
    } else if (data.technical.RSI > 55 && data.technical.RSI < 65) {
      technicalScore += 10; // Strong but not overbought
    }
  }

  // MACD Analysis (Moving Average Convergence Divergence)
  if (data.technical.MACD) {
    // Bullish MACD crossover
    if (
      data.technical.MACD.MACD > data.technical.MACD.signal &&
      data.technical.MACD.histogram > 0 &&
      Math.abs(data.technical.MACD.histogram) < 0.1
    ) {
      technicalScore += 15; // Recent bullish crossover
    }
    // Bearish MACD crossover
    else if (
      data.technical.MACD.MACD < data.technical.MACD.signal &&
      data.technical.MACD.histogram < 0 &&
      Math.abs(data.technical.MACD.histogram) < 0.1
    ) {
      technicalScore -= 10;
    }
    // MACD above zero line - bullish
    else if (data.technical.MACD.MACD > 0 && data.technical.MACD.signal > 0) {
      technicalScore += 5;
    }
  }

  // Moving Average Analysis
  if (data.technical.EMA5 !== undefined && data.technical.EMA20 !== undefined) {
    // Golden Cross (short term MA crossing above long term MA)
    if (
      data.technical.EMA5 > data.technical.EMA20 &&
      data.technical.EMA5 / data.technical.EMA20 - 1 < 0.01
    ) {
      // Recent cross
      technicalScore += 15;
    }
    // Death Cross (short term MA crossing below long term MA)
    else if (
      data.technical.EMA5 < data.technical.EMA20 &&
      data.technical.EMA20 / data.technical.EMA5 - 1 < 0.01
    ) {
      technicalScore -= 10;
    }
  }

  // Bollinger Bands
  if (data.technical.BBANDS) {
    // Price near lower band (potential bounce)
    if (data.price.current < data.technical.BBANDS.lower * 1.02) {
      technicalScore += 15;
    }
    // Price near upper band (potential reversal)
    else if (data.price.current > data.technical.BBANDS.upper * 0.98) {
      technicalScore -= 10;
    }
    // Bollinger Band Squeeze (low volatility - often precedes big moves)
    if (
      (data.technical.BBANDS.upper - data.technical.BBANDS.lower) /
        data.technical.BBANDS.middle <
      0.05
    ) {
      technicalScore += 10;
    }
  }

  // ADX (Average Directional Index) - trend strength
  if (data.technical.ADX) {
    if (data.technical.ADX.adx > 25) {
      // Strong trend
      if (data.technical.ADX.pdi > data.technical.ADX.mdi) {
        technicalScore += 10; // Strong uptrend
      } else {
        technicalScore -= 5; // Strong downtrend
      }
    } else if (data.technical.ADX.adx < 20) {
      // Weak trend/ranging market - can be good for reversal swing trades
      technicalScore += 5;
    }
  }

  // Stochastic Oscillator
  if (data.technical.STOCH) {
    // Oversold
    if (data.technical.STOCH.k < 20 && data.technical.STOCH.d < 20) {
      technicalScore += 10;
    }
    // Overbought
    else if (data.technical.STOCH.k > 80 && data.technical.STOCH.d > 80) {
      technicalScore -= 10;
    }
    // Bullish crossover
    else if (
      data.technical.STOCH.k > data.technical.STOCH.d &&
      data.technical.STOCH.k < 50
    ) {
      technicalScore += 10; // Bullish crossover in non-overbought territory
    }
  }

  // MFI (Money Flow Index) - volume-weighted RSI
  if (data.technical.MFI !== undefined) {
    if (data.technical.MFI < 20) {
      technicalScore += 10; // Oversold with volume confirmation
    } else if (data.technical.MFI > 80) {
      technicalScore -= 10; // Overbought with volume confirmation
    }
  }

  // Major Moving Average Relationships
  if (
    data.technical.EMA50 !== undefined &&
    data.fundamentals?.ma200day !== undefined
  ) {
    // Price above both major MAs
    if (
      data.price.current > data.technical.EMA50 &&
      data.price.current > data.fundamentals.ma200day
    ) {
      technicalScore += 5; // Confirmed uptrend
    }
    // Price below both major MAs
    else if (
      data.price.current < data.technical.EMA50 &&
      data.price.current < data.fundamentals.ma200day
    ) {
      technicalScore -= 5; // Confirmed downtrend
    }
  }

  // Ensure score is within 0-100 range
  return Math.min(Math.max(technicalScore, 0), 100);
}

/**
 * Analyzes volume patterns for swing trading signals
 * @param {Object} data - Parsed stock data
 * @return {Number} - Score from 0-100 for volume factors
 */
function analyzeVolume(data) {
  let volumeScore = 50; // Neutral starting point

  if (!data.volume) {
    return volumeScore;
  }

  // Volume relative to average
  if (data.volume.current && data.volume.average10days) {
    const volumeRatio = data.volume.current / (data.volume.average10days / 10); // Compare to daily average

    if (volumeRatio > 2 && data.price.changes.priceChange1day > 0) {
      volumeScore += 20; // High volume breakout
    } else if (volumeRatio > 1.5 && data.price.changes.priceChange1day > 0) {
      volumeScore += 15; // Above average volume on up day
    } else if (volumeRatio > 2 && data.price.changes.priceChange1day < 0) {
      volumeScore -= 15; // High volume selloff
    } else if (volumeRatio < 0.7) {
      volumeScore -= 5; // Low volume - less conviction
    }
  }

  // On-Balance Volume (OBV) trend
  if (data.technical.OBV !== undefined) {
    // We don't have historical OBV to compare directly, so use relative to price movement
    if (data.price.changes.priceChange7days > 2 && data.technical.OBV > 0) {
      volumeScore += 10; // OBV confirms price rise
    } else if (
      data.price.changes.priceChange7days < -2 &&
      data.technical.OBV < 0
    ) {
      volumeScore -= 10; // OBV confirms price drop
    } else if (
      data.price.changes.priceChange7days < 0 &&
      data.technical.OBV > 0
    ) {
      volumeScore += 15; // OBV divergence - bullish
    } else if (
      data.price.changes.priceChange7days > 0 &&
      data.technical.OBV < 0
    ) {
      volumeScore -= 15; // OBV divergence - bearish
    }
  }

  // Regular Market Volume vs Current
  if (data.volume.regularMarket && data.volume.current) {
    const marketVolumeRatio = data.volume.current / data.volume.regularMarket;

    if (marketVolumeRatio > 0.3) {
      // High concentration of volume in recent period
      volumeScore += 10;
    }
  }

  // Ensure score is within 0-100 range
  return Math.min(Math.max(volumeScore, 0), 100);
}

/**
 * Analyzes fundamental factors for swing trading potential
 * @param {Object} data - Parsed stock data
 * @return {Number} - Score from 0-100 for fundamental factors
 */
function analyzeFundamentals(data) {
  let fundamentalScore = 50; // Neutral starting point

  if (!data.fundamentals) {
    return fundamentalScore;
  }

  // Fundamental strength evaluation
  if (data.fundamentals.valuation && data.fundamentals.financials) {
    const f = data.fundamentals.valuation;
    const financials = data.fundamentals.financials;

    // Valuation metrics
    if (f.peRatio > 0) {
      fundamentalScore += (50 - f.peRatio) * 0.2; // Lower PE better
    }

    if (financials.revenueGrowth > 0) {
      fundamentalScore += financials.revenueGrowth * 2;
    }

    if (financials.profitMargin > 0) {
      fundamentalScore += financials.profitMargin * 100;
    }

    if (f.beta > 0) {
      fundamentalScore -= f.beta * 0.5;
    }

    if (financials.dividendYield > 0) {
      fundamentalScore += financials.dividendYield * 50;
    }

    // Market position
    if (f.marketCap !== undefined && f.marketCap > 1e9) {
      fundamentalScore += Math.log10(f.marketCap / 1e9); // Size premium
    }
  }

  // Additional fundamental factors

  // Price to 50-day MA ratio
  if (data.fundamentals.ma50day && data.price.current) {
    const priceTo50MA = data.price.current / data.fundamentals.ma50day;

    if (priceTo50MA < 0.95) {
      fundamentalScore += 10; // Price below 50-day MA - potential value
    } else if (priceTo50MA > 1.1) {
      fundamentalScore -= 5; // Price significantly above 50-day MA
    }
  }

  // Price to 200-day MA ratio
  if (data.fundamentals.ma200day && data.price.current) {
    const priceTo200MA = data.price.current / data.fundamentals.ma200day;

    if (priceTo200MA < 0.9) {
      fundamentalScore += 15; // Price well below 200-day MA - potential value
    } else if (priceTo200MA > 1.2) {
      fundamentalScore -= 10; // Price significantly above 200-day MA
    }
  }

  // 52-week range position
  if (
    data.fundamentals.ranges &&
    data.fundamentals.ranges.yearLow &&
    data.fundamentals.ranges.yearHigh &&
    data.price.current
  ) {
    const yearRange =
      data.fundamentals.ranges.yearHigh - data.fundamentals.ranges.yearLow;
    const positionInRange =
      (data.price.current - data.fundamentals.ranges.yearLow) / yearRange;

    if (positionInRange < 0.3) {
      fundamentalScore += 15; // Near 52-week low - potential value
    } else if (positionInRange > 0.8) {
      fundamentalScore -= 10; // Near 52-week high - less value
    }
  }

  // Ensure score is within 0-100 range
  return Math.min(Math.max(fundamentalScore, 0), 100);
}

/**
 * Analyzes market sentiment for swing trading signals
 * @param {Object} data - Parsed stock data
 * @return {Number} - Score from 0-100 for sentiment factors
 */
function analyzeSentiment(data) {
  let sentimentScore = 50; // Neutral starting point

  if (!data.sentiment) {
    return sentimentScore;
  }

  // Overall sentiment analysis
  if (data.sentiment.overall) {
    if (data.sentiment.overall === "Bullish") {
      sentimentScore += 15;
    } else if (data.sentiment.overall === "Bearish") {
      sentimentScore -= 15;
    }
  }

  // News sentiment ratio
  if (data.sentiment.newsCount > 0) {
    const bullishRatio = data.sentiment.bullishCount / data.sentiment.newsCount;
    const bearishRatio = data.sentiment.bearishCount / data.sentiment.newsCount;

    if (bullishRatio > 0.6) {
      sentimentScore += 15; // Majority bullish news
    } else if (bearishRatio > 0.6) {
      sentimentScore -= 15; // Majority bearish news
    } else if (bullishRatio > 0.4 && bearishRatio < 0.3) {
      sentimentScore += 10; // More bullish than bearish
    } else if (bearishRatio > 0.4 && bullishRatio < 0.3) {
      sentimentScore -= 10; // More bearish than bullish
    }
  }

  // Mixed news can sometimes be good for swing trading
  if (data.sentiment.bullishCount > 0 && data.sentiment.bearishCount > 0) {
    const hasMixedOpinions =
      data.sentiment.bullishCount >= 1 && data.sentiment.bearishCount >= 1;
    if (hasMixedOpinions) {
      sentimentScore += 5; // Mixed opinions can create volatility good for swings
    }
  }

  // Ensure score is within 0-100 range
  return Math.min(Math.max(sentimentScore, 0), 100);
}

/**
 * Helper function to parse percentage strings like "10.5%" or "0.08% ($120.84)" to numbers
 * @param {String} percentageStr - Percentage value as string
 * @return {Number} - Parsed percentage as number
 */
function parsePercentageValue(percentageStr) {
  if (!percentageStr) return 0;

  try {
    // Extract the percentage part (handles formats like "0.08% ($120.84)")
    const matches = percentageStr.match(/([-+]?\d+\.?\d*)%/);
    if (matches && matches[1]) {
      return parseFloat(matches[1]);
    }
    return 0;
  } catch (e) {
    console.error("Error parsing percentage:", e);
    return 0;
  }
}

/**
 * Helper function to parse currency strings like "$120.93" to numbers
 * @param {String} currencyStr - Currency value as string
 * @return {Number} - Parsed value as number
 */
function parseFloatFromCurrency(currencyStr) {
  if (!currencyStr) return 0;

  try {
    // Remove currency symbols, commas, and other non-numeric chars except decimal point and minus
    return parseFloat(currencyStr.replace(/[^0-9.-]/g, ""));
  } catch (e) {
    console.error("Error parsing currency:", e);
    return 0;
  }
}

/**
 * Helper function to parse formatted large numbers like "4,012,876" to integers
 * @param {String} numberStr - Formatted number as string
 * @return {Number} - Parsed value as number
 */
function parseIntFromFormattedNumber(numberStr) {
  if (!numberStr) return 0;

  try {
    // Remove commas and other non-numeric chars except decimal point and minus
    return parseInt(numberStr.replace(/[^0-9.-]/g, ""));
  } catch (e) {
    console.error("Error parsing formatted number:", e);
    return 0;
  }
}
