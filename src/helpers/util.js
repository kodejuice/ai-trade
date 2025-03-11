

export function getTradingDateNDaysAgo(days) {
  const date = new Date();
  let tradingDaysCount = 0;

  while (tradingDaysCount < days) {
    date.setDate(date.getDate() - 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
      tradingDaysCount++;
    }
  }
  
  return date;
}

export function formatCurrency(value) {
  if (value == null) return null;
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value) {
  if (value == null) return null;
  return Number(value).toLocaleString(undefined, {
    // minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercentageValue(value) {
  if (value == null) return null;
  return `${Number(value).toFixed(2)}%`;
}

export function extractAmountFromText(text) {
  text = text.replace(/[^\d.]/g, '');
  const regex = /\$?(\d+(?:\.\d+)?)/;
  const match = text.match(regex);
  return match ? parseFloat(match[1]) : null;
}

// Computes percentage change between latest and a lagged value.
// Assumes data is sorted in descending order (latest first).
export function computePriceChangePercentage(data, lag) {
  if (!data || data.length <= lag) return null;
  const latest = data.at(-1);
  const previous = data.at(-lag-1);
  if (latest == previous) return '0.00%';
  const change = ((latest.close - previous.close) / previous.close) * 100;
  // infinte check
  if (change === Infinity) return '0.00%';
  return `${change.toFixed(2)}% (${formatCurrency(previous.close)})`;
}


// Function to recursively round values in an object.
export function roundObjectValues(obj, precision = 2) {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'number' ? Number(obj.toFixed(precision)) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => roundObjectValues(item, precision));
  }

  const rounded = {};
  for (const key in obj) {
    rounded[key] = roundObjectValues(obj[key], precision);
  }
  return rounded;
}

export async function waitFor(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function msToTime(ms) {
  if (ms < 0) {
    return '0:00';
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  
  if (hours > 0) {
    return `${hours}h:${minutes.toString().padStart(2, '0')}m:${seconds.padStart(2, '0')}s`;
  }
  return `${minutes}m:${seconds.padStart(2, '0')}s`;
}
