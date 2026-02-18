"""
Generate SQLite database with the same relational schema as relationalMockData.ts
This database can be used by Vanna for Text-to-SQL queries.
"""

import sqlite3
import random
import string
import os
from datetime import datetime, timedelta
from pathlib import Path

# Output path
DB_DIR = Path(__file__).parent
DB_PATH = DB_DIR / "morning_blotter.db"
SCHEMA_PATH = DB_DIR / "schema.sql"

# ============================================================================
# REFERENCE DATA (matches relationalMockData.ts exactly)
# ============================================================================

COUNTERPARTIES = [
    ("CP001", "BlackRock", "BLACKROCK123456789", "ASSET_MANAGER", 1),
    ("CP002", "Vanguard", "VANGUARD123456789", "ASSET_MANAGER", 1),
    ("CP003", "Fidelity", "FIDELITY123456789", "ASSET_MANAGER", 1),
    ("CP004", "State Street", "STATESTR123456789", "ASSET_MANAGER", 1),
    ("CP005", "PIMCO", "PIMCO12345678901", "ASSET_MANAGER", 1),
    ("CP006", "JPMorgan Asset Mgmt", "JPMORGAN123456789", "ASSET_MANAGER", 1),
    ("CP007", "Goldman Sachs AM", "GOLDMANS123456789", "ASSET_MANAGER", 1),
    ("CP008", "Morgan Stanley IM", "MORGANST123456789", "ASSET_MANAGER", 1),
    ("CP009", "Wellington Mgmt", "WELLINGTON12345678", "ASSET_MANAGER", 2),
    ("CP010", "Capital Group", "CAPITALG123456789", "ASSET_MANAGER", 2),
    ("CP011", "T. Rowe Price", "TROWEPRI123456789", "ASSET_MANAGER", 2),
    ("CP012", "Prudential", "PRUDENTIA123456789", "INSURANCE", 2),
    ("CP013", "MetLife Investment", "METLIFE1234567890", "INSURANCE", 2),
    ("CP014", "Citadel", "CITADEL1234567890", "HEDGE_FUND", 1),
    ("CP015", "Two Sigma", "TWOSIGMA123456789", "HEDGE_FUND", 1),
]

DESKS = [
    ("RATES-NYC", "Rates Trading - New York", "NYC", "RATES"),
    ("RATES-LON", "Rates Trading - London", "LON", "RATES"),
    ("CREDIT-NYC", "Credit Trading - New York", "NYC", "CREDIT"),
    ("CREDIT-LON", "Credit Trading - London", "LON", "CREDIT"),
    ("MUNI-NYC", "Municipals - New York", "NYC", "MUNI"),
    ("SECURITIZED-NYC", "Securitized Products - New York", "NYC", "SECURITIZED"),
]

TRADERS = [
    ("TR001", "Alice Johnson", "RATES-NYC", "alice.johnson@firm.com", "2018-03-15"),
    ("TR002", "Bob Smith", "RATES-NYC", "bob.smith@firm.com", "2019-07-22"),
    ("TR003", "Charlie Brown", "RATES-LON", "charlie.brown@firm.com", "2017-01-10"),
    ("TR004", "Diana Prince", "CREDIT-NYC", "diana.prince@firm.com", "2020-05-03"),
    ("TR005", "Ethan Hunt", "CREDIT-NYC", "ethan.hunt@firm.com", "2016-11-12"),
    ("TR006", "Fiona Gallagher", "CREDIT-LON", "fiona.gallagher@firm.com", "2019-09-08"),
    ("TR007", "George Wilson", "MUNI-NYC", "george.wilson@firm.com", "2015-02-20"),
    ("TR008", "Hannah Montana", "MUNI-NYC", "hannah.montana@firm.com", "2021-04-14"),
    ("TR009", "Ian Malcolm", "SECURITIZED-NYC", "ian.malcolm@firm.com", "2018-08-30"),
]

