// see bottom of page for example data structure

/**
 * Determines if the first dataset is better for scalp trading than the second.
 * @param {Object} data1 - First stock data object
 * @param {Object} data2 - Second stock data object
 * @return {Boolean} - True if data1 is better for scalp trading than data2
 */
export function betterForScalpTrade(data1, data2) {
  // Calculate composite scores for both datasets
  const score1 = calculateScalpScore(data1);
  const score2 = calculateScalpScore(data2);

  // Return true if data1 has a higher scalp score
  return score1 > score2;
}

/**
 * Calculates a composite scalp trading score based on multiple factors
 * @param {Object} data - Stock data object
 * @return {Number} - Composite score for scalp trading suitability
 */
export function calculateScalpScore(data) {
  // Initialize score
  let score = 0;

  // Extract and parse necessary data
  const parsedData = parseStockData(data);
  // console.log("Parsed Data:", parsedData);

  // --- SCORING FACTORS ---

  // 1. Volatility Score (25% weight)
  const volatilityScore = calculateVolatilityScore(parsedData);

  // 2. Volume Analysis (20% weight)
  const volumeScore = calculateVolumeScore(parsedData);

  // 3. Technical Indicators (30% weight)
  const technicalScore = calculateTechnicalScore(parsedData);

  // 4. Momentum Score (15% weight)
  const momentumScore = calculateMomentumScore(parsedData);

  // 5. Sentiment Analysis (10% weight)
  const sentimentScore = calculateSentimentScore(parsedData);

  // Combine weighted scores
  score =
    volatilityScore * 0.25 +
    volumeScore * 0.2 +
    technicalScore * 0.3 +
    momentumScore * 0.15 +
    sentimentScore * 0.1;

  return score;
}

