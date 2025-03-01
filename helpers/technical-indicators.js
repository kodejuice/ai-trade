// compute various technical indicators

export const SMA = (data, period) => {
  if (data.length < period) return null;

  // Calculate the most recent SMA assuming the latest data is last
  const sum = data
    .slice(-period)
    .reduce((sum, record) => sum + record.close, 0);
  return sum / period;
};

export const RSI = (data, period = 14) => {
  if (data.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Iterate over the last `period` differences
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  // Prevent division by zero
  if (avgLoss === 0) return 100;

  const RS = avgGain / avgLoss;
  return 100 - 100 / (1 + RS);
};

// Helper function to calculate EMA series
const calculateEMASeries = (data, period) => {
  if (data.length < period) return [];

  const chronologicalData = data.slice();

  // Calculate initial SMA from the first 'period' records (oldest data)
  const sma =
    chronologicalData
      .slice(0, period)
      .reduce((sum, record) => sum + record.close, 0) / period;

  const emaValues = [sma];
  const multiplier = 2 / (period + 1);

  // Calculate EMA for the rest of the records
  for (let i = period; i < chronologicalData.length; i++) {
    const ema =
      chronologicalData[i].close * multiplier +
      emaValues[emaValues.length - 1] * (1 - multiplier);
    emaValues.push(ema);
  }

  return emaValues;
};

// Helper function to calculate single EMA value
export const EMA = (data, period) => {
  const emaSeries = calculateEMASeries(data, period);
  return emaSeries.length > 0 ? emaSeries[emaSeries.length - 1] : null;
};

// Calculate MACD (Moving Average Convergence Divergence)
export const MACD = (
  data,
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9
) => {
  if (data.length < longPeriod + signalPeriod) return null;

  // Calculate EMA series for both periods
  const shortEMASeries = calculateEMASeries(data, shortPeriod);
  const longEMASeries = calculateEMASeries(data, longPeriod);

  // Align the series (since longEMA starts later)
  const shortEMAAligned = shortEMASeries.slice(-longEMASeries.length);

  // Calculate MACD line series
  const macdLineSeries = shortEMAAligned.map(
    (shortEMA, i) => shortEMA - longEMASeries[i]
  );

  // Calculate signal line (EMA of MACD line)
  const macdLineData = macdLineSeries.map((value) => ({ close: value }));
  const signalLineSeries = calculateEMASeries(macdLineData, signalPeriod);

  // Use most recent values
  const macdLine = macdLineSeries[macdLineSeries.length - 1];
  const signalLine = signalLineSeries[signalLineSeries.length - 1];
  const histogram = macdLine - signalLine;

  return {
    macdLine,
    signalLine,
    histogram,
  };
};

// Calculate Bollinger Bands
export const BBAND = (data, period = 20, multiplier = 2) => {
  if (data.length < period) return null;

  // Calculate SMA properly
  const recentData = data.slice(-period);
  const middle =
    recentData.reduce((sum, record) => sum + record.close, 0) / period;

  // Calculate Standard Deviation correctly using population formula (N)
  const sum = recentData.reduce((sum, record) => {
    return sum + Math.pow(record.close - middle, 2);
  }, 0);
  const stdDev = Math.sqrt(sum / period);

  // Calculate Upper and Lower bands
  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;

  return {
    upper,
    middle,
    lower,
  };
};

// Calculate Average True Range (ATR)
export const ATR = (data, period = 14) => {
  if (data.length <= period) return null;

  // Calculate True Range for each period
  const trueRanges = data.slice(1).map((current, index) => {
    const previous = data[index];
    const high = current.high;
    const low = current.low;
    const prevClose = previous.close;

    return Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
  });

  if (trueRanges.length < period) return null;

  // Use consistent calculation method: EMA-style smoothing
  // First ATR is simple average
  let atr =
    trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

  // Smooth using Wilder's method (similar to EMA but with fixed smoothing factor)
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((period - 1) * atr + trueRanges[i]) / period;
  }

  return atr;
};

