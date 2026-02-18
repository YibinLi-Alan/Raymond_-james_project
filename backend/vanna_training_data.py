"""
Vanna training data: DDL, documentation strings, and few-shot SQL examples.
Imported by vanna_service.train_vanna().
"""

# ---------------------------------------------------------------------------
# DDL (schema) — loaded from db/schema.sql or inline for training
# ---------------------------------------------------------------------------
DDL = """
-- Morning Blotter: Fixed Income Post-Trade Analytics

CREATE TABLE counterparties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lei TEXT,
    type TEXT NOT NULL,
    tier INTEGER NOT NULL
);

CREATE TABLE desks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    asset_class TEXT NOT NULL
);

CREATE TABLE traders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    desk_id TEXT NOT NULL REFERENCES desks(id),
    email TEXT NOT NULL,
    hire_date TEXT NOT NULL
);

CREATE TABLE securities (
    cusip TEXT PRIMARY KEY,
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
    bclass_level4 TEXT NOT NULL
);

CREATE TABLE trades (
    internal_trade_id TEXT PRIMARY KEY,
    cusip TEXT NOT NULL REFERENCES securities(cusip),
    counterparty_id TEXT NOT NULL REFERENCES counterparties(id),
    trader_id TEXT NOT NULL REFERENCES traders(id),
    trade_date TEXT NOT NULL,
    execution_timestamp TEXT NOT NULL,
    settlement_date TEXT NOT NULL,
    side TEXT NOT NULL,
    notional REAL NOT NULL,
    clean_price REAL NOT NULL,
    yield REAL,
    yield_type TEXT,
    gross_trade_amount REAL NOT NULL,
    net_money REAL NOT NULL,
    trade_currency TEXT NOT NULL,
    notional_usd REAL NOT NULL
);

CREATE VIEW v_trades_full AS
SELECT t.internal_trade_id, t.trade_date, t.execution_timestamp, t.side, t.notional,
       t.clean_price, t.yield, t.yield_type, t.notional_usd,
       s.cusip, s.ticker, s.issuer_name, s.product, s.tenor, s.sector,
       s.bclass_level1, s.bclass_level2, s.bclass_level3, s.bclass_level4,
       cp.name AS counterparty_name, tr.name AS trader_name, d.name AS desk_name
FROM trades t
JOIN securities s ON t.cusip = s.cusip
JOIN counterparties cp ON t.counterparty_id = cp.id
JOIN traders tr ON t.trader_id = tr.id
JOIN desks d ON tr.desk_id = d.id;

CREATE VIEW v_daily_summary AS
SELECT t.trade_date, s.product, t.side,
       COUNT(*) AS trade_count, SUM(t.notional_usd) AS total_notional_usd
FROM trades t JOIN securities s ON t.cusip = s.cusip
GROUP BY t.trade_date, s.product, t.side;

CREATE VIEW v_counterparty_activity AS
SELECT cp.id AS counterparty_id, cp.name AS counterparty_name, cp.tier,
       COUNT(*) AS trade_count, SUM(t.notional_usd) AS total_notional_usd,
       COUNT(DISTINCT t.trade_date) AS active_days,
       MIN(t.trade_date) AS first_trade_date, MAX(t.trade_date) AS last_trade_date
FROM trades t JOIN counterparties cp ON t.counterparty_id = cp.id
GROUP BY cp.id, cp.name, cp.tier;

CREATE VIEW v_trader_performance AS
SELECT tr.id AS trader_id, tr.name AS trader_name, d.name AS desk_name, d.asset_class,
       COUNT(*) AS trade_count, SUM(t.notional_usd) AS total_notional_usd,
       SUM(CASE WHEN t.side = 'BUY' THEN t.notional_usd ELSE 0 END) AS buy_notional_usd,
       SUM(CASE WHEN t.side = 'SELL' THEN t.notional_usd ELSE 0 END) AS sell_notional_usd
FROM trades t JOIN traders tr ON t.trader_id = tr.id JOIN desks d ON tr.desk_id = d.id
GROUP BY tr.id, tr.name, d.name, d.asset_class;
"""