PRODUCTS = ["US Treasury", "Investment Grade Corp", "High Yield Corp", "Municipal", "Agency MBS"]
TENORS = ["2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"]
CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD"]
FX_RATES = {"USD": 1.0, "EUR": 1.08, "GBP": 1.27, "JPY": 0.0067, "CAD": 0.74}

# BCLASS Taxonomy (matches bclassTaxonomy.ts)
BCLASS_TAXONOMY = {
    "US Treasury": [
        ("Government", "Treasuries", "Sovereign", "T-Bills"),
        ("Government", "Treasuries", "Sovereign", "T-Notes"),
        ("Government", "Treasuries", "Sovereign", "T-Bonds"),
        ("Government", "Treasuries", "Sovereign", "TIPS"),
    ],
    "Investment Grade Corp": [
        ("Corporate", "Financials", "Banks", "Money Center Banks"),
        ("Corporate", "Financials", "Banks", "Regional Banks"),
        ("Corporate", "Financials", "Banks", "Foreign Banks"),
        ("Corporate", "Financials", "Insurance", "Life Insurance"),
        ("Corporate", "Financials", "Insurance", "P&C Insurance"),
        ("Corporate", "Financials", "Insurance", "Reinsurance"),
        ("Corporate", "Financials", "Asset Managers", "Diversified Asset Mgmt"),
        ("Corporate", "Financials", "Asset Managers", "Custodian Banks"),
        ("Corporate", "Industrials", "Technology", "Software"),
        ("Corporate", "Industrials", "Technology", "Hardware"),
        ("Corporate", "Industrials", "Technology", "Semiconductors"),
        ("Corporate", "Industrials", "Healthcare", "Pharmaceuticals"),
        ("Corporate", "Industrials", "Healthcare", "Medical Devices"),
        ("Corporate", "Industrials", "Healthcare", "Healthcare Services"),
        ("Corporate", "Industrials", "Consumer", "Consumer Products"),
        ("Corporate", "Industrials", "Consumer", "Food & Beverage"),
        ("Corporate", "Industrials", "Consumer", "Retail"),
        ("Corporate", "Industrials", "Manufacturing", "Aerospace & Defense"),
        ("Corporate", "Industrials", "Manufacturing", "Automotive"),
        ("Corporate", "Industrials", "Manufacturing", "Chemicals"),
        ("Corporate", "Utilities", "Electric", "Integrated Electric"),
        ("Corporate", "Utilities", "Electric", "Transmission & Distribution"),
        ("Corporate", "Utilities", "Gas", "Natural Gas Distribution"),
        ("Corporate", "Utilities", "Gas", "Gas Pipelines"),
    ],
    "High Yield Corp": [
        ("Corporate", "High Yield", "Energy", "E&P"),
        ("Corporate", "High Yield", "Energy", "Oilfield Services"),
        ("Corporate", "High Yield", "Energy", "Midstream"),
        ("Corporate", "High Yield", "Energy", "Refining"),
        ("Corporate", "High Yield", "Media", "Cable & Satellite"),
        ("Corporate", "High Yield", "Media", "Broadcasting"),
        ("Corporate", "High Yield", "Media", "Publishing"),
        ("Corporate", "High Yield", "Telecom", "Wireless"),
        ("Corporate", "High Yield", "Telecom", "Wireline"),
        ("Corporate", "High Yield", "Gaming", "Casinos"),
        ("Corporate", "High Yield", "Gaming", "Lodging"),
        ("Corporate", "High Yield", "Gaming", "Cruise Lines"),
        ("Corporate", "High Yield", "Healthcare", "Hospitals"),
        ("Corporate", "High Yield", "Healthcare", "Pharma Services"),
        ("Corporate", "High Yield", "Retail", "Specialty Retail"),
        ("Corporate", "High Yield", "Retail", "Restaurants"),
        ("Corporate", "High Yield", "Retail", "Department Stores"),
    ],
    "Municipal": [
        ("Municipal", "General Obligation", "State GO", "State General Fund"),
        ("Municipal", "General Obligation", "State GO", "State Appropriation"),
        ("Municipal", "General Obligation", "Local GO", "County GO"),
        ("Municipal", "General Obligation", "Local GO", "City GO"),
        ("Municipal", "General Obligation", "School District", "K-12 Districts"),
        ("Municipal", "General Obligation", "School District", "Community College"),
        ("Municipal", "Revenue", "Transportation", "Toll Roads"),
        ("Municipal", "Revenue", "Transportation", "Airports"),
        ("Municipal", "Revenue", "Transportation", "Ports"),
        ("Municipal", "Revenue", "Transportation", "Mass Transit"),
        ("Municipal", "Revenue", "Utilities", "Water & Sewer"),
        ("Municipal", "Revenue", "Utilities", "Electric Revenue"),
        ("Municipal", "Revenue", "Utilities", "Solid Waste"),
        ("Municipal", "Revenue", "Healthcare", "Hospital Revenue"),
        ("Municipal", "Revenue", "Education", "Higher Education"),
        ("Municipal", "Revenue", "Education", "Student Housing"),
    ],
    "Agency MBS": [
        ("Securitized", "Agency MBS", "Pass-Through", "FNMA 30Y"),
        ("Securitized", "Agency MBS", "Pass-Through", "FNMA 15Y"),
        ("Securitized", "Agency MBS", "Pass-Through", "FNMA ARM"),
        ("Securitized", "Agency MBS", "Pass-Through", "FHLMC 30Y"),
        ("Securitized", "Agency MBS", "Pass-Through", "FHLMC 15Y"),
        ("Securitized", "Agency MBS", "Pass-Through", "FHLMC ARM"),
        ("Securitized", "Agency MBS", "Pass-Through", "GNMA 30Y"),
        ("Securitized", "Agency MBS", "Pass-Through", "GNMA 15Y"),
        ("Securitized", "Agency MBS", "CMO", "Agency CMO Sequential"),
        ("Securitized", "Agency MBS", "CMO", "Agency CMO PAC"),
        ("Securitized", "Agency MBS", "CMO", "Agency CMO TAC"),
    ],
}

