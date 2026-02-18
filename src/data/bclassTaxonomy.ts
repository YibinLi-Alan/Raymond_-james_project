// BCLASS (Bloomberg Classification System) Taxonomy
// Hierarchical classification for fixed income securities

export interface BClassification {
  level1: string;  // Class
  level2: string;  // Group
  level3: string;  // Sector
  level4: string;  // Sub-Sector
}

// Product to BCLASS mappings
export const BCLASS_TAXONOMY: Record<string, BClassification[]> = {
  'US Treasury': [
    // Short-term (T-Bills: < 1 year)
    { level1: 'Government', level2: 'Treasuries', level3: 'Sovereign', level4: 'T-Bills' },
    // Medium-term (T-Notes: 2-10 years)
    { level1: 'Government', level2: 'Treasuries', level3: 'Sovereign', level4: 'T-Notes' },
    // Long-term (T-Bonds: 20-30 years)
    { level1: 'Government', level2: 'Treasuries', level3: 'Sovereign', level4: 'T-Bonds' },
    // Inflation-protected
    { level1: 'Government', level2: 'Treasuries', level3: 'Sovereign', level4: 'TIPS' },
  ],

  'Investment Grade Corp': [
    // Financials - Banks
    { level1: 'Corporate', level2: 'Financials', level3: 'Banks', level4: 'Money Center Banks' },
    { level1: 'Corporate', level2: 'Financials', level3: 'Banks', level4: 'Regional Banks' },
    { level1: 'Corporate', level2: 'Financials', level3: 'Banks', level4: 'Foreign Banks' },
    // Financials - Insurance
    { level1: 'Corporate', level2: 'Financials', level3: 'Insurance', level4: 'Life Insurance' },
    { level1: 'Corporate', level2: 'Financials', level3: 'Insurance', level4: 'P&C Insurance' },
    { level1: 'Corporate', level2: 'Financials', level3: 'Insurance', level4: 'Reinsurance' },
    // Financials - Asset Management
    { level1: 'Corporate', level2: 'Financials', level3: 'Asset Managers', level4: 'Diversified Asset Mgmt' },
    { level1: 'Corporate', level2: 'Financials', level3: 'Asset Managers', level4: 'Custodian Banks' },
    // Industrials - Technology
    { level1: 'Corporate', level2: 'Industrials', level3: 'Technology', level4: 'Software' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Technology', level4: 'Hardware' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Technology', level4: 'Semiconductors' },
    // Industrials - Healthcare
    { level1: 'Corporate', level2: 'Industrials', level3: 'Healthcare', level4: 'Pharmaceuticals' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Healthcare', level4: 'Medical Devices' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Healthcare', level4: 'Healthcare Services' },
    // Industrials - Consumer
    { level1: 'Corporate', level2: 'Industrials', level3: 'Consumer', level4: 'Consumer Products' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Consumer', level4: 'Food & Beverage' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Consumer', level4: 'Retail' },
    // Industrials - Manufacturing
    { level1: 'Corporate', level2: 'Industrials', level3: 'Manufacturing', level4: 'Aerospace & Defense' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Manufacturing', level4: 'Automotive' },
    { level1: 'Corporate', level2: 'Industrials', level3: 'Manufacturing', level4: 'Chemicals' },
    // Utilities
    { level1: 'Corporate', level2: 'Utilities', level3: 'Electric', level4: 'Integrated Electric' },
    { level1: 'Corporate', level2: 'Utilities', level3: 'Electric', level4: 'Transmission & Distribution' },
    { level1: 'Corporate', level2: 'Utilities', level3: 'Gas', level4: 'Natural Gas Distribution' },
    { level1: 'Corporate', level2: 'Utilities', level3: 'Gas', level4: 'Gas Pipelines' },
  ],

  'High Yield Corp': [
    // Energy
    { level1: 'Corporate', level2: 'High Yield', level3: 'Energy', level4: 'E&P' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Energy', level4: 'Oilfield Services' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Energy', level4: 'Midstream' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Energy', level4: 'Refining' },
    // Media & Telecom
    { level1: 'Corporate', level2: 'High Yield', level3: 'Media', level4: 'Cable & Satellite' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Media', level4: 'Broadcasting' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Media', level4: 'Publishing' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Telecom', level4: 'Wireless' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Telecom', level4: 'Wireline' },
    // Gaming & Leisure
    { level1: 'Corporate', level2: 'High Yield', level3: 'Gaming', level4: 'Casinos' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Gaming', level4: 'Lodging' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Gaming', level4: 'Cruise Lines' },
    // Healthcare
    { level1: 'Corporate', level2: 'High Yield', level3: 'Healthcare', level4: 'Hospitals' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Healthcare', level4: 'Pharma Services' },
    // Retail
    { level1: 'Corporate', level2: 'High Yield', level3: 'Retail', level4: 'Specialty Retail' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Retail', level4: 'Restaurants' },
    { level1: 'Corporate', level2: 'High Yield', level3: 'Retail', level4: 'Department Stores' },
  ],

  'Municipal': [
    // General Obligation - State Level
    { level1: 'Municipal', level2: 'General Obligation', level3: 'State GO', level4: 'State General Fund' },
    { level1: 'Municipal', level2: 'General Obligation', level3: 'State GO', level4: 'State Appropriation' },
    // General Obligation - Local Level
    { level1: 'Municipal', level2: 'General Obligation', level3: 'Local GO', level4: 'County GO' },
    { level1: 'Municipal', level2: 'General Obligation', level3: 'Local GO', level4: 'City GO' },
    { level1: 'Municipal', level2: 'General Obligation', level3: 'School District', level4: 'K-12 Districts' },
    { level1: 'Municipal', level2: 'General Obligation', level3: 'School District', level4: 'Community College' },
    // Revenue - Transportation
    { level1: 'Municipal', level2: 'Revenue', level3: 'Transportation', level4: 'Toll Roads' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Transportation', level4: 'Airports' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Transportation', level4: 'Ports' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Transportation', level4: 'Mass Transit' },
    // Revenue - Utilities
    { level1: 'Municipal', level2: 'Revenue', level3: 'Utilities', level4: 'Water & Sewer' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Utilities', level4: 'Electric Revenue' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Utilities', level4: 'Solid Waste' },
    // Revenue - Healthcare & Education
    { level1: 'Municipal', level2: 'Revenue', level3: 'Healthcare', level4: 'Hospital Revenue' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Education', level4: 'Higher Education' },
    { level1: 'Municipal', level2: 'Revenue', level3: 'Education', level4: 'Student Housing' },
  ],

  'Agency MBS': [
    // FNMA (Fannie Mae)
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'FNMA 30Y' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'FNMA 15Y' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'FNMA ARM' },
    // FHLMC (Freddie Mac)
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'FHLMC 30Y' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'FHLMC 15Y' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'FHLMC ARM' },
    // GNMA (Ginnie Mae)
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'GNMA 30Y' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'Pass-Through', level4: 'GNMA 15Y' },
    // CMOs
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'CMO', level4: 'Agency CMO Sequential' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'CMO', level4: 'Agency CMO PAC' },
    { level1: 'Securitized', level2: 'Agency MBS', level3: 'CMO', level4: 'Agency CMO TAC' },
  ],
};

// Ticker reference data by sector/sub-sector
export const TICKER_DATA: Record<string, string[]> = {
  // Government
  'T-Bills': ['T'],
  'T-Notes': ['T'],
  'T-Bonds': ['T'],
  'TIPS': ['TIP'],

  // Banks
  'Money Center Banks': ['JPM', 'BAC', 'C', 'WFC', 'GS', 'MS'],
  'Regional Banks': ['USB', 'PNC', 'TFC', 'FITB', 'KEY', 'RF'],
  'Foreign Banks': ['CS', 'DB', 'BCS', 'HSBC', 'UBS'],
  'Custodian Banks': ['BK', 'STT', 'NTRS'],

  // Insurance
  'Life Insurance': ['MET', 'PRU', 'AFL', 'LNC', 'PFG'],
  'P&C Insurance': ['AIG', 'TRV', 'ALL', 'CB', 'PGR'],
  'Reinsurance': ['RNR', 'RE', 'ACGL'],

  // Asset Managers
  'Diversified Asset Mgmt': ['BLK', 'BEN', 'TROW', 'IVZ', 'AMG'],

  // Technology
  'Software': ['MSFT', 'ORCL', 'CRM', 'ADBE', 'SAP'],
  'Hardware': ['AAPL', 'HPQ', 'DELL', 'IBM'],
  'Semiconductors': ['INTC', 'NVDA', 'AMD', 'TXN', 'QCOM'],

  // Healthcare
  'Pharmaceuticals': ['JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'BMY'],
  'Medical Devices': ['MDT', 'ABT', 'SYK', 'BSX', 'EW'],
  'Healthcare Services': ['UNH', 'CVS', 'CI', 'HUM', 'ANTM'],

  // Consumer
  'Consumer Products': ['PG', 'KO', 'PEP', 'CL', 'KMB'],
  'Food & Beverage': ['MDLZ', 'GIS', 'K', 'HSY', 'CPB'],
  'Retail': ['WMT', 'HD', 'TGT', 'COST', 'LOW'],

  // Manufacturing
  'Aerospace & Defense': ['BA', 'LMT', 'RTX', 'NOC', 'GD'],
  'Automotive': ['GM', 'F', 'TSLA'],
  'Chemicals': ['DOW', 'DD', 'LYB', 'PPG', 'APD'],

  // Utilities
  'Integrated Electric': ['NEE', 'DUK', 'SO', 'D', 'AEP'],
  'Transmission & Distribution': ['PCG', 'EIX', 'XEL', 'ED'],
  'Natural Gas Distribution': ['SRE', 'NI', 'ATO'],
  'Gas Pipelines': ['KMI', 'WMB', 'OKE', 'ET'],

  // High Yield - Energy
  'E&P': ['DVN', 'PXD', 'FANG', 'EOG', 'OXY'],
  'Oilfield Services': ['SLB', 'HAL', 'BKR'],
  'Midstream': ['TRGP', 'PAA', 'EPD'],
  'Refining': ['VLO', 'MPC', 'PSX'],

  // High Yield - Media/Telecom
  'Cable & Satellite': ['CMCSA', 'CHTR', 'DISH'],
  'Broadcasting': ['FOX', 'PARA', 'WBD'],
  'Wireless': ['TMUS', 'VZ', 'T'],
  'Wireline': ['LUMN', 'FTR'],

  // High Yield - Gaming
  'Casinos': ['MGM', 'WYNN', 'LVS', 'CZR'],
  'Lodging': ['MAR', 'HLT', 'H'],
  'Cruise Lines': ['CCL', 'RCL', 'NCLH'],

  // High Yield - Retail
  'Specialty Retail': ['BBY', 'DKS', 'ULTA'],
  'Restaurants': ['MCD', 'SBUX', 'CMG', 'DRI'],
  'Department Stores': ['M', 'JWN', 'KSS'],

  // Municipal
  'State General Fund': ['STATE'],
  'County GO': ['CNTY'],
  'City GO': ['CITY'],
  'K-12 Districts': ['SCHL'],
  'Toll Roads': ['TOLL'],
  'Airports': ['ARPT'],
  'Water & Sewer': ['WTR'],
  'Hospital Revenue': ['HOSP'],
  'Higher Education': ['UNIV'],

  // Agency MBS
  'FNMA 30Y': ['FNMA'],
  'FNMA 15Y': ['FNMA'],
  'FNMA ARM': ['FNMA'],
  'FHLMC 30Y': ['FHLMC'],
  'FHLMC 15Y': ['FHLMC'],
  'FHLMC ARM': ['FHLMC'],
  'GNMA 30Y': ['GNMA'],
  'GNMA 15Y': ['GNMA'],
  'Agency CMO Sequential': ['CMO'],
  'Agency CMO PAC': ['CMO'],
  'Agency CMO TAC': ['CMO'],
};

// Sunburst color palette - "Obsidian & Platinum" (Premium, sophisticated design)
// Design philosophy: Luminosity-based hierarchy with gold accent for interactions
export const BCLASS_COLORS: Record<string, string> = {
  // Level 1 - Core Asset Classes (Brightest - platinum/silver tones)
  'Government': '#9CA3AF',      // Cool silver - stability, trust
  'Corporate': '#78716C',       // Warm stone - business solidity
  'Securitized': '#6B7280',     // Steel gray - structured products
  'Municipal': '#71717A',       // Zinc - civic infrastructure

  // Level 2 - Categories (Mid-luminosity - darker, more depth)
  'Treasuries': '#64748B',      // Slate - government backing
  'Financials': '#525252',      // Neutral gray - banks/finance
  'Industrials': '#57534E',     // Stone - manufacturing
  'Utilities': '#52525B',       // Zinc darker - infrastructure
  'High Yield': '#7C6F64',      // Warm taupe - risk premium
  'General Obligation': '#64748B',
  'Revenue': '#475569',
  'Agency MBS': '#6B7280',

  // Level 3 - Sectors (Darkest - recede into background)
  'Sovereign': '#4B5563',
  'Banks': '#3F3F46',
  'Insurance': '#44403C',
  'Asset Managers': '#52525B',
  'Technology': '#374151',
  'Healthcare': '#3F3F46',
  'Consumer': '#44403C',
  'Manufacturing': '#374151',
  'Electric': '#374151',
  'Gas': '#3F3F46',
  'Energy': '#57534E',
  'Media': '#52525B',
  'Telecom': '#4B5563',
  'Gaming': '#525252',
  'Retail': '#44403C',
  'State GO': '#475569',
  'Local GO': '#4B5563',
  'School District': '#3F3F46',
  'Transportation': '#374151',
  'Pass-Through': '#4B5563',
  'CMO': '#3F3F46',
};

// Accent colors for interactions (using orange from --accent-sell)
export const ACCENT_ORANGE = '#F57C00';
export const ACCENT_ORANGE_SUBTLE = 'rgba(245, 124, 0, 0.3)';

// Helper function to get BCLASS for a product based on tenor
export function getBClassForProduct(product: string, tenor: string): BClassification {
  const classifications = BCLASS_TAXONOMY[product];
  if (!classifications || classifications.length === 0) {
    return { level1: 'Other', level2: 'Other', level3: 'Other', level4: 'Other' };
  }

  const tenorYears = parseInt(tenor.replace('Y', '')) || 5;

  // US Treasury - select based on tenor
  if (product === 'US Treasury') {
    if (tenorYears <= 1) return classifications[0];  // T-Bills
    if (tenorYears <= 10) return classifications[1]; // T-Notes
    if (tenorYears <= 20) return classifications[2]; // T-Bonds
    // Randomly include some TIPS
    if (Math.random() < 0.15) return classifications[3]; // TIPS
    return classifications[2]; // T-Bonds
  }

  // Agency MBS - select based on tenor (30Y vs 15Y products)
  if (product === 'Agency MBS') {
    const is30Y = tenorYears >= 25;
    const is15Y = tenorYears >= 10 && tenorYears < 25;

    // Filter to matching term products
    const matchingProducts = classifications.filter(c => {
      if (is30Y) return c.level4.includes('30Y');
      if (is15Y) return c.level4.includes('15Y');
      return c.level3 === 'CMO' || c.level4.includes('ARM');
    });

    if (matchingProducts.length > 0) {
      return matchingProducts[Math.floor(Math.random() * matchingProducts.length)];
    }
  }

  // For all other products, weighted random selection
  return classifications[Math.floor(Math.random() * classifications.length)];
}

// Helper to get ticker for a classification
export function getTickerForClassification(bclass: BClassification): string {
  // Try sub-sector first, then sector, then generic
  const tickers = TICKER_DATA[bclass.level4]
    || TICKER_DATA[bclass.level3]
    || TICKER_DATA[bclass.level2]
    || ['CORP'];

  return tickers[Math.floor(Math.random() * tickers.length)];
}

// Helper to get sector from BCLASS
export function getSectorFromBClass(bclass: BClassification): string {
  return bclass.level3;
}
