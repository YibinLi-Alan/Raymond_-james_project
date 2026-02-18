import { Trade, TradeSide, PriceType, YieldType } from '../types/trade';
import {
  getBClassForProduct,
  getTickerForClassification,
  getSectorFromBClass,
} from './bclassTaxonomy';

// Reference data for generating realistic trades
const COUNTERPARTIES = [
  { id: 'CP001', name: 'BlackRock' },
  { id: 'CP002', name: 'Vanguard' },
  { id: 'CP003', name: 'Fidelity' },
  { id: 'CP004', name: 'State Street' },
  { id: 'CP005', name: 'PIMCO' },
  { id: 'CP006', name: 'JPMorgan Asset Mgmt' },
  { id: 'CP007', name: 'Goldman Sachs AM' },
  { id: 'CP008', name: 'Morgan Stanley IM' },
  { id: 'CP009', name: 'Wellington Mgmt' },
  { id: 'CP010', name: 'Capital Group' },
  { id: 'CP011', name: 'T. Rowe Price' },
  { id: 'CP012', name: 'Prudential' },
  { id: 'CP013', name: 'MetLife Investment' },
  { id: 'CP014', name: 'Citadel' },
  { id: 'CP015', name: 'Two Sigma' },
];

const PRODUCTS = [
  'US Treasury',
  'Investment Grade Corp',
  'High Yield Corp',
  'Municipal',
  'Agency MBS',
];