TICKER_DATA = {
    "T-Bills": ["T"], "T-Notes": ["T"], "T-Bonds": ["T"], "TIPS": ["TIP"],
    "Money Center Banks": ["JPM", "BAC", "C", "WFC", "GS", "MS"],
    "Regional Banks": ["USB", "PNC", "TFC", "FITB", "KEY", "RF"],
    "Foreign Banks": ["CS", "DB", "BCS", "HSBC", "UBS"],
    "Custodian Banks": ["BK", "STT", "NTRS"],
    "Life Insurance": ["MET", "PRU", "AFL", "LNC", "PFG"],
    "P&C Insurance": ["AIG", "TRV", "ALL", "CB", "PGR"],
    "Reinsurance": ["RNR", "RE", "ACGL"],
    "Diversified Asset Mgmt": ["BLK", "BEN", "TROW", "IVZ", "AMG"],
    "Software": ["MSFT", "ORCL", "CRM", "ADBE", "SAP"],
    "Hardware": ["AAPL", "HPQ", "DELL", "IBM"],
    "Semiconductors": ["INTC", "NVDA", "AMD", "TXN", "QCOM"],
    "Pharmaceuticals": ["JNJ", "PFE", "MRK", "ABBV", "LLY", "BMY"],
    "Medical Devices": ["MDT", "ABT", "SYK", "BSX", "EW"],
    "Healthcare Services": ["UNH", "CVS", "CI", "HUM", "ANTM"],
    "Consumer Products": ["PG", "KO", "PEP", "CL", "KMB"],
    "Food & Beverage": ["MDLZ", "GIS", "K", "HSY", "CPB"],
    "Retail": ["WMT", "HD", "TGT", "COST", "LOW"],
    "Aerospace & Defense": ["BA", "LMT", "RTX", "NOC", "GD"],
    "Automotive": ["GM", "F", "TSLA"],
    "Chemicals": ["DOW", "DD", "LYB", "PPG", "APD"],
    "Integrated Electric": ["NEE", "DUK", "SO", "D", "AEP"],
    "Transmission & Distribution": ["PCG", "EIX", "XEL", "ED"],
    "Natural Gas Distribution": ["SRE", "NI", "ATO"],
    "Gas Pipelines": ["KMI", "WMB", "OKE", "ET"],
    "E&P": ["DVN", "PXD", "FANG", "EOG", "OXY"],
    "Oilfield Services": ["SLB", "HAL", "BKR"],
    "Midstream": ["TRGP", "PAA", "EPD"],
    "Refining": ["VLO", "MPC", "PSX"],
    "Cable & Satellite": ["CMCSA", "CHTR", "DISH"],
    "Broadcasting": ["FOX", "PARA", "WBD"],
    "Wireless": ["TMUS", "VZ", "T"],
    "Wireline": ["LUMN", "FTR"],
    "Casinos": ["MGM", "WYNN", "LVS", "CZR"],
    "Lodging": ["MAR", "HLT", "H"],
    "Cruise Lines": ["CCL", "RCL", "NCLH"],
    "Specialty Retail": ["BBY", "DKS", "ULTA"],
    "Restaurants": ["MCD", "SBUX", "CMG", "DRI"],
    "Department Stores": ["M", "JWN", "KSS"],
    "State General Fund": ["STATE"], "County GO": ["CNTY"], "City GO": ["CITY"],
    "K-12 Districts": ["SCHL"], "Toll Roads": ["TOLL"], "Airports": ["ARPT"],
    "Water & Sewer": ["WTR"], "Hospital Revenue": ["HOSP"], "Higher Education": ["UNIV"],
    "FNMA 30Y": ["FNMA"], "FNMA 15Y": ["FNMA"], "FNMA ARM": ["FNMA"],
    "FHLMC 30Y": ["FHLMC"], "FHLMC 15Y": ["FHLMC"], "FHLMC ARM": ["FHLMC"],
    "GNMA 30Y": ["GNMA"], "GNMA 15Y": ["GNMA"],
    "Agency CMO Sequential": ["CMO"], "Agency CMO PAC": ["CMO"], "Agency CMO TAC": ["CMO"],
}


