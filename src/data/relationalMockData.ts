import { Trade, TradeSide, PriceType, YieldType } from '../types/trade';
import {
  getBClassForProduct,
  getTickerForClassification,
  getSectorFromBClass,
} from './bclassTaxonomy';

// ============================================================================
// RELATIONAL DATABASE SCHEMA
// ============================================================================

// Table: Counterparties
export interface Counterparty {
  id: string;
  name: string;
  lei?: string; // Legal Entity Identifier
  type: 'ASSET_MANAGER' | 'HEDGE_FUND' | 'BANK' | 'INSURANCE' | 'PENSION';
  tier: 1 | 2 | 3; // Client tier for relationship management
}

// Table: Desks
export interface Desk {
  id: string;
  name: string;
  location: 'NYC' | 'LON' | 'HKG' | 'TOK';
  assetClass: 'RATES' | 'CREDIT' | 'MUNI' | 'SECURITIZED';
}

// Table: Traders
export interface Trader {
  id: string;
  name: string;
  deskId: string; // Foreign key to Desks
  email: string;
  hireDate: string;
}

// Table: Securities
export interface Security {
  cusip: string; // Primary key
  isin?: string;
  ticker: string;
  issuerName: string;
  product: string;
  tenor: string;
  coupon: number;
  maturityDate: string;
  issueDate: string;
  sector: string;
  // BCLASS Hierarchy
  bclassLevel1: string;
  bclassLevel2: string;
  bclassLevel3: string;
  bclassLevel4: string;
  // Additional attributes
  rating?: string;
  callableFlag: boolean;
  putableFlag: boolean;
}

// Table: Trades (main transaction table)
export interface TradeRecord {
  // Primary Key
  internalTradeId: string;

  // Foreign Keys
  cusip: string; // FK to Securities
  counterpartyId: string; // FK to Counterparties
  traderId: string; // FK to Traders
  executingBrokerId?: string; // FK to Counterparties (broker)

  // Trade Identification
  venueExecutionId?: string;
  regulatoryReportId?: string;
  parentTradeId?: string; // FK to Trades (for allocations)
  allocationId?: string;

  // Temporal
  tradeDate: string;
  executionTimestamp: string;
  originalEntryTime: string;
  settlementDate: string;

  // Economics
  side: TradeSide;
  notional: number;
  quantityTypeCode: 'PAR';
  cleanPrice: number;
  priceType: PriceType;
  yield?: number;
  yieldType?: YieldType;
  accruedInterestAmount: number;
  grossTradeAmount: number;
  netMoney: number;

  // Currency
  tradeCurrency: string;
  settlementCurrency: string;
  fxRate?: number;
  notionalUsd: number;
}

// ============================================================================
// REFERENCE DATA (Static Tables)
// ============================================================================