/**
 * Parses and normalizes stock data for analysis
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

  // Parse price metrics
  if (data.priceMetrics) {
    parsed.price.current = parseFloat(
      data.priceMetrics?.currentPrice?.replace("$", "")
    );

    const priceChanges = {
      "5min": data.priceMetrics.priceChange5min,
      "15min": data.priceMetrics.priceChange15min,
      "30min": data.priceMetrics.priceChange30min,
      "1hr": data.priceMetrics.priceChange1hr,
      "3hr": data.priceMetrics.priceChange3hr,
      "7hr": data.priceMetrics.priceChange7hr,
      "1day": data.priceMetrics.priceChange1day,
      "3days": data.priceMetrics.priceChange3days,
      "7days": data.priceMetrics.priceChange7days,
      "30days": data.priceMetrics.priceChange30days,
    };

    // Parse percentage changes
    parsed.price.changes = {};
    for (const [timeframe, change] of Object.entries(priceChanges)) {
      const match = (change || "").match(/([-\+]?\d+\.\d+)%/);
      parsed.price.changes[timeframe] = match ? parseFloat(match[1]) : 0;
    }
  }

  // Parse volume metrics
  if (data.volumeMetrics) {
    parsed.volume.current = parseInt(
      data.volumeMetrics["current volume (15 min)"]?.replace(/,/g, "") || 0
    );
    parsed.volume.averageDaily = parseInt(
      data.volumeMetrics["average volume (10 days)"]?.replace(/,/g, "") || 0
    );
    parsed.volume.regularMarket = parseInt(
      data.volumeMetrics["regular market volume"]?.replace(/,/g, "") || 0
    );
  }

  // Parse technical indicators
  if (data.technicalIndicators && data.technicalIndicators.data) {
    const techs = data.technicalIndicators.data;
    parsed.technical = {
      ma10hr: techs.movingAverage10hr,
      ma24hr: techs.movingAverage24hr,
      rsi: techs.RSI,
      macd: techs.MACD.MACD,
      macdSignal: techs.MACD.signal,
      macdHistogram: techs.MACD.histogram,
      atr: techs.ATR,
      ema10hr: techs.EMA10hr,
      bbMiddle: techs.BBANDS.middle,
      bbUpper: techs.BBANDS.upper,
      bbLower: techs.BBANDS.lower,
      bbPB: techs.BBANDS.pb,
      vwap: parseFloat(techs.VWAP),
      adx: techs.ADX.adx,
      pdi: techs.ADX.pdi,
      mdi: techs.ADX.mdi,
      stochK: techs.STOCH.k,
      stochD: techs.STOCH.d,
      cci: techs.CCI,
      obv: parseInt(techs.OBV.replace(/,/g, "")),
      mfi: techs.MFI,
      ema5: techs.EMA5,
      ema9: techs.EMA9,
      ema20: techs.EMA20,
      ema50: techs.EMA50,
      sma50: techs.SMA50,
    };
  }

  // Parse fundamentals
  if (data.fundamentals) {
    parsed.fundamentals.marketStatus = data.fundamentals.marketStatus?.state;

    // Parse market cap
    if (data.fundamentals.valuation?.marketCap) {
      parsed.fundamentals.marketCap = parseFloat(
        data.fundamentals.valuation.marketCap.replace(/[^\d.]/g, "")
      );
    }

    // Parse beta
    if (data.fundamentals.valuation?.Beta) {
      parsed.fundamentals.beta = parseFloat(data.fundamentals.valuation.Beta);
    }
  }

  // Parse sentiment data
  if (data.recent_news) {
    parsed.sentiment.overall = data.recent_news.overallSentiment;

    const sentimentScores = {
      Bullish: 1,
      "Somewhat Bullish": 0.5,
      Neutral: 0,
      "Somewhat Bearish": -0.5,
      Bearish: -1,
    };

    // Count sentiment distribution
    parsed.sentiment.distribution = {
      bullish: 0,
      neutral: 0,
      bearish: 0,
    };

    // Process news items
    if (data.recent_news.news) {
      data.recent_news.news.forEach((item) => {
        if (item.sentimentLabel === "Bullish")
          parsed.sentiment.distribution.bullish++;
        else if (item.sentimentLabel === "Neutral")
          parsed.sentiment.distribution.neutral++;
        else if (item.sentimentLabel === "Bearish")
          parsed.sentiment.distribution.bearish++;
      });

      // Calculate avg news sentiment score
      const newsSentiments = data.recent_news.news.map(
        (item) => sentimentScores[item.sentimentLabel] || 0
      );

      parsed.sentiment.newsScore =
        newsSentiments.length > 0
          ? newsSentiments.reduce((sum, score) => sum + score, 0) /
            newsSentiments.length
          : 0;
    }
  }

  return parsed;
}

/**
 * Calculates volatility score for scalp trading
 * @param {Object} data - Parsed stock data
 * @return {Number} - Volatility score (0-100)
 */
function calculateVolatilityScore(data) {
  if (!data.price || !data.price.changes) return 50; // Default score

  // Extract short-term price changes
  const shortTermChanges = [
    Math.abs(data.price.changes["5min"] || 0),
    Math.abs(data.price.changes["15min"] || 0),
    Math.abs(data.price.changes["30min"] || 0),
    Math.abs(data.price.changes["1hr"] || 0),
  ];

  // Calculate average short-term volatility
  const avgShortTermVolatility =
    shortTermChanges.reduce((sum, val) => sum + val, 0) /
    shortTermChanges.length;

  // Calculate ATR relative to price (normalize volatility)
  const atrPercent =
    data.technical && data.technical.atr
      ? (data.technical.atr / data.price.current) * 100
      : 0;

  // Ideal scalping volatility is moderate (not too low or too high)
  // Score peaks around 0.8-2.0% short-term moves and tails off on both ends
  let volatilityScore = 0;

  // Short-term price movement score (0-60 points)
  if (avgShortTermVolatility < 0.1) {
    volatilityScore += avgShortTermVolatility * 300; // Linear increase up to 0.1%
  } else if (avgShortTermVolatility < 1.0) {
    volatilityScore += 30 + (avgShortTermVolatility - 0.1) * 30; // Linear increase from 0.1% to 1.0%
  } else if (avgShortTermVolatility < 3.0) {
    volatilityScore += 60 - (avgShortTermVolatility - 1.0) * 15; // Linear decrease from 1.0% to 3.0%
  } else {
    volatilityScore += 30 - (avgShortTermVolatility - 3.0) * 5; // Steep decrease above 3.0%
    volatilityScore = Math.max(0, volatilityScore); // Floor at 0
  }

  // ATR score (0-40 points)
  let atrScore = 0;
  if (atrPercent < 0.1) {
    atrScore = atrPercent * 200; // Linear increase up to 0.1%
  } else if (atrPercent < 1.0) {
    atrScore = 20 + (atrPercent - 0.1) * 15; // Linear increase from 0.1% to 1.0%
  } else if (atrPercent < 3.0) {
    atrScore = 35 + (atrPercent - 1.0) * 2.5; // Slower increase from 1.0% to 3.0%
  } else {
    atrScore = 40 - (atrPercent - 3.0) * 8; // Decrease above 3.0%
    atrScore = Math.max(0, atrScore); // Floor at 0
  }

  // Combine scores
  return volatilityScore * 0.6 + atrScore * 0.4;
}