# ---------------------------------------------------------------------------
# Documentation (business terminology)
# ---------------------------------------------------------------------------
DOCS = [
    "Notional is the par amount of the bond in trade currency. notional_usd is notional converted to USD.",
    "clean_price is the bond price as a percentage of par (e.g. 99.5 means 99.5%).",
    "yield is the bond yield (e.g. YTM); it is populated for trades in the dataset. Use WHERE yield IS NOT NULL to filter.",
    "Side is either BUY or SELL. Product is asset type: US Treasury, Investment Grade Corp, High Yield Corp, Municipal, Agency MBS.",
    "Tenor is the maturity bucket: 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y.",
    "BCLASS is Bloomberg classification: bclass_level1 (e.g. Government, Corporate), level2 (e.g. Treasuries, Financials), level3, level4.",
    "v_trades_full is the main view joining trades with securities, counterparties, traders, and desks. For any question that asks for a list of trades to show in the Trade Blotter (top N by price/yield, today's trades, trades for a ticker, or trades by top N traders), always return full trade rows: use SELECT * FROM v_trades_full with WHERE/ORDER BY/LIMIT so the dashboard grid columns match.",
    "Always return Trade Blotter-shaped data: use SELECT * FROM v_trades_full so every result has all columns. For 'top N by price' use ORDER BY clean_price DESC LIMIT N; for 'trades from top N traders by amount/count' use the subquery pattern.",
    "Top 10 by price / top 10 order by price: Use the simple query SELECT * FROM v_trades_full ORDER BY clean_price DESC LIMIT 10. Do not use a subquery over traders. Same for 'give me top 10 trader order by price' or 'top 10 trades by price'.",
    "Trades from top N traders by amount or count (not by price): use subquery to get top N trader_ids (e.g. from v_trader_performance ORDER BY total_notional_usd DESC LIMIT 10), then SELECT * FROM v_trades_full WHERE internal_trade_id IN (SELECT internal_trade_id FROM trades WHERE trader_id IN (subquery)) ORDER BY trade_date DESC, execution_timestamp DESC.",
    "When the user asks for 'only N results' or 'just N rows', add LIMIT N to the outer query.",
    "trade_date is stored as YYYY-MM-DD. For 'today' use trade_date = date('now'). Sample data may have dates in the recent past; for 'recent' or 'latest' use trade_date >= date('now', '-7 days') or similar.",
    "v_daily_summary aggregates trade count and total notional by trade_date, product, and side.",
    "v_counterparty_activity columns: counterparty_id, counterparty_name, tier, trade_count, total_notional_usd, active_days, first_trade_date, last_trade_date. Use these exact names.",
    "v_trader_performance columns: trader_id, trader_name, desk_name, asset_class, trade_count, total_notional_usd, buy_notional_usd, sell_notional_usd. Use these exact names (no column named 'id').",
    "Two types of results: (1) Trade Blotter: when the user asks for a list of trades (top N trades, trades for ticker, trades from top N traders), use SELECT * FROM v_trades_full so the blotter and charts update. (2) AI Data Table: when the user asks only for summary/aggregate data (e.g. 'average price by trader', 'total notional by product', 'count by counterparty') without asking to show trades, return the aggregate query with the relevant columns (e.g. from v_trader_performance, v_counterparty_activity, or GROUP BY); that result is shown in the AI Data Table panel.",
    # --- SQL clauses (LIMIT, ORDER BY) ---
    "ORDER BY: Controls sort order. Place after WHERE and GROUP BY. Syntax: ORDER BY col1 [ASC|DESC], col2 [ASC|DESC]. Default is ASC. Use DESC for 'highest first' or 'most recent first' (e.g. ORDER BY total_notional_usd DESC, trade_date DESC).",
    "LIMIT: Restricts number of rows returned. Place at the end: ORDER BY ... LIMIT N. Use for 'top N' (e.g. LIMIT 10) or to cap result size. LIMIT applies after ORDER BY, so 'ORDER BY price DESC LIMIT 5' returns the 5 highest prices.",
    # --- Subqueries ---
    "Subquery in WHERE: Use IN (SELECT ...) to filter by a set, e.g. WHERE trader_id IN (SELECT trader_id FROM v_trader_performance ORDER BY total_notional_usd DESC LIMIT 10). The inner SELECT must return one column.",
    "Subquery in FROM (derived table): Use (SELECT ...) AS alias to use a query result as a table. Always give an alias, e.g. (SELECT trader_id, AVG(clean_price) AS avg_price FROM trades GROUP BY trader_id ORDER BY avg_price DESC LIMIT 10) AS top_traders. Then reference it: FROM ... WHERE trader_id IN (SELECT trader_id FROM top_traders).",
    "Scalar subquery: A subquery that returns one row and one column can be used where a value is needed, e.g. SELECT *, (SELECT AVG(clean_price) FROM trades) AS overall_avg FROM v_trades_full.",
    # --- CTEs (Common Table Expressions) ---
    "CTE (WITH clause): Use for readability or multi-step logic. Syntax: WITH cte_name AS (SELECT ... FROM ... WHERE ...) SELECT ... FROM cte_name JOIN ... or WHERE col IN (SELECT col FROM cte_name). You can chain multiple CTEs: WITH first AS (...), second AS (SELECT ... FROM first) SELECT ... FROM second.",
    "Use a CTE when the same subquery is used more than once, or when the logic is easier to read in steps (e.g. WITH top_traders AS (SELECT trader_id FROM v_trader_performance ORDER BY total_notional_usd DESC LIMIT 10) SELECT * FROM v_trades_full WHERE internal_trade_id IN (SELECT internal_trade_id FROM trades WHERE trader_id IN (SELECT trader_id FROM top_traders)) ORDER BY trade_date DESC).",
    # --- Window functions (SQLite 3.25+) ---
    "Window function: Computes a value per row using a partition and optional order. Syntax: function_name(...) OVER (PARTITION BY col1, col2 ORDER BY col3 [ASC|DESC]). PARTITION BY splits rows into groups; the function is computed within each group. ORDER BY defines order within the partition (for ranking and running totals).",
    "ROW_NUMBER() OVER (PARTITION BY col ORDER BY sort_col): Assigns 1, 2, 3, ... within each partition. Use to get 'top N per group', e.g. WHERE rn <= 10 after wrapping in a subquery.",
    "RANK() OVER (ORDER BY col): Same rank for ties; next rank skips (1,2,2,4). DENSE_RANK(): no skip (1,2,2,3). Use for ranking by a metric.",
    "Aggregate as window: SUM(notional_usd) OVER (PARTITION BY trader_id) AS trader_total, AVG(clean_price) OVER (PARTITION BY product). Use to add running totals or group averages alongside each row without GROUP BY.",
]