# ============================================================================
# SCHEMA
# ============================================================================

SCHEMA_SQL = """
-- Morning Blotter Relational Database Schema
-- Fixed Income Post-Trade Analytics

CREATE TABLE IF NOT EXISTS counterparties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lei TEXT,
    type TEXT NOT NULL CHECK (type IN ('ASSET_MANAGER', 'HEDGE_FUND', 'BANK', 'INSURANCE', 'PENSION')),
    tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3))
);

CREATE TABLE IF NOT EXISTS desks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('NYC', 'LON', 'HKG', 'TOK')),
    asset_class TEXT NOT NULL CHECK (asset_class IN ('RATES', 'CREDIT', 'MUNI', 'SECURITIZED'))
);

CREATE TABLE IF NOT EXISTS traders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    desk_id TEXT NOT NULL REFERENCES desks(id),
    email TEXT NOT NULL,
    hire_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS securities (
    cusip TEXT PRIMARY KEY,
    isin TEXT,
    ticker TEXT NOT NULL,
    issuer_name TEXT NOT NULL,
    product TEXT NOT NULL,
    tenor TEXT NOT NULL,
    coupon REAL NOT NULL,
    maturity_date TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    sector TEXT NOT NULL,
    bclass_level1 TEXT NOT NULL,
    bclass_level2 TEXT NOT NULL,
    bclass_level3 TEXT NOT NULL,
    bclass_level4 TEXT NOT NULL,
    rating TEXT,
    callable_flag INTEGER NOT NULL DEFAULT 0,
    putable_flag INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trades (
    internal_trade_id TEXT PRIMARY KEY,
    cusip TEXT NOT NULL REFERENCES securities(cusip),
    counterparty_id TEXT NOT NULL REFERENCES counterparties(id),
    trader_id TEXT NOT NULL REFERENCES traders(id),
    executing_broker_id TEXT REFERENCES counterparties(id),
    venue_execution_id TEXT,
    regulatory_report_id TEXT,
    parent_trade_id TEXT REFERENCES trades(internal_trade_id),
    allocation_id TEXT,
    trade_date TEXT NOT NULL,
    execution_timestamp TEXT NOT NULL,
    original_entry_time TEXT NOT NULL,
    settlement_date TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    notional REAL NOT NULL,
    quantity_type_code TEXT NOT NULL DEFAULT 'PAR',
    clean_price REAL NOT NULL,
    price_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
    yield REAL,
    yield_type TEXT,
    accrued_interest_amount REAL NOT NULL,
    gross_trade_amount REAL NOT NULL,
    net_money REAL NOT NULL,
    trade_currency TEXT NOT NULL DEFAULT 'USD',
    settlement_currency TEXT NOT NULL DEFAULT 'USD',
    fx_rate REAL,
    notional_usd REAL NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_cusip ON trades(cusip);
CREATE INDEX IF NOT EXISTS idx_trades_counterparty_id ON trades(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_trades_trader_id ON trades(trader_id);
CREATE INDEX IF NOT EXISTS idx_trades_side ON trades(side);
CREATE INDEX IF NOT EXISTS idx_trades_product ON trades(cusip);
CREATE INDEX IF NOT EXISTS idx_securities_product ON securities(product);
CREATE INDEX IF NOT EXISTS idx_securities_bclass ON securities(bclass_level1, bclass_level2, bclass_level3, bclass_level4);
CREATE INDEX IF NOT EXISTS idx_traders_desk_id ON traders(desk_id);

-- Views for common Vanna queries

CREATE VIEW IF NOT EXISTS v_trades_full AS
SELECT
    t.internal_trade_id,
    t.trade_date,
    t.execution_timestamp,
    t.settlement_date,
    t.side,
    t.notional,
    t.clean_price,
    t.price_type,
    t.yield,
    t.yield_type,
    t.accrued_interest_amount,
    t.gross_trade_amount,
    t.net_money,
    t.trade_currency,
    t.settlement_currency,
    t.fx_rate,
    t.notional_usd,
    t.venue_execution_id,
    t.regulatory_report_id,
    -- Security fields
    s.cusip,
    s.ticker,
    s.issuer_name,
    s.product,
    s.tenor,
    s.coupon,
    s.maturity_date,
    s.sector,
    s.bclass_level1,
    s.bclass_level2,
    s.bclass_level3,
    s.bclass_level4,
    s.callable_flag,
    s.putable_flag,
    -- Counterparty fields
    cp.name AS counterparty_name,
    cp.type AS counterparty_type,
    cp.tier AS counterparty_tier,
    -- Trader fields
    tr.name AS trader_name,
    tr.email AS trader_email,
    -- Desk fields
    d.name AS desk_name,
    d.location AS desk_location,
    d.asset_class AS desk_asset_class
FROM trades t
JOIN securities s ON t.cusip = s.cusip
JOIN counterparties cp ON t.counterparty_id = cp.id
JOIN traders tr ON t.trader_id = tr.id
JOIN desks d ON tr.desk_id = d.id;

CREATE VIEW IF NOT EXISTS v_daily_summary AS
SELECT
    t.trade_date,
    s.product,
    t.side,
    COUNT(*) AS trade_count,
    SUM(t.notional_usd) AS total_notional_usd,
    AVG(t.clean_price) AS avg_price,
    AVG(t.yield) AS avg_yield
FROM trades t
JOIN securities s ON t.cusip = s.cusip
GROUP BY t.trade_date, s.product, t.side;

CREATE VIEW IF NOT EXISTS v_counterparty_activity AS
SELECT
    cp.id AS counterparty_id,
    cp.name AS counterparty_name,
    cp.tier,
    COUNT(*) AS trade_count,
    SUM(t.notional_usd) AS total_notional_usd,
    COUNT(DISTINCT t.trade_date) AS active_days,
    MIN(t.trade_date) AS first_trade_date,
    MAX(t.trade_date) AS last_trade_date
FROM trades t
JOIN counterparties cp ON t.counterparty_id = cp.id
GROUP BY cp.id, cp.name, cp.tier;

CREATE VIEW IF NOT EXISTS v_trader_performance AS
SELECT
    tr.id AS trader_id,
    tr.name AS trader_name,
    d.name AS desk_name,
    d.asset_class,
    COUNT(*) AS trade_count,
    SUM(t.notional_usd) AS total_notional_usd,
    SUM(CASE WHEN t.side = 'BUY' THEN t.notional_usd ELSE 0 END) AS buy_notional_usd,
    SUM(CASE WHEN t.side = 'SELL' THEN t.notional_usd ELSE 0 END) AS sell_notional_usd
FROM trades t
JOIN traders tr ON t.trader_id = tr.id
JOIN desks d ON tr.desk_id = d.id
GROUP BY tr.id, tr.name, d.name, d.asset_class;
"""