/**
 * Calculates volume score for scalp trading
 * @param {Object} data - Parsed stock data
 * @return {Number} - Volume score (0-100)
 */
function calculateVolumeScore(data) {
  if (!data.volume) return 50; // Default score

  let volumeScore = 0;
  const { current, averageDaily, regularMarket } = data.volume;

  // 1. Current Volume vs Average Volume ratio (0-50 points)
  // Higher relative volume is better for scalping
  const currentToAvgRatio =
    current && averageDaily ? current / (averageDaily / 24) : 0; // Compare to hourly average

  if (currentToAvgRatio < 0.5) {
    volumeScore += currentToAvgRatio * 40; // Linear increase up to 0.5x
  } else if (currentToAvgRatio < 2.0) {
    volumeScore += 20 + (currentToAvgRatio - 0.5) * 20; // Linear increase from 0.5x to 2.0x
  } else if (currentToAvgRatio < 5.0) {
    volumeScore += 50 - (currentToAvgRatio - 2.0) * 5; // Slow decrease from 2.0x to 5.0x
  } else {
    volumeScore += 35 - (currentToAvgRatio - 5.0) * 3; // Steeper decrease above 5.0x
    volumeScore = Math.max(0, volumeScore); // Floor at 0
  }

  // 2. Absolute Volume Score (0-30 points)
  // Higher absolute volume reduces slippage
  let absoluteVolumeScore = 0;
  if (current < 10000) {
    absoluteVolumeScore = (current / 10000) * 5; // Very low volume
  } else if (current < 100000) {
    absoluteVolumeScore = 5 + ((current - 10000) / 90000) * 10; // Low volume
  } else if (current < 1000000) {
    absoluteVolumeScore = 15 + ((current - 100000) / 900000) * 10; // Medium volume
  } else if (current < 10000000) {
    absoluteVolumeScore = 25 + ((current - 1000000) / 9000000) * 5; // High volume
  } else {
    absoluteVolumeScore = 30; // Very high volume
  }

  // 3. Regular Market Volume vs Average (0-20 points)
  // Higher daily volume indicates better liquidity
  const regularToAvgRatio =
    regularMarket && averageDaily ? regularMarket / averageDaily : 0;

  let marketVolumeScore = 0;
  if (regularToAvgRatio < 0.5) {
    marketVolumeScore = regularToAvgRatio * 20; // Linear increase up to 0.5x
  } else if (regularToAvgRatio < 1.5) {
    marketVolumeScore = 10 + (regularToAvgRatio - 0.5) * 10; // Linear increase from 0.5x to 1.5x
  } else {
    marketVolumeScore = 20; // Max score for > 1.5x
  }

  // Combine scores
  return volumeScore + absoluteVolumeScore + marketVolumeScore;
}

/**
 * Calculates technical indicator score for scalp trading
 * @param {Object} data - Parsed stock data
 * @return {Number} - Technical score (0-100)
 */
