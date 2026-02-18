import { Trade, EvalPrice, IntradayData } from '../types/trade';

// Volatility by product type (basis points per 15-min interval)
const PRODUCT_VOLATILITY: Record<string, number> = {
  'US Treasury': 0.0002,           // 2 bps - very stable
  'Investment Grade Corp': 0.0005, // 5 bps - moderate
  'High Yield Corp': 0.0015,       // 15 bps - volatile
  'Municipal': 0.0003,             // 3 bps - stable
  'Agency MBS': 0.0004,            // 4 bps - moderate
};

// Generate a random number from a normal distribution (Box-Muller transform)
function randomNormal(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Generate intraday eval prices for a CUSIP using random walk
 * @param cusip - The CUSIP identifier
 * @param tradeDate - The trade date (YYYY-MM-DD)
 * @param basePrice - The base price to start around
 * @param product - Product type for volatility lookup
 * @returns Array of 41 eval prices (7:00 AM to 5:00 PM, 15-min intervals)
 */
export function generateIntradayEvalPrices(
  cusip: string,
  tradeDate: string,
  basePrice: number,
  product: string
): EvalPrice[] {
  const evalPrices: EvalPrice[] = [];
  const volatility = PRODUCT_VOLATILITY[product] || 0.0005;

  // Start price with small random offset from base
  let currentPrice = basePrice * (1 + randomNormal(0, 0.002));

  // Parse the trade date
  const dateParts = tradeDate.split('-');
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dateParts[2]);

  // 7:00 AM to 5:00 PM = 10 hours = 40 intervals at 15 min each (41 points total)
  for (let i = 0; i <= 40; i++) {
    const hour = 7 + Math.floor(i / 4);
    const minute = (i % 4) * 15;

    // Create timestamp for this eval point
    const evalTime = new Date(year, month, day, hour, minute, 0, 0);

    evalPrices.push({
      cusip,
      timestamp: evalTime.toISOString(),
      price: Math.round(currentPrice * 1000000) / 1000000, // 6 decimal precision
    });

    // Random walk for next price (skip on last iteration)
    if (i < 40) {
      // Add some mean reversion tendency towards base price
      const meanReversion = (basePrice - currentPrice) * 0.01;
      const randomChange = randomNormal(0, volatility * basePrice);
      currentPrice += meanReversion + randomChange;

      // Ensure price doesn't go negative or too far from base
      currentPrice = Math.max(currentPrice, basePrice * 0.95);
      currentPrice = Math.min(currentPrice, basePrice * 1.05);
    }
  }

  return evalPrices;
}

/**
 * Get complete intraday data for a trade, including all trades for that CUSIP on the same day
 * @param selectedTrade - The trade that was double-clicked
 * @param allTrades - All trades in the blotter
 * @returns IntradayData object with eval prices and all related trades
 */
export function getIntradayDataForTrade(
  selectedTrade: Trade,
  allTrades: Trade[]
): IntradayData {
  const { cusip, ticker, tradeDate, cleanPrice, product } = selectedTrade;

  // Generate eval prices for this CUSIP/date
  const evalPrices = generateIntradayEvalPrices(cusip, tradeDate, cleanPrice, product);

  // Find all trades with the same CUSIP on the same date
  const relatedTrades = allTrades
    .filter(trade => trade.cusip === cusip && trade.tradeDate === tradeDate)
    .map(trade => ({
      tradeId: trade.internalTradeId,
      executionTimestamp: trade.executionTimestamp,
      executionPrice: trade.cleanPrice,
      side: trade.side,
    }));

  return {
    cusip,
    ticker,
    tradeDate,
    evalPrices,
    trades: relatedTrades,
  };
}

/**
 * Find the eval price closest to a given timestamp
 * @param evalPrices - Array of eval prices
 * @param timestamp - The execution timestamp to find
 * @returns The closest eval price or undefined
 */
export function findClosestEvalPrice(
  evalPrices: EvalPrice[],
  timestamp: string
): EvalPrice | undefined {
  if (evalPrices.length === 0) return undefined;

  const targetTime = new Date(timestamp).getTime();

  let closest = evalPrices[0];
  let minDiff = Math.abs(new Date(closest.timestamp).getTime() - targetTime);

  for (const evalPrice of evalPrices) {
    const diff = Math.abs(new Date(evalPrice.timestamp).getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = evalPrice;
    }
  }

  return closest;
}