# ============================================================================
# DATA GENERATION (mirrors relationalMockData.ts logic)
# ============================================================================

def generate_cusip():
    chars = string.ascii_uppercase + string.digits
    cusip = ''.join(random.choice(chars) for _ in range(6))
    cusip += str(random.randint(10, 99))
    cusip += str(random.randint(0, 9))
    return cusip


def generate_trade_id():
    chars = string.ascii_uppercase + string.digits
    return "TRD-" + ''.join(random.choice(chars) for _ in range(12))


def get_bclass_for_product(product, tenor):
    classifications = BCLASS_TAXONOMY.get(product, [])
    if not classifications:
        return ("Other", "Other", "Other", "Other")

    tenor_years = int(tenor.replace("Y", "")) if tenor.endswith("Y") else 5

    if product == "US Treasury":
        if tenor_years <= 1:
            return classifications[0]
        if tenor_years <= 10:
            return classifications[1]
        if tenor_years <= 20:
            return classifications[2]
        if random.random() < 0.15:
            return classifications[3]
        return classifications[2]

    if product == "Agency MBS":
        is_30y = tenor_years >= 25
        is_15y = 10 <= tenor_years < 25
        matching = [c for c in classifications if
                    (is_30y and "30Y" in c[3]) or
                    (is_15y and "15Y" in c[3]) or
                    (not is_30y and not is_15y and ("CMO" in c[2] or "ARM" in c[3]))]
        if matching:
            return random.choice(matching)

    return random.choice(classifications)