function calculateTechnicalScore(data) {
  if (!data.technical) return 50; // Default score

  const tech = data.technical;
  let technicalScore = 0;

  // 1. RSI Analysis (0-20 points)
  let rsiScore = 0;
  if (tech.rsi !== undefined) {
    // Ideal RSI range for scalping: 40-80 (bullish bias)
    if (tech.rsi >= 30 && tech.rsi <= 70) {
      // Perfect range for scalping - neither overbought nor oversold
      rsiScore = 15;

      // Bonus for bullish momentum (50-70 range)
      if (tech.rsi >= 50 && tech.rsi <= 70) {
        rsiScore += 5;
      }
    } else if (tech.rsi > 70 && tech.rsi <= 80) {
      // Overbought but still momentum
      rsiScore = 10;
    } else if (tech.rsi > 80) {
      // Extremely overbought
      rsiScore = 5;
    } else if (tech.rsi >= 20 && tech.rsi < 30) {
      // Oversold but potential reversal opportunity
      rsiScore = 10;
    } else {
      // Extremely oversold
      rsiScore = 5;
    }
  }

  // 2. MACD Analysis (0-15 points)
  let macdScore = 0;
  if (
    tech.macd !== undefined &&
    tech.macdSignal !== undefined &&
    tech.macdHistogram !== undefined
  ) {
    // MACD crossing above signal line (bullish)
    if (tech.macdHistogram > 0 && tech.macdHistogram < 0.2) {
      macdScore = 15; // Recent bullish crossover
    } else if (tech.macdHistogram > 0.2) {
      macdScore = 10; // Established bullish trend
    } else if (tech.macdHistogram < 0 && tech.macdHistogram > -0.2) {
      macdScore = 5; // Recent bearish crossover
    } else {
      macdScore = 0; // Established bearish trend
    }
  }

  // 3. Bollinger Bands Analysis (0-15 points)
  let bbandsScore = 0;
  if (
    tech.bbMiddle !== undefined &&
    tech.bbUpper !== undefined &&
    tech.bbLower !== undefined &&
    tech.bbPB !== undefined &&
    data.price.current
  ) {
    const price = data.price.current;

    // Calculate relative position within bands
    if (tech.bbPB !== undefined) {
      const pbValue = tech.bbPB;

      // Ideal scalping zone: 0.2 to 0.8 within bands
      if (pbValue >= 0.2 && pbValue <= 0.8) {
        bbandsScore = 15; // Ideal position within bands
      } else if (pbValue > 0.8 && pbValue <= 1.0) {
        bbandsScore = 10; // Near upper band, potential resistance
      } else if (pbValue >= 0 && pbValue < 0.2) {
        bbandsScore = 10; // Near lower band, potential support
      } else if (pbValue > 1.0) {
        bbandsScore = 5; // Above upper band, potential reversal
      } else {
        bbandsScore = 5; // Below lower band, potential reversal
      }
    }
  }

  // 4. EMA Analysis (0-15 points)
  let emaScore = 0;
  if (
    tech.ema5 !== undefined &&
    tech.ema9 !== undefined &&
    tech.ema20 !== undefined &&
    data.price.current
  ) {
    const price = data.price.current;

    // Check EMA alignments and price position
    const priceAboveEma5 = price > tech.ema5;
    const priceAboveEma9 = price > tech.ema9;
    const priceAboveEma20 = price > tech.ema20;
    const ema5AboveEma9 = tech.ema5 > tech.ema9;
    const ema9AboveEma20 = tech.ema9 > tech.ema20;

    // Perfect bullish alignment: Price > EMA5 > EMA9 > EMA20
    if (priceAboveEma5 && ema5AboveEma9 && ema9AboveEma20) {
      emaScore = 15; // Strong bullish trend
    } else if (priceAboveEma5 && priceAboveEma9) {
      emaScore = 10; // Moderate bullish trend
    } else if (priceAboveEma5) {
      emaScore = 5; // Weak bullish trend
    } else {
      emaScore = 0; // Bearish trend
    }
  }

  // 5. ADX Analysis (0-15 points)
  let adxScore = 0;
  if (
    tech.adx !== undefined &&
    tech.pdi !== undefined &&
    tech.mdi !== undefined
  ) {
    // ADX strength
    if (tech.adx >= 25) {
      // Strong trend
      adxScore += 5;

      // Directional indicator analysis
      if (tech.pdi > tech.mdi) {
        // Bullish trend
        const pdiDominance = tech.pdi - tech.mdi;

        if (pdiDominance >= 10) {
          adxScore += 10; // Strong bullish trend
        } else {
          adxScore += 5; // Moderate bullish trend
        }
      } else {
        // Bearish trend
        adxScore += 0;
      }
    } else if (tech.adx >= 15) {
      // Moderate trend
      adxScore += 3;

      if (tech.pdi > tech.mdi) {
        adxScore += 3; // Moderate bullish trend
      }
    } else {
      // Weak trend
      adxScore += 0;
    }
  }

  // 6. Stochastic Analysis (0-10 points)
  let stochScore = 0;
  if (tech.stochK !== undefined && tech.stochD !== undefined) {
    // Stochastic position
    if (tech.stochK >= 20 && tech.stochK <= 80) {
      stochScore += 5; // Not in extreme territory

      // Bullish crossover or bullish position
      if (tech.stochK > tech.stochD && tech.stochK <= 80) {
        stochScore += 5; // Bullish signal
      }
    } else if (tech.stochK < 20) {
      stochScore += 3; // Oversold, potential reversal

      if (tech.stochK > tech.stochD) {
        stochScore += 2; // Bullish crossover from oversold
      }
    }
  }

  // 7. VWAP Analysis (0-10 points)
  let vwapScore = 0;
  if (tech.vwap !== undefined && data.price.current) {
    const price = data.price.current;

    // Price relative to VWAP
    if (price > tech.vwap) {
      // Price above VWAP (bullish)
      const vwapDistance = (price / tech.vwap - 1) * 100;

      if (vwapDistance <= 2) {
        vwapScore = 10; // Price just above VWAP, good entry
      } else if (vwapDistance <= 5) {
        vwapScore = 5; // Price moderately above VWAP
      } else {
        vwapScore = 0; // Price far above VWAP, extended
      }
    } else {
      vwapScore = 0; // Price below VWAP (bearish)
    }
  }

  // Combine all technical scores
  technicalScore =
    rsiScore +
    macdScore +
    bbandsScore +
    emaScore +
    adxScore +
    stochScore +
    vwapScore;

  // Normalize to 0-100 scale
  return technicalScore;
}