const TENORS = ['2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

// Desk reference data (used via TRADERS mapping)
const _DESKS = [
  { id: 'RATES-NYC', name: 'Rates - New York' },
  { id: 'RATES-LON', name: 'Rates - London' },
  { id: 'CREDIT-NYC', name: 'Credit - New York' },
  { id: 'CREDIT-LON', name: 'Credit - London' },
  { id: 'MUNI-NYC', name: 'Municipals - New York' },
];
void _DESKS; // Available for future desk name lookups

const TRADERS = [
  { id: 'TR001', desk: 'RATES-NYC' },
  { id: 'TR002', desk: 'RATES-NYC' },
  { id: 'TR003', desk: 'RATES-LON' },
  { id: 'TR004', desk: 'CREDIT-NYC' },
  { id: 'TR005', desk: 'CREDIT-NYC' },
  { id: 'TR006', desk: 'CREDIT-LON' },
  { id: 'TR007', desk: 'MUNI-NYC' },
  { id: 'TR008', desk: 'MUNI-NYC' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CAD: 0.74,
};

// Utility functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 6): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTradeId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'TRD-';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateVenueId(): string | undefined {
  // 70% chance of having a venue ID (electronic execution)
  if (Math.random() > 0.7) return undefined;
  const venues = ['BBG', 'TRWB', 'MKT', 'ICE'];
  return `${randomElement(venues)}-${randomInt(100000, 999999)}`;
}

// Generate CUSIP (9 characters: 6 issuer + 2 issue + 1 check digit)
function generateCusip(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let cusip = '';
  // 6-character issuer code (alphanumeric)
  for (let i = 0; i < 6; i++) {
    cusip += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 2-character issue number (numeric)
  cusip += randomInt(10, 99).toString();
  // 1-character check digit (numeric)
  cusip += randomInt(0, 9).toString();
  return cusip;
}

// Get coupon based on product characteristics and tenor
function getCouponForProduct(product: string, tenor: string): number {
  const tenorYears = parseInt(tenor.replace('Y', '')) || 5;

  switch (product) {
    case 'US Treasury':
      // Treasury coupons: lower, increase slightly with tenor
      return randomFloat(2.5 + tenorYears * 0.08, 4.5 + tenorYears * 0.08, 3);
    case 'Investment Grade Corp':
      // IG corps: moderate spreads over treasuries
      return randomFloat(3.5 + tenorYears * 0.1, 5.5 + tenorYears * 0.12, 3);
    case 'High Yield Corp':
      // High yield: wider coupons
      return randomFloat(6.0 + tenorYears * 0.1, 9.0 + tenorYears * 0.15, 3);
    case 'Municipal':
      // Munis: tax-exempt so lower nominal rates
      return randomFloat(2.0 + tenorYears * 0.05, 4.0 + tenorYears * 0.08, 3);
    case 'Agency MBS':
      // MBS: based on mortgage rates
      return randomFloat(3.5, 6.5, 3);
    default:
      return randomFloat(3.0, 5.0, 3);
  }
}

function getProductPriceRange(product: string): { min: number; max: number } {
  switch (product) {
    case 'US Treasury':
      return { min: 95, max: 105 };
    case 'Investment Grade Corp':
      return { min: 90, max: 110 };
    case 'High Yield Corp':
      return { min: 75, max: 105 };
    case 'Municipal':
      return { min: 92, max: 108 };
    case 'Agency MBS':
      return { min: 98, max: 103 };
    default:
      return { min: 95, max: 105 };
  }
}

function getProductYieldRange(product: string): { min: number; max: number } {
  switch (product) {
    case 'US Treasury':
      return { min: 3.5, max: 5.0 };
    case 'Investment Grade Corp':
      return { min: 4.5, max: 6.5 };
    case 'High Yield Corp':
      return { min: 7.0, max: 12.0 };
    case 'Municipal':
      return { min: 3.0, max: 5.0 };
    case 'Agency MBS':
      return { min: 4.0, max: 5.5 };
    default:
      return { min: 4.0, max: 6.0 };
  }
}

function getNotionalRange(product: string): { min: number; max: number } {
  switch (product) {
    case 'US Treasury':
      return { min: 5_000_000, max: 500_000_000 };
    case 'Investment Grade Corp':
      return { min: 1_000_000, max: 50_000_000 };
    case 'High Yield Corp':
      return { min: 500_000, max: 25_000_000 };
    case 'Municipal':
      return { min: 100_000, max: 10_000_000 };
    case 'Agency MBS':
      return { min: 5_000_000, max: 100_000_000 };
    default:
      return { min: 1_000_000, max: 50_000_000 };
  }
}

function getTraderForProduct(product: string): typeof TRADERS[0] {
  const deskPrefix = product === 'Municipal' ? 'MUNI'
    : (product === 'US Treasury' || product === 'Agency MBS') ? 'RATES'
    : 'CREDIT';

  const eligibleTraders = TRADERS.filter(t => t.desk.startsWith(deskPrefix));
  return randomElement(eligibleTraders.length > 0 ? eligibleTraders : TRADERS);
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function generateTrade(tradeDate: Date, _index: number): Trade {
  const counterparty = randomElement(COUNTERPARTIES);
  const product = randomElement(PRODUCTS);
  const tenor = randomElement(TENORS);
  const side: TradeSide = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const trader = getTraderForProduct(product);

  // Generate BCLASS classification based on product and tenor
  const bclass = getBClassForProduct(product, tenor);
  const cusip = generateCusip();
  const ticker = getTickerForClassification(bclass);
  const coupon = getCouponForProduct(product, tenor);
  const sector = getSectorFromBClass(bclass);

  // Currency - mostly USD, some foreign
  const tradeCurrency = Math.random() > 0.85 ? randomElement(CURRENCIES) : 'USD';
  const fxRate = FX_RATES[tradeCurrency];

  // Notional
  const notionalRange = getNotionalRange(product);
  const notional = Math.round(randomInt(notionalRange.min, notionalRange.max) / 100000) * 100000;
  const notionalUsd = notional * fxRate;

  // Pricing
  const priceRange = getProductPriceRange(product);
  const cleanPrice = randomFloat(priceRange.min, priceRange.max, 6);

  const yieldRange = getProductYieldRange(product);
  const yieldValue = randomFloat(yieldRange.min, yieldRange.max, 6);

  // Accrued interest (simplified: 0-3% of notional)
  const accruedInterestAmount = randomFloat(0, notional * 0.03, 2);

  // Gross and net amounts
  const grossTradeAmount = (cleanPrice / 100) * notional + accruedInterestAmount;
  const netMoney = grossTradeAmount; // Simplified - no fees in mock

  // Timestamps
  const executionHour = randomInt(7, 17);
  const executionMinute = randomInt(0, 59);
  const executionSecond = randomInt(0, 59);
  const executionMs = randomInt(0, 999);

  const executionDate = new Date(tradeDate);
  executionDate.setHours(executionHour, executionMinute, executionSecond, executionMs);

  // Entry time is usually within minutes of execution
  const entryDate = new Date(executionDate.getTime() + randomInt(1000, 300000));

  // Settlement date (T+1 for Treasuries, T+2 for others)
  const settlementDays = product === 'US Treasury' ? 1 : 2;
  const settlementDate = addBusinessDays(tradeDate, settlementDays);

  // Calculate maturity date based on tenor
  const tenorYears = parseInt(tenor.replace('Y', '')) || 5;
  const maturityDate = new Date(tradeDate);
  maturityDate.setFullYear(maturityDate.getFullYear() + tenorYears);
  // Add some randomness (±6 months) to make it realistic
  maturityDate.setMonth(maturityDate.getMonth() + randomInt(-6, 6));
  const timeToMaturityYears = tenorYears + randomFloat(-0.5, 0.5, 2);

  return {
    // Identity
    internalTradeId: generateTradeId(),
    venueExecutionId: generateVenueId(),
    regulatoryReportId: Math.random() > 0.1 ? `TRACE-${randomInt(10000000, 99999999)}` : undefined,
    parentTradeId: undefined,
    allocationId: undefined,

    // Temporal
    tradeDate: formatDate(tradeDate),
    executionTimestamp: formatTimestamp(executionDate),
    originalEntryTime: formatTimestamp(entryDate),
    settlementDate: formatDate(settlementDate),

    // Economics
    notional,
    quantityTypeCode: 'PAR',
    cleanPrice,
    priceType: 'PERCENTAGE' as PriceType,
    yield: yieldValue,
    yieldType: 'YTM' as YieldType,
    accruedInterestAmount,
    grossTradeAmount,
    netMoney,

    // Parties
    counterpartyId: counterparty.id,
    counterpartyName: counterparty.name,
    executingBrokerId: undefined,
    traderId: trader.id,
    deskId: trader.desk,

    // Instrument
    product,
    tenor,
    side,
    maturityDate: formatDate(maturityDate),
    timeToMaturityYears,

    // Security Identifiers
    cusip,
    ticker,
    coupon,
    sector,

    // BCLASS Hierarchy
    bclassLevel1: bclass.level1,
    bclassLevel2: bclass.level2,
    bclassLevel3: bclass.level3,
    bclassLevel4: bclass.level4,

    // Currency
    tradeCurrency,
    settlementCurrency: 'USD',
    fxRate: tradeCurrency !== 'USD' ? fxRate : undefined,
    notionalUsd,
  };
}

export function generateMockTrades(count: number = 2000, daysBack: number = 1): Trade[] {
  const trades: Trade[] = [];
  const today = new Date();

  // Find the last trading day (skip weekends)
  let lastTradingDay = new Date(today);
  lastTradingDay.setDate(lastTradingDay.getDate() - 1);
  while (lastTradingDay.getDay() === 0 || lastTradingDay.getDay() === 6) {
    lastTradingDay.setDate(lastTradingDay.getDate() - 1);
  }

  // Generate trades across the specified number of days
  const tradesPerDay = Math.ceil(count / daysBack);

  for (let day = 0; day < daysBack; day++) {
    let tradeDate = new Date(lastTradingDay);
    tradeDate.setDate(tradeDate.getDate() - day);

    // Skip weekends
    while (tradeDate.getDay() === 0 || tradeDate.getDay() === 6) {
      tradeDate.setDate(tradeDate.getDate() - 1);
    }

    const dayTradeCount = day === daysBack - 1
      ? count - trades.length
      : Math.min(tradesPerDay, count - trades.length);

    for (let i = 0; i < dayTradeCount && trades.length < count; i++) {
      trades.push(generateTrade(tradeDate, trades.length));
    }
  }

  // Sort by execution timestamp descending
  trades.sort((a, b) =>
    new Date(b.executionTimestamp).getTime() - new Date(a.executionTimestamp).getTime()
  );

  return trades;
}

// Pre-generate trades for immediate use (10 trading days for chart)
export const mockTrades = generateMockTrades(2500, 10);