def get_ticker(bclass_level4, bclass_level3, bclass_level2):
    tickers = TICKER_DATA.get(bclass_level4) or TICKER_DATA.get(bclass_level3) or TICKER_DATA.get(bclass_level2) or ["CORP"]
    return random.choice(tickers)


def get_coupon(product, tenor):
    tenor_years = int(tenor.replace("Y", "")) if tenor.endswith("Y") else 5
    ranges = {
        "US Treasury": (2.5 + tenor_years * 0.08, 4.5 + tenor_years * 0.08),
        "Investment Grade Corp": (3.5 + tenor_years * 0.1, 5.5 + tenor_years * 0.12),
        "High Yield Corp": (6.0 + tenor_years * 0.1, 9.0 + tenor_years * 0.15),
        "Municipal": (2.0 + tenor_years * 0.05, 4.0 + tenor_years * 0.08),
        "Agency MBS": (3.5, 6.5),
    }
    lo, hi = ranges.get(product, (3.0, 5.0))
    return round(random.uniform(lo, hi), 3)


def get_price_range(product):
    ranges = {
        "US Treasury": (95, 105),
        "Investment Grade Corp": (90, 110),
        "High Yield Corp": (75, 105),
        "Municipal": (92, 108),
        "Agency MBS": (98, 103),
    }
    return ranges.get(product, (95, 105))