/**
 * Calculates momentum score for scalp trading
 * @param {Object} data - Parsed stock data
 * @return {Number} - Momentum score (0-100)
 */
function calculateMomentumScore(data) {
  if (!data.price || !data.price.changes) return 50; // Default score

  const changes = data.price.changes;
  let momentumScore = 0;

  // 1. Short-term momentum (last hour) - 40 points
  const shortTermChanges = [
    changes["5min"] || 0,
    changes["15min"] || 0,
    changes["30min"] || 0,
    changes["1hr"] || 0,
  ];

  const avgShortTermChange =
    shortTermChanges.reduce((sum, val) => sum + val, 0) /
    shortTermChanges.length;

  // Score short-term momentum
  if (avgShortTermChange > 0.5) {
    momentumScore += 40; // Strong positive momentum
  } else if (avgShortTermChange > 0.2) {
    momentumScore += 30; // Moderate positive momentum
  } else if (avgShortTermChange > 0) {
    momentumScore += 20; // Weak positive momentum
  } else if (avgShortTermChange > -0.2) {
    momentumScore += 10; // Weak negative momentum
  } else {
    momentumScore += 0; // Strong negative momentum
  }

  // 2. Medium-term momentum (last few hours) - 30 points
  const mediumTermChanges = [
    changes["1hr"] || 0,
    changes["3hr"] || 0,
    changes["7hr"] || 0,
  ];

  const avgMediumTermChange =
    mediumTermChanges.reduce((sum, val) => sum + val, 0) /
    mediumTermChanges.length;

  // Score medium-term momentum
  if (avgMediumTermChange > 1.0) {
    momentumScore += 30; // Strong positive momentum
  } else if (avgMediumTermChange > 0.5) {
    momentumScore += 25; // Moderate positive momentum
  } else if (avgMediumTermChange > 0) {
    momentumScore += 15; // Weak positive momentum
  } else if (avgMediumTermChange > -0.5) {
    momentumScore += 10; // Weak negative momentum
  } else {
    momentumScore += 0; // Strong negative momentum
  }

  // 3. Momentum direction continuity - 30 points
  // Check if momentum is consistent across timeframes
  const timeframes = ["5min", "15min", "30min", "1hr", "3hr"];
  const directions = timeframes.map((tf) => Math.sign(changes[tf] || 0));

  // Count positive and negative momentum periods
  const positiveCount = directions.filter((dir) => dir > 0).length;
  const negativeCount = directions.filter((dir) => dir < 0).length;

  // Calculate continuity as dominance of one direction
  const continuityRatio =
    Math.max(positiveCount, negativeCount) / timeframes.length;

  // Score continuity (higher is better for scalping)
  if (continuityRatio >= 0.8) {
    momentumScore += 30; // Strong continuity
  } else if (continuityRatio >= 0.6) {
    momentumScore += 20; // Moderate continuity
  } else {
    momentumScore += 10; // Weak continuity (mixed signals)
  }

  // Normalize to 0-100
  return momentumScore;
}

