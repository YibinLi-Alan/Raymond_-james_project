// Trade Identity & Lineage Fields
export interface TradeIdentity {
  // Primary Identifiers
  internalTradeId: string;
  venueExecutionId?: string;
  regulatoryReportId?: string;

  // Block/Allocation Linkage
  parentTradeId?: string;
  allocationId?: string;

  // Temporal Attributes
  tradeDate: string;           // ISO 8601 date
  executionTimestamp: string;  // ISO 8601 UTC timestamp
  originalEntryTime: string;   // System-generated
  settlementDate: string;      // Contractual settlement date
}

// Price Type enumeration
export type PriceType = 'PERCENTAGE' | 'YIELD' | 'SPREAD' | 'DISCOUNT';

// Yield Type enumeration
export type YieldType = 'YTM' | 'YTC' | 'YTP' | 'YTW';

// Trade Side enumeration
export type TradeSide = 'BUY' | 'SELL';

// Trade Economics Fields
export interface TradeEconomics {
  // Quantity
  notional: number;
  quantityTypeCode: 'PAR';

  // Pricing (6 decimal precision)
  cleanPrice: number;
  priceType: PriceType;
  yield?: number;
  yieldType?: YieldType;
  accruedInterestAmount: number;
  grossTradeAmount: number;
  netMoney: number;

  // Party Information
  counterpartyId: string;
  counterpartyName: string;
  executingBrokerId?: string;
  traderId: string;
  deskId: string;

  // Instrument Attributes
  product: string;
  tenor: string;
  side: TradeSide;
  maturityDate: string;         // ISO 8601 date
  timeToMaturityYears: number;  // Years to maturity from trade date

  // Security Identifiers
  cusip: string;              // 9-character CUSIP identifier
  ticker: string;             // Issuer ticker symbol
  coupon: number;             // Interest rate as percentage
  sector: string;             // Industry sector

  // BCLASS Hierarchy (Bloomberg Classification System)
  bclassLevel1: string;       // Class: Government, Corporate, Securitized, Municipal
  bclassLevel2: string;       // Group: e.g., Treasuries, Financials, Agency MBS
  bclassLevel3: string;       // Sector: e.g., Sovereign, Banks, Pass-Through
  bclassLevel4: string;       // Sub-Sector: e.g., T-Bills, Money Center Banks, FNMA

  // Currency
  tradeCurrency: string;
  settlementCurrency: string;
  fxRate?: number;
  notionalUsd: number;
}

// Complete Trade interface
export interface Trade extends TradeIdentity, TradeEconomics {}

// Grid row type (Trade with computed fields)
export interface TradeRow extends Trade {
  tradeCount: number;  // Always 1 for individual trades, aggregated for groups
}

// Eval Price for intraday time series
export interface EvalPrice {
  cusip: string;
  timestamp: string;      // ISO 8601 timestamp
  price: number;          // Eval price at this time
}

// Intraday data for a specific CUSIP on a specific date
export interface IntradayData {
  cusip: string;
  ticker: string;
  tradeDate: string;
  evalPrices: EvalPrice[];
  trades: {               // All trades for this CUSIP on this date
    tradeId: string;
    executionTimestamp: string;
    executionPrice: number;
    side: TradeSide;
  }[];
}