def get_yield_range(product):
    ranges = {
        "US Treasury": (3.5, 5.0),
        "Investment Grade Corp": (4.5, 6.5),
        "High Yield Corp": (7.0, 12.0),
        "Municipal": (3.0, 5.0),
        "Agency MBS": (4.0, 5.5),
    }
    return ranges.get(product, (4.0, 6.0))


def get_notional_range(product):
    ranges = {
        "US Treasury": (5_000_000, 500_000_000),
        "Investment Grade Corp": (1_000_000, 50_000_000),
        "High Yield Corp": (500_000, 25_000_000),
        "Municipal": (100_000, 10_000_000),
        "Agency MBS": (5_000_000, 100_000_000),
    }
    return ranges.get(product, (1_000_000, 50_000_000))


def add_business_days(date, days):
    result = date
    added = 0
    while added < days:
        result += timedelta(days=1)
        if result.weekday() < 5:
            added += 1
    return result


def generate_database(trade_count=2500, days_back=10):
    # Remove existing db
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # Create schema
    cursor.executescript(SCHEMA_SQL)

    # Insert counterparties
    cursor.executemany(
        "INSERT INTO counterparties (id, name, lei, type, tier) VALUES (?, ?, ?, ?, ?)",
        COUNTERPARTIES
    )

    # Insert desks
    cursor.executemany(
        "INSERT INTO desks (id, name, location, asset_class) VALUES (?, ?, ?, ?)",
        DESKS
    )

    # Insert traders
    cursor.executemany(
        "INSERT INTO traders (id, name, desk_id, email, hire_date) VALUES (?, ?, ?, ?, ?)",
        TRADERS
    )

    # Generate securities pool
    num_securities = trade_count // 5
    securities_pool = []

    for _ in range(num_securities):
        product = random.choice(PRODUCTS)
        tenor = random.choice(TENORS)
        cusip = generate_cusip()
        bclass = get_bclass_for_product(product, tenor)
        ticker = get_ticker(bclass[3], bclass[2], bclass[1])
        coupon = get_coupon(product, tenor)
        sector = bclass[2]

        tenor_years = int(tenor.replace("Y", "")) if tenor.endswith("Y") else 5
        issue_date = datetime.now() - timedelta(days=random.randint(0, 5 * 365))
        maturity_date = issue_date + timedelta(days=tenor_years * 365 + random.randint(-180, 180))

        sec = (
            cusip, None, ticker, ticker, product, tenor, coupon,
            maturity_date.strftime("%Y-%m-%d"),
            issue_date.strftime("%Y-%m-%d"),
            sector,
            bclass[0], bclass[1], bclass[2], bclass[3],
            None,
            1 if random.random() > 0.7 else 0,
            1 if random.random() > 0.9 else 0,
        )
        securities_pool.append(sec)

    cursor.executemany(
        """INSERT INTO securities (cusip, isin, ticker, issuer_name, product, tenor, coupon,
           maturity_date, issue_date, sector, bclass_level1, bclass_level2, bclass_level3, bclass_level4,
           rating, callable_flag, putable_flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        securities_pool
    )

    # Build desk lookup for trader assignment
    desk_map = {d[0]: d[3] for d in DESKS}
    trader_desk = {t[0]: desk_map[t[2]] for t in TRADERS}

    # Generate trades
    today = datetime.now()
    last_trading_day = today - timedelta(days=1)
    while last_trading_day.weekday() >= 5:
        last_trading_day -= timedelta(days=1)

    trades_per_day = trade_count // days_back
    trades_generated = 0
    venue_prefixes = ["BBG", "TRWB", "MKT", "ICE"]

    for day in range(days_back):
        if trades_generated >= trade_count:
            break

        trade_date = last_trading_day - timedelta(days=day)
        while trade_date.weekday() >= 5:
            trade_date -= timedelta(days=1)

        day_trade_count = min(trades_per_day, trade_count - trades_generated)

        for _ in range(day_trade_count):
            sec = random.choice(securities_pool)
            product = sec[4]
            counterparty = random.choice(COUNTERPARTIES)

            # Select trader based on product -> desk mapping
            desk_prefix = {
                "Municipal": "MUNI",
                "US Treasury": "RATES",
                "Agency MBS": "RATES",
            }.get(product, "CREDIT")

            eligible = [t for t in TRADERS if trader_desk[t[0]] == desk_prefix]
            if not eligible:
                eligible = TRADERS
            trader = random.choice(eligible)

            side = random.choice(["BUY", "SELL"])
            trade_currency = random.choice(CURRENCIES) if random.random() > 0.85 else "USD"
            fx_rate = FX_RATES[trade_currency]

            notional_lo, notional_hi = get_notional_range(product)
            notional = round(random.randint(notional_lo, notional_hi) / 100000) * 100000
            notional_usd = notional * fx_rate

            price_lo, price_hi = get_price_range(product)
            clean_price = round(random.uniform(price_lo, price_hi), 6)

            yield_lo, yield_hi = get_yield_range(product)
            yield_val = round(random.uniform(yield_lo, yield_hi), 6)

            accrued = round(random.uniform(0, notional * 0.03), 2)
            gross = (clean_price / 100) * notional + accrued
            net_money = gross

            exec_hour = random.randint(7, 17)
            exec_min = random.randint(0, 59)
            exec_sec = random.randint(0, 59)
            exec_dt = trade_date.replace(hour=exec_hour, minute=exec_min, second=exec_sec)
            entry_dt = exec_dt + timedelta(seconds=random.randint(1, 300))

            settlement_days = 1 if product == "US Treasury" else 2
            settlement_date = add_business_days(trade_date, settlement_days)

            venue_id = None if random.random() > 0.7 else f"{random.choice(venue_prefixes)}-{random.randint(100000, 999999)}"
            reg_id = f"TRACE-{random.randint(10000000, 99999999)}" if random.random() > 0.1 else None

            trade = (
                generate_trade_id(),
                sec[0],  # cusip
                counterparty[0],  # counterparty_id
                trader[0],  # trader_id
                None,  # executing_broker_id
                venue_id,
                reg_id,
                None,  # parent_trade_id
                None,  # allocation_id
                trade_date.strftime("%Y-%m-%d"),
                exec_dt.isoformat(),
                entry_dt.isoformat(),
                settlement_date.strftime("%Y-%m-%d"),
                side,
                notional,
                "PAR",
                clean_price,
                "PERCENTAGE",
                yield_val,
                "YTM",
                accrued,
                gross,
                net_money,
                trade_currency,
                "USD",
                fx_rate if trade_currency != "USD" else None,
                notional_usd,
            )

            cursor.execute(
                """INSERT INTO trades (internal_trade_id, cusip, counterparty_id, trader_id,
                   executing_broker_id, venue_execution_id, regulatory_report_id,
                   parent_trade_id, allocation_id, trade_date, execution_timestamp,
                   original_entry_time, settlement_date, side, notional, quantity_type_code,
                   clean_price, price_type, yield, yield_type, accrued_interest_amount,
                   gross_trade_amount, net_money, trade_currency, settlement_currency,
                   fx_rate, notional_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                trade
            )
            trades_generated += 1

    conn.commit()

    # Print summary
    cursor.execute("SELECT COUNT(*) FROM counterparties")
    print(f"  Counterparties: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM desks")
    print(f"  Desks: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM traders")
    print(f"  Traders: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM securities")
    print(f"  Securities: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM trades")
    print(f"  Trades: {cursor.fetchone()[0]}")

    conn.close()
    print(f"\nDatabase saved to: {DB_PATH}")

    # Also write out the schema file for Vanna training
    with open(SCHEMA_PATH, "w") as f:
        f.write(SCHEMA_SQL)
    print(f"Schema saved to: {SCHEMA_PATH}")


if __name__ == "__main__":
    print("Generating Morning Blotter SQLite database...")
    generate_database(2500, 10)
    print("Done!")