// Calculate Stochastic Oscillator
export const STOCH = (data, period = 14, smoothK = 3, smoothD = 3) => {
  if (data.length < period + Math.max(smoothK, smoothD)) return null;

  // Calculate raw %K values
  const rawKValues = [];
  for (let i = period - 1; i < data.length; i++) {
    const periodData = data.slice(i - period + 1, i + 1);
    const lowestLow = Math.min(...periodData.map((d) => d.low));
    const highestHigh = Math.max(...periodData.map((d) => d.high));

    // Prevent division by zero
    if (highestHigh === lowestLow) {
      rawKValues.push(50); // Default to middle value if no range
    } else {
      const k = ((data[i].close - lowestLow) / (highestHigh - lowestLow)) * 100;
      rawKValues.push(k);
    }
  }

  // Apply SMA smoothing to get %K
  const kValues = [];
  for (let i = smoothK - 1; i < rawKValues.length; i++) {
    const kPeriod = rawKValues.slice(i - smoothK + 1, i + 1);
    const smoothedK = kPeriod.reduce((sum, k) => sum + k, 0) / smoothK;
    kValues.push(smoothedK);
  }

  // Calculate %D (SMA of %K)
  const dValues = [];
  for (let i = smoothD - 1; i < kValues.length; i++) {
    const dPeriod = kValues.slice(i - smoothD + 1, i + 1);
    const d = dPeriod.reduce((sum, k) => sum + k, 0) / smoothD;
    dValues.push(d);
  }

  // Return most recent values
  return {
    k: kValues[kValues.length - 1],
    d: dValues[dValues.length - 1],
  };
};

// Calculate Volume Weighted Average Price (VWAP)
export const VWAP = (data, resetDaily = true) => {
  if (data.length === 0) return null;

  // Function assumes data has 'date' property if resetDaily is true
  if (resetDaily) {
    // Group data by date
    const dateGroups = {};
    data.forEach((item) => {
      const date =
        typeof item.date === "string"
          ? item.date.split("T")[0]
          : new Date(item.date).toISOString().split("T")[0];
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(item);
    });

    // Calculate VWAP for the most recent date
    const dates = Object.keys(dateGroups).sort();
    const latestDate = dates[dates.length - 1];
    const latestData = dateGroups[latestDate];

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    latestData.forEach((item) => {
      const typicalPrice = (item.high + item.low + item.close) / 3;
      cumulativeTPV += typicalPrice * item.volume;
      cumulativeVolume += item.volume;
    });

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
  } else {
    // Calculate VWAP for entire dataset
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    data.forEach((item) => {
      const typicalPrice = (item.high + item.low + item.close) / 3;
      cumulativeTPV += typicalPrice * item.volume;
      cumulativeVolume += item.volume;
    });

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
  }
};

// Calculate Commodity Channel Index (CCI)
export const CCI = (data, period = 20) => {
  if (data.length < period) return null;

  const recentData = data.slice(-period);

  // Calculate Typical Price for each period
  const typicalPrices = recentData.map((d) => (d.high + d.low + d.close) / 3);

  // Calculate SMA of Typical Prices
  const sma = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;

  // Calculate Mean Deviation
  const meanDeviation =
    typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

  // Avoid division by zero
  if (meanDeviation === 0) return 0;

  // Calculate CCI
  const currentTP = typicalPrices[typicalPrices.length - 1];
  return (currentTP - sma) / (0.015 * meanDeviation);
};

// Calculate CCI as a series (if needed)
export const CCISeries = (data, period = 20) => {
  if (data.length < period) return [];

  const cciValues = [];

  for (let i = period - 1; i < data.length; i++) {
    const periodData = data.slice(i - period + 1, i + 1);

    // Calculate Typical Price for each data point
    const typicalPrices = periodData.map((d) => (d.high + d.low + d.close) / 3);

    // Calculate SMA of Typical Prices
    const sma = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;

    // Calculate Mean Deviation
    const meanDeviation =
      typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    // Avoid division by zero
    if (meanDeviation === 0) {
      cciValues.push(0);
      continue;
    }

    // Calculate CCI
    const currentTP = typicalPrices[typicalPrices.length - 1];
    const cci = (currentTP - sma) / (0.015 * meanDeviation);
    cciValues.push(cci);
  }

  return cciValues;
};