export const COUNTERPARTIES: Counterparty[] = [
  { id: 'CP001', name: 'BlackRock', lei: 'BLACKROCK123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP002', name: 'Vanguard', lei: 'VANGUARD123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP003', name: 'Fidelity', lei: 'FIDELITY123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP004', name: 'State Street', lei: 'STATESTR123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP005', name: 'PIMCO', lei: 'PIMCO12345678901', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP006', name: 'JPMorgan Asset Mgmt', lei: 'JPMORGAN123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP007', name: 'Goldman Sachs AM', lei: 'GOLDMANS123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP008', name: 'Morgan Stanley IM', lei: 'MORGANST123456789', type: 'ASSET_MANAGER', tier: 1 },
  { id: 'CP009', name: 'Wellington Mgmt', lei: 'WELLINGTON12345678', type: 'ASSET_MANAGER', tier: 2 },
  { id: 'CP010', name: 'Capital Group', lei: 'CAPITALG123456789', type: 'ASSET_MANAGER', tier: 2 },
  { id: 'CP011', name: 'T. Rowe Price', lei: 'TROWEPRI123456789', type: 'ASSET_MANAGER', tier: 2 },
  { id: 'CP012', name: 'Prudential', lei: 'PRUDENTIA123456789', type: 'INSURANCE', tier: 2 },
  { id: 'CP013', name: 'MetLife Investment', lei: 'METLIFE1234567890', type: 'INSURANCE', tier: 2 },
  { id: 'CP014', name: 'Citadel', lei: 'CITADEL1234567890', type: 'HEDGE_FUND', tier: 1 },
  { id: 'CP015', name: 'Two Sigma', lei: 'TWOSIGMA123456789', type: 'HEDGE_FUND', tier: 1 },
];

export const DESKS: Desk[] = [
  { id: 'RATES-NYC', name: 'Rates Trading - New York', location: 'NYC', assetClass: 'RATES' },
  { id: 'RATES-LON', name: 'Rates Trading - London', location: 'LON', assetClass: 'RATES' },
  { id: 'CREDIT-NYC', name: 'Credit Trading - New York', location: 'NYC', assetClass: 'CREDIT' },
  { id: 'CREDIT-LON', name: 'Credit Trading - London', location: 'LON', assetClass: 'CREDIT' },
  { id: 'MUNI-NYC', name: 'Municipals - New York', location: 'NYC', assetClass: 'MUNI' },
  { id: 'SECURITIZED-NYC', name: 'Securitized Products - New York', location: 'NYC', assetClass: 'SECURITIZED' },
];

export const TRADERS: Trader[] = [
  { id: 'TR001', name: 'Alice Johnson', deskId: 'RATES-NYC', email: 'alice.johnson@firm.com', hireDate: '2018-03-15' },
  { id: 'TR002', name: 'Bob Smith', deskId: 'RATES-NYC', email: 'bob.smith@firm.com', hireDate: '2019-07-22' },
  { id: 'TR003', name: 'Charlie Brown', deskId: 'RATES-LON', email: 'charlie.brown@firm.com', hireDate: '2017-01-10' },
  { id: 'TR004', name: 'Diana Prince', deskId: 'CREDIT-NYC', email: 'diana.prince@firm.com', hireDate: '2020-05-03' },
  { id: 'TR005', name: 'Ethan Hunt', deskId: 'CREDIT-NYC', email: 'ethan.hunt@firm.com', hireDate: '2016-11-12' },
  { id: 'TR006', name: 'Fiona Gallagher', deskId: 'CREDIT-LON', email: 'fiona.gallagher@firm.com', hireDate: '2019-09-08' },
  { id: 'TR007', name: 'George Wilson', deskId: 'MUNI-NYC', email: 'george.wilson@firm.com', hireDate: '2015-02-20' },
  { id: 'TR008', name: 'Hannah Montana', deskId: 'MUNI-NYC', email: 'hannah.montana@firm.com', hireDate: '2021-04-14' },
  { id: 'TR009', name: 'Ian Malcolm', deskId: 'SECURITIZED-NYC', email: 'ian.malcolm@firm.com', hireDate: '2018-08-30' },
];

const PRODUCTS = [
  'US Treasury',
  'Investment Grade Corp',
  'High Yield Corp',
  'Municipal',
  'Agency MBS',
];

const TENORS = ['2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CAD: 0.74,
};

// ============================================================================
// IN-MEMORY DATABASE
// ============================================================================

export class RelationalDatabase {
  // Tables
  private counterparties: Map<string, Counterparty> = new Map();
  private desks: Map<string, Desk> = new Map();
  private traders: Map<string, Trader> = new Map();
  private securities: Map<string, Security> = new Map();
  private trades: Map<string, TradeRecord> = new Map();

  constructor() {
    // Load reference data
    this.loadReferenceData();
  }

  private loadReferenceData() {
    COUNTERPARTIES.forEach(cp => this.counterparties.set(cp.id, cp));
    DESKS.forEach(desk => this.desks.set(desk.id, desk));
    TRADERS.forEach(trader => this.traders.set(trader.id, trader));
  }

  // ========== CRUD Operations ==========

  // Counterparties
  getCounterparty(id: string): Counterparty | undefined {
    return this.counterparties.get(id);
  }

  getAllCounterparties(): Counterparty[] {
    return Array.from(this.counterparties.values());
  }

  // Desks
  getDesk(id: string): Desk | undefined {
    return this.desks.get(id);
  }

  getAllDesks(): Desk[] {
    return Array.from(this.desks.values());
  }

  // Traders
  getTrader(id: string): Trader | undefined {
    return this.traders.get(id);
  }

  getAllTraders(): Trader[] {
    return Array.from(this.traders.values());
  }

  getTradersByDesk(deskId: string): Trader[] {
    return Array.from(this.traders.values()).filter(t => t.deskId === deskId);
  }

  // Securities
  getSecurity(cusip: string): Security | undefined {
    return this.securities.get(cusip);
  }

  insertSecurity(security: Security): void {
    this.securities.set(security.cusip, security);
  }

  getAllSecurities(): Security[] {
    return Array.from(this.securities.values());
  }

  // Trades
  getTrade(tradeId: string): TradeRecord | undefined {
    return this.trades.get(tradeId);
  }

  insertTrade(trade: TradeRecord): void {
    this.trades.set(trade.internalTradeId, trade);
  }

  getAllTrades(): TradeRecord[] {
    return Array.from(this.trades.values());
  }

  getTradesByDate(tradeDate: string): TradeRecord[] {
    return Array.from(this.trades.values()).filter(t => t.tradeDate === tradeDate);
  }

  getTradesByCounterparty(counterpartyId: string): TradeRecord[] {
    return Array.from(this.trades.values()).filter(t => t.counterpartyId === counterpartyId);
  }

  getTradesByTrader(traderId: string): TradeRecord[] {
    return Array.from(this.trades.values()).filter(t => t.traderId === traderId);
  }

  getTradesBySecurity(cusip: string): TradeRecord[] {
    return Array.from(this.trades.values()).filter(t => t.cusip === cusip);
  }

  // ========== JOIN Operations (Denormalization) ==========

  /**
   * Join trade with all related entities to create a denormalized Trade object
   */
  joinTrade(tradeRecord: TradeRecord): Trade {
    const security = this.getSecurity(tradeRecord.cusip);
    const counterparty = this.getCounterparty(tradeRecord.counterpartyId);
    const trader = this.getTrader(tradeRecord.traderId);
    const desk = trader ? this.getDesk(trader.deskId) : undefined;

    if (!security) {
      throw new Error(`Security not found: ${tradeRecord.cusip}`);
    }
    if (!counterparty) {
      throw new Error(`Counterparty not found: ${tradeRecord.counterpartyId}`);
    }
    if (!trader) {
      throw new Error(`Trader not found: ${tradeRecord.traderId}`);
    }

    // Calculate time to maturity
    const tradeDate = new Date(tradeRecord.tradeDate);
    const maturityDate = new Date(security.maturityDate);
    const timeToMaturityYears = (maturityDate.getTime() - tradeDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    return {
      // Identity
      internalTradeId: tradeRecord.internalTradeId,
      venueExecutionId: tradeRecord.venueExecutionId,
      regulatoryReportId: tradeRecord.regulatoryReportId,
      parentTradeId: tradeRecord.parentTradeId,
      allocationId: tradeRecord.allocationId,

      // Temporal
      tradeDate: tradeRecord.tradeDate,
      executionTimestamp: tradeRecord.executionTimestamp,
      originalEntryTime: tradeRecord.originalEntryTime,
      settlementDate: tradeRecord.settlementDate,

      // Economics
      notional: tradeRecord.notional,
      quantityTypeCode: tradeRecord.quantityTypeCode,
      cleanPrice: tradeRecord.cleanPrice,
      priceType: tradeRecord.priceType,
      yield: tradeRecord.yield,
      yieldType: tradeRecord.yieldType,
      accruedInterestAmount: tradeRecord.accruedInterestAmount,
      grossTradeAmount: tradeRecord.grossTradeAmount,
      netMoney: tradeRecord.netMoney,

      // Parties (denormalized)
      counterpartyId: counterparty.id,
      counterpartyName: counterparty.name,
      executingBrokerId: tradeRecord.executingBrokerId,
      traderId: trader.id,
      deskId: desk?.id || 'UNKNOWN',

      // Instrument (denormalized from Security)
      product: security.product,
      tenor: security.tenor,
      side: tradeRecord.side,
      maturityDate: security.maturityDate,
      timeToMaturityYears,

      // Security Identifiers
      cusip: security.cusip,
      ticker: security.ticker,
      coupon: security.coupon,
      sector: security.sector,

      // BCLASS Hierarchy
      bclassLevel1: security.bclassLevel1,
      bclassLevel2: security.bclassLevel2,
      bclassLevel3: security.bclassLevel3,
      bclassLevel4: security.bclassLevel4,

      // Currency
      tradeCurrency: tradeRecord.tradeCurrency,
      settlementCurrency: tradeRecord.settlementCurrency,
      fxRate: tradeRecord.fxRate,
      notionalUsd: tradeRecord.notionalUsd,
    };
  }

  /**
   * Get all trades with full denormalization (JOIN)
   */
  getAllTradesJoined(): Trade[] {
    return this.getAllTrades().map(tr => this.joinTrade(tr));
  }

  // ========== Analytics / Aggregations ==========

  getTotalNotionalByCounterparty(): Map<string, number> {
    const result = new Map<string, number>();
    this.getAllTrades().forEach(trade => {
      const current = result.get(trade.counterpartyId) || 0;
      result.set(trade.counterpartyId, current + trade.notionalUsd);
    });
    return result;
  }

  getTradeCountByTrader(): Map<string, number> {
    const result = new Map<string, number>();
    this.getAllTrades().forEach(trade => {
      const current = result.get(trade.traderId) || 0;
      result.set(trade.traderId, current + 1);
    });
    return result;
  }
}

// ============================================================================
// DATA GENERATION
// ============================================================================

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

function generateCusip(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let cusip = '';
  for (let i = 0; i < 6; i++) {
    cusip += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  cusip += randomInt(10, 99).toString();
  cusip += randomInt(0, 9).toString();
  return cusip;
}

function getCouponForProduct(product: string, tenor: string): number {
  const tenorYears = parseInt(tenor.replace('Y', '')) || 5;

  switch (product) {
    case 'US Treasury':
      return randomFloat(2.5 + tenorYears * 0.08, 4.5 + tenorYears * 0.08, 3);
    case 'Investment Grade Corp':
      return randomFloat(3.5 + tenorYears * 0.1, 5.5 + tenorYears * 0.12, 3);
    case 'High Yield Corp':
      return randomFloat(6.0 + tenorYears * 0.1, 9.0 + tenorYears * 0.15, 3);
    case 'Municipal':
      return randomFloat(2.0 + tenorYears * 0.05, 4.0 + tenorYears * 0.08, 3);
    case 'Agency MBS':
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

/**
 * Generate a security and insert into database
 */
function generateSecurity(db: RelationalDatabase, product: string, tenor: string): Security {
  const cusip = generateCusip();
  const bclass = getBClassForProduct(product, tenor);
  const ticker = getTickerForClassification(bclass);
  const coupon = getCouponForProduct(product, tenor);
  const sector = getSectorFromBClass(bclass);

  const tenorYears = parseInt(tenor.replace('Y', '')) || 5;
  const issueDate = new Date();
  issueDate.setFullYear(issueDate.getFullYear() - randomInt(0, 5));

  const maturityDate = new Date(issueDate);
  maturityDate.setFullYear(maturityDate.getFullYear() + tenorYears);
  maturityDate.setMonth(maturityDate.getMonth() + randomInt(-6, 6));

  const security: Security = {
    cusip,
    ticker,
    issuerName: ticker,
    product,
    tenor,
    coupon,
    maturityDate: formatDate(maturityDate),
    issueDate: formatDate(issueDate),
    sector,
    bclassLevel1: bclass.level1,
    bclassLevel2: bclass.level2,
    bclassLevel3: bclass.level3,
    bclassLevel4: bclass.level4,
    callableFlag: Math.random() > 0.7,
    putableFlag: Math.random() > 0.9,
  };

  db.insertSecurity(security);
  return security;
}

/**
 * Generate a trade and insert into database
 */
function generateTradeRecord(
  db: RelationalDatabase,
  tradeDate: Date,
  securitiesPool: Security[]
): TradeRecord {
  // Select security from pool
  const security = randomElement(securitiesPool);

  // Select counterparty and trader
  const counterparty = randomElement(COUNTERPARTIES);

  // Select trader based on product
  const deskPrefix = security.product === 'Municipal' ? 'MUNI'
    : (security.product === 'US Treasury' || security.product === 'Agency MBS') ? 'RATES'
    : security.product === 'Agency MBS' ? 'SECURITIZED'
    : 'CREDIT';

  const eligibleTraders = TRADERS.filter(t =>
    db.getDesk(t.deskId)?.assetClass === deskPrefix
  );
  const trader = randomElement(eligibleTraders.length > 0 ? eligibleTraders : TRADERS);

  const side: TradeSide = Math.random() > 0.5 ? 'BUY' : 'SELL';

  // Currency
  const tradeCurrency = Math.random() > 0.85 ? randomElement(CURRENCIES) : 'USD';
  const fxRate = FX_RATES[tradeCurrency];

  // Notional
  const notionalRange = getNotionalRange(security.product);
  const notional = Math.round(randomInt(notionalRange.min, notionalRange.max) / 100000) * 100000;
  const notionalUsd = notional * fxRate;

  // Pricing
  const priceRange = getProductPriceRange(security.product);
  const cleanPrice = randomFloat(priceRange.min, priceRange.max, 6);

  const yieldRange = getProductYieldRange(security.product);
  const yieldValue = randomFloat(yieldRange.min, yieldRange.max, 6);

  // Accrued interest
  const accruedInterestAmount = randomFloat(0, notional * 0.03, 2);

  // Gross and net amounts
  const grossTradeAmount = (cleanPrice / 100) * notional + accruedInterestAmount;
  const netMoney = grossTradeAmount;

  // Timestamps
  const executionHour = randomInt(7, 17);
  const executionMinute = randomInt(0, 59);
  const executionSecond = randomInt(0, 59);
  const executionMs = randomInt(0, 999);

  const executionDate = new Date(tradeDate);
  executionDate.setHours(executionHour, executionMinute, executionSecond, executionMs);

  const entryDate = new Date(executionDate.getTime() + randomInt(1000, 300000));

  // Settlement date
  const settlementDays = security.product === 'US Treasury' ? 1 : 2;
  const settlementDate = addBusinessDays(tradeDate, settlementDays);

  const trade: TradeRecord = {
    internalTradeId: generateTradeId(),
    cusip: security.cusip,
    counterpartyId: counterparty.id,
    traderId: trader.id,
    venueExecutionId: Math.random() > 0.7 ? undefined : `${randomElement(['BBG', 'TRWB', 'MKT', 'ICE'])}-${randomInt(100000, 999999)}`,
    regulatoryReportId: Math.random() > 0.1 ? `TRACE-${randomInt(10000000, 99999999)}` : undefined,

    tradeDate: formatDate(tradeDate),
    executionTimestamp: formatTimestamp(executionDate),
    originalEntryTime: formatTimestamp(entryDate),
    settlementDate: formatDate(settlementDate),

    side,
    notional,
    quantityTypeCode: 'PAR',
    cleanPrice,
    priceType: 'PERCENTAGE' as PriceType,
    yield: yieldValue,
    yieldType: 'YTM' as YieldType,
    accruedInterestAmount,
    grossTradeAmount,
    netMoney,

    tradeCurrency,
    settlementCurrency: 'USD',
    fxRate: tradeCurrency !== 'USD' ? fxRate : undefined,
    notionalUsd,
  };

  db.insertTrade(trade);
  return trade;
}

/**
 * Generate mock data and populate the relational database
 */
export function generateRelationalMockData(tradeCount: number = 2500, daysBack: number = 10): RelationalDatabase {
  const db = new RelationalDatabase();

  // Step 1: Generate securities pool (reusable securities)
  const securitiesPool: Security[] = [];
  const numSecurities = Math.ceil(tradeCount / 5); // ~5 trades per security on average

  for (let i = 0; i < numSecurities; i++) {
    const product = randomElement(PRODUCTS);
    const tenor = randomElement(TENORS);
    const security = generateSecurity(db, product, tenor);
    securitiesPool.push(security);
  }

  console.log(`Generated ${securitiesPool.length} securities`);

  // Step 2: Generate trades
  const today = new Date();
  let lastTradingDay = new Date(today);
  lastTradingDay.setDate(lastTradingDay.getDate() - 1);
  while (lastTradingDay.getDay() === 0 || lastTradingDay.getDay() === 6) {
    lastTradingDay.setDate(lastTradingDay.getDate() - 1);
  }

  const tradesPerDay = Math.ceil(tradeCount / daysBack);
  let tradesGenerated = 0;

  for (let day = 0; day < daysBack && tradesGenerated < tradeCount; day++) {
    let tradeDate = new Date(lastTradingDay);
    tradeDate.setDate(tradeDate.getDate() - day);

    while (tradeDate.getDay() === 0 || tradeDate.getDay() === 6) {
      tradeDate.setDate(tradeDate.getDate() - 1);
    }

    const dayTradeCount = Math.min(tradesPerDay, tradeCount - tradesGenerated);

    for (let i = 0; i < dayTradeCount; i++) {
      generateTradeRecord(db, tradeDate, securitiesPool);
      tradesGenerated++;
    }
  }

  console.log(`Generated ${tradesGenerated} trades`);
  console.log(`Database contains:`);
  console.log(`  - ${db.getAllCounterparties().length} counterparties`);
  console.log(`  - ${db.getAllDesks().length} desks`);
  console.log(`  - ${db.getAllTraders().length} traders`);
  console.log(`  - ${db.getAllSecurities().length} securities`);
  console.log(`  - ${db.getAllTrades().length} trades`);

  return db;
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const mockDatabase = generateRelationalMockData(2500, 10);
export const mockTrades = mockDatabase.getAllTradesJoined();
