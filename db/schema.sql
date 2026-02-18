
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