// Calculate On-Balance Volume (OBV)
export const OBV = (data) => {
  if (data.length === 0) return []; // Handle empty input

  const obvValues = [0]; // Start with OBV = 0 for the first day

  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    const currentClose = data[i].close;
    const volume = data[i].volume;

    if (currentClose > prevClose) {
      obvValues.push(obvValues[i - 1] + volume); // Price up: add volume
    } else if (currentClose < prevClose) {
      obvValues.push(obvValues[i - 1] - volume); // Price down: subtract volume
    } else {
      obvValues.push(obvValues[i - 1]); // Price unchanged: keep previous OBV
    }
  }

  return obvValues[obvValues.length - 1]; // Return most recent OBV value
};

export const ADX = (data, period = 14) => {
  if (data.length < period * 2) return null; // Need enough data for smoothing

  // Calculate True Range (TR)
  const calculateTR = (current, previous) => {
    const highLow = current.high - current.low;
    const highPrevClose = Math.abs(current.high - previous.close);
    const lowPrevClose = Math.abs(current.low - previous.close);
    return Math.max(highLow, highPrevClose, lowPrevClose);
  };

  // Calculate Directional Movement (+DM and -DM)
  const calculateDM = (current, previous) => {
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    return { plusDM, minusDM };
  };

  // Initialize sums for the first period (using period values)
  let sumTR = 0;
  let sumPlusDM = 0;
  let sumMinusDM = 0;

  for (let i = 1; i <= period; i++) {
    // Changed condition here
    const tr = calculateTR(data[i], data[i - 1]);
    const { plusDM, minusDM } = calculateDM(data[i], data[i - 1]);
    sumTR += tr;
    sumPlusDM += plusDM;
    sumMinusDM += minusDM;
  }

  // Smooth values using Wilder's method
  let smoothedTR = sumTR;
  let smoothedPlusDM = sumPlusDM;
  let smoothedMinusDM = sumMinusDM;

  const adxValues = [];

  for (let i = period + 1; i < data.length; i++) {
    const tr = calculateTR(data[i], data[i - 1]);
    const { plusDM, minusDM } = calculateDM(data[i], data[i - 1]);

    // Update smoothed values
    smoothedTR = smoothedTR - smoothedTR / period + tr;
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDM;
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDM;

    // Calculate Directional Indicators (DI)
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    // Calculate Directional Index (DX)
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

    adxValues.push(dx);
  }

  // Ensure there are enough DX values to compute ADX
  if (adxValues.length < period) return null;

  // Calculate initial ADX as the simple average of the first period DX values
  let adx =
    adxValues.slice(0, period).reduce((sum, dx) => sum + dx, 0) / period;

  // Smooth ADX using Wilder's method
  for (let i = period; i < adxValues.length; i++) {
    adx = (adx * (period - 1) + adxValues[i]) / period;
  }

  return adx; // Final ADX value
};

// Calculate Money Flow Index (MFI)
export const MFI = (data, period = 14) => {
  if (data.length < period + 1) return null; // Need at least period + 1 data points

  let positiveMF = 0;
  let negativeMF = 0;

  for (let i = 1; i < period + 1; i++) {
    const prevTypicalPrice =
      (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
    const currentTypicalPrice =
      (data[i].high + data[i].low + data[i].close) / 3;
    const rawMoneyFlow = currentTypicalPrice * data[i].volume;

    if (currentTypicalPrice > prevTypicalPrice) {
      positiveMF += rawMoneyFlow; // Price up: add to positive money flow
    } else if (currentTypicalPrice < prevTypicalPrice) {
      negativeMF += rawMoneyFlow; // Price down: add to negative money flow
    }
  }

  // Avoid division by zero: if no negative money flow, return an overbought reading
  if (negativeMF === 0) return 100;

  const moneyFlowRatio = positiveMF / negativeMF;
  const mfi = 100 - 100 / (1 + moneyFlowRatio);

  return mfi; // Final MFI value
};