# ---------------------------------------------------------------------------
# Few-shot question-SQL pairs (improve generation quality)
# ---------------------------------------------------------------------------
QUESTION_SQL_PAIRS = [
    ("How many trades did we do today?", "SELECT COUNT(*) AS trade_count FROM trades WHERE trade_date = date('now');"),
    ("Total notional in USD by product", "SELECT s.product, SUM(t.notional_usd) AS total_notional_usd FROM trades t JOIN securities s ON t.cusip = s.cusip GROUP BY s.product ORDER BY total_notional_usd DESC;"),
    ("Show all BUY trades for the last 7 days", "SELECT * FROM v_trades_full WHERE side = 'BUY' AND trade_date >= date('now', '-7 days') ORDER BY trade_date DESC, execution_timestamp DESC;"),
    ("Which counterparties have the most trades?", "SELECT counterparty_id, counterparty_name, trade_count, total_notional_usd FROM v_counterparty_activity ORDER BY trade_count DESC LIMIT 10;"),
    ("Daily notional by product and side", "SELECT trade_date, product, side, trade_count, total_notional_usd FROM v_daily_summary ORDER BY trade_date DESC, total_notional_usd DESC;"),
    ("Trades for ticker AAPL", "SELECT * FROM v_trades_full WHERE ticker = 'AAPL' ORDER BY trade_date DESC;"),
    ("Average yield by product", "SELECT s.product, AVG(t.yield) AS avg_yield FROM trades t JOIN securities s ON t.cusip = s.cusip WHERE t.yield IS NOT NULL GROUP BY s.product;"),
    ("Top 10 trades by yield", "SELECT * FROM v_trades_full WHERE yield IS NOT NULL ORDER BY yield DESC LIMIT 10;"),
    ("Top 10 trades by price", "SELECT * FROM v_trades_full ORDER BY clean_price DESC LIMIT 10;"),
    ("Give me top 10 trader order by price", "SELECT * FROM v_trades_full ORDER BY clean_price DESC LIMIT 10;"),
    ("Today's trades by price", "SELECT * FROM v_trades_full WHERE trade_date = date('now') ORDER BY clean_price DESC LIMIT 10;"),
    ("Total notional by trader", "SELECT trader_id, trader_name, desk_name, trade_count, total_notional_usd FROM v_trader_performance ORDER BY total_notional_usd DESC;"),
    ("Top 10 traders by trading amount", "SELECT * FROM v_trades_full WHERE internal_trade_id IN (SELECT internal_trade_id FROM trades WHERE trader_id IN (SELECT trader_id FROM v_trader_performance ORDER BY total_notional_usd DESC LIMIT 10)) ORDER BY trade_date DESC, execution_timestamp DESC;"),
    ("Average price by trader (summary only)", "SELECT tr.id AS trader_id, tr.name AS trader_name, AVG(t.clean_price) AS avg_price, COUNT(*) AS trade_count FROM trades t JOIN traders tr ON t.trader_id = tr.id GROUP BY tr.id, tr.name ORDER BY avg_price DESC;"),
    ("Total notional by counterparty (summary)", "SELECT counterparty_id, counterparty_name, trade_count, total_notional_usd FROM v_counterparty_activity ORDER BY total_notional_usd DESC LIMIT 20;"),
    # CTE example: top traders then their trades
    ("Trades from top 10 traders by notional (using CTE)", "WITH top_traders AS (SELECT trader_id FROM v_trader_performance ORDER BY total_notional_usd DESC LIMIT 10) SELECT * FROM v_trades_full WHERE internal_trade_id IN (SELECT internal_trade_id FROM trades WHERE trader_id IN (SELECT trader_id FROM top_traders)) ORDER BY trade_date DESC, execution_timestamp DESC;"),
    # Window function: rank traders by total notional
    ("Rank traders by total notional (window function)", "SELECT trader_id, trader_name, total_notional_usd, RANK() OVER (ORDER BY total_notional_usd DESC) AS rank_by_notional FROM v_trader_performance ORDER BY rank_by_notional LIMIT 20;"),
    # Window function: top 3 trades per product by notional
    ("Top 3 trades per product by notional", "SELECT * FROM (SELECT v.*, ROW_NUMBER() OVER (PARTITION BY product ORDER BY notional_usd DESC) AS rn FROM v_trades_full v) AS t WHERE rn <= 3 ORDER BY product, rn;"),
]