/**
 * Calculates sentiment score for scalp trading
 * @param {Object} data - Parsed stock data
 * @return {Number} - Sentiment score (0-100)
 */
function calculateSentimentScore(data) {
  if (!data.sentiment) return 50; // Default score

  let sentimentScore = 0;

  // 1. Overall sentiment rating (0-50 points)
  if (data.sentiment.overall) {
    const overallSentiment = data.sentiment.overall;

    if (overallSentiment === "Bullish") {
      sentimentScore += 50;
    } else if (overallSentiment === "Neutral") {
      sentimentScore += 25;
    } else if (overallSentiment === "Bearish") {
      sentimentScore += 0;
    }
  }

  // 2. News sentiment analysis (0-30 points)
  if (data.sentiment.distribution) {
    const { bullish, neutral, bearish } = data.sentiment.distribution;
    const total = bullish + neutral + bearish;

    if (total > 0) {
      // Calculate bullish ratio
      const bullishRatio = bullish / total;

      // Score based on bullish news ratio
      if (bullishRatio >= 0.75) {
        sentimentScore += 30; // Extremely bullish news
      } else if (bullishRatio >= 0.5) {
        sentimentScore += 20; // Moderately bullish news
      } else if (bullishRatio >= 0.25) {
        sentimentScore += 10; // Slightly bullish news
      } else {
        sentimentScore += 0; // Bearish news
      }
    }
  }

  // 3. News sentiment score (0-20 points)
  if (data.sentiment.newsScore !== undefined) {
    // Convert -1 to 1 scale to 0-20
    sentimentScore += (data.sentiment.newsScore + 1) * 10;
  }

  // Normalize to 0-100
  return sentimentScore;
}




/*
Example data:

{
 "priceMetrics": {
  "currentPrice": "$120.75",
  "priceChange5min": "-0.02% ($120.78)",
  "priceChange15min": "-0.02% ($120.78)",
  "priceChange30min": "0.09% ($120.65)",
  "priceChange1hr": "0.31% ($120.39)",
  "priceChange3hr": "0.08% ($120.66)",
  "priceChange7hr": "1.81% ($118.61)",
  "priceChange1day": "4.48% ($115.58)",
  "priceChange3days": "11.03% ($108.76)",
  "priceChange7days": "2.95% ($117.30)",
  "priceChange30days": "-3.12% ($124.65)"
 },
 "volumeMetrics": {
  "current volume (15 min)": "5,262,859",
  "average volume (10 days)": "348,907,250",
  "regular market volume": "202,628,893"
 },
 "technicalIndicators": {
  "timeFrame": "15min (latest)",
  "data": {
   "movingAverage10hr": 118.5,
   "movingAverage24hr": 115.25,
   "RSI": 62.58,
   "MACD": {
    "MACD": 0.77,
    "signal": 0.95,
    "histogram": -0.19
   },
   "ATR": 0.75,
   "EMA10hr": 118.84,
   "BBANDS": {
    "middle": 120.55,
    "upper": 121.56,
    "lower": 119.55,
    "pb": 0.61
   },
   "VWAP": "112.85",
   "ADX": {
    "adx": 32.94,
    "pdi": 23.9,
    "mdi": 12.82
   },
   "STOCH": {
    "k": 37.57,
    "d": 25.79
   },
   "CCI": 32.48,
   "OBV": "110,549,617",
   "MFI": 36.62,
   "EMA5": 120.59,
   "EMA9": 120.55,
   "EMA20": 120.07,
   "EMA50": 118.25,
   "SMA50": 117.96
  }
 },
 "fundamentals": {
  "marketStatus": {
   "state": "regular"
  },
  "priceRanges": {
   "Day's Range": "$118.15 - $121.88",
   "52 Week Range": "$75.61 - $153.13",
   "50Day Average": "$129.61",
   "200Day Average": "$127.56"
  },
  "valuation": {
   "TrailingPE": "41.08",
   "ForwardPE": "29.32",
   "PE Ratio (TTM)": "41.08",
   "Beta (5Y Monthly)": "1.76",
   "marketCap": "$2,947,153,920,000.00"
  },
  "financials": {
   "EPS (TTM)": "$2.94",
   "Revenue": "$130,497,003,520.00",
   "Profit Margin": "0.56%",
   "Return On Equity": "1.19%",
   "Revenue Growth": "0.78%",
   "DividendYield": "0.03%"
  },
  "marketPricing": {
   "Regular Market Change Percent": "0.05%",
   "Regular Market Price": "$120.79",
   "bid/ask": {
    "bid": "$0.00",
    "ask": "$0.00",
    "bid size": 0,
    "ask size": 0
   }
  }
 },
 "recent_news": {
  "overallSentiment": "Bullish",
  "news": [
   {
    "title": "NVIDIA (NasdaqGS:NVDA) Unveils AI-Powered Gaming Breakthroughs With RTX Neural Rendering Advances",
    "summary": "*   NVIDIA announced advancements in RTX neural rendering technologies and a partnership with Microsoft to integrate neural shading into Microsoft DirectX.\n*   NVIDIA's stock surged 4.5% on Friday, while the overall market declined 4%.\n*   NVIDIA's stock price movement of 3% over the past week.\n*   NVIDIA's net income in 2024 was US$29.76 billion.\n*   NVIDIA's performance in the past year outpaced both the US market's 6.6% return and the 11.8% achieved by the US Semiconductor industry.\n*   NVIDIA share buybacks totaled around US$62.55 billion from October 2024 to January 2025.\n",
    "sentimentLabel": "Bullish",
    "date": "14/03/2025, 18:29:48",
    "timeAgo": "about 1 hour ago"
   },
   {
    "title": "Nvidia (NVDA) Analysts See AI-Driven Rebound Ahead of GTC Conference",
    "summary": "*   **AI Impact on Valuation:** Successful AI strategies can increase a company's value by up to 19%, while poor execution can lead to a 9% loss.\n*   **Nvidia (NVDA) Outlook:**\n    *   Wells Fargo analyst Aaron Rakes sees the recent decline in NVDA shares as a \"buying opportunity,\" maintaining an \"Overweight\" rating and a $185 price target.\n    *   The GPU Technology Conference (GTC) next week could trigger a recovery rally based on historical performance.\n    *   Key topics at GTC could include co-package optics, Blackwell Ultra (GB300), and post-training/test-time scaling for inferencing.\n*   **Hedge Fund Activity:** The article mentions that the selected AI stocks are popular among hedge funds.\n",
    "sentimentLabel": "Bullish",
    "date": "14/03/2025, 16:58:05",
    "timeAgo": "about 3 hours ago"
   },
   {
    "title": "Jim Cramer: ‘NVIDIA (NVDA) Trades Like a Meme Stock’ – What’s Next?",
    "summary": "*   Jim Cramer advised against exiting the market entirely, stating markets historically rebound.\n*   He suggested considering buying during market downturns, focusing on strong companies.\n*   Cramer noted that NVIDIA (NVDA) is trading like a meme stock.\n*   He mentioned NVDA's recent positive earnings report.\n*   The article suggests AI stocks may offer higher returns than NVDA in a shorter time frame.\n*   NVDA ranked 2nd on the list of stocks Jim Cramer discussed.\n*   Hedge fund sentiment for each stock was provided as of Q4 2024.\n",
    "sentimentLabel": "Neutral",
    "date": "14/03/2025, 16:43:34",
    "timeAgo": "about 3 hours ago"
   }
  ]
 }
}
*/

