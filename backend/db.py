"""
SQLite database access for Morning Blotter.
Uses db/morning_blotter.db (created by db/generate_sqlite.py).
Vanna can use db/schema.sql and this DB for text-to-SQL.
"""

import sqlite3
from pathlib import Path
from datetime import datetime

# DB path: project root / db / morning_blotter.db
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "db" / "morning_blotter.db"
SCHEMA_PATH = ROOT / "db" / "schema.sql"

# Query that returns one row per trade with all joined fields (matches frontend Trade shape).
# We use snake_case in DB; API layer converts to camelCase.
TRADES_QUERY = """
SELECT
    t.internal_trade_id,
    t.venue_execution_id,
    t.regulatory_report_id,
    t.parent_trade_id,
    t.allocation_id,
    t.trade_date,
    t.execution_timestamp,
    t.original_entry_time,
    t.settlement_date,
    t.side,
    t.notional,
    t.quantity_type_code,
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
    t.counterparty_id,
    cp.name AS counterparty_name,
    t.executing_broker_id,
    t.trader_id,
    d.id AS desk_id,
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
    s.bclass_level4
FROM trades t
JOIN securities s ON t.cusip = s.cusip
JOIN counterparties cp ON t.counterparty_id = cp.id
JOIN traders tr ON t.trader_id = tr.id
JOIN desks d ON tr.desk_id = d.id
ORDER BY t.trade_date DESC, t.execution_timestamp DESC
"""


def ensure_db():
    """Ensure database exists; if not, create it via generate_sqlite."""
    if DB_PATH.exists():
        return
    # Ensure project root is on path and generate DB
    import sys
    root = str(ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    from db.generate_sqlite import generate_database
    generate_database(2500, 10)


def get_connection():
    ensure_db()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _parse_date(s: str | None):
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def row_to_trade(row: sqlite3.Row) -> dict:
    """Convert a DB row (snake_case) to frontend Trade (camelCase) with timeToMaturityYears."""
    trade_date = _parse_date(row["trade_date"])
    maturity_date = _parse_date(row["maturity_date"])
    time_to_maturity_years = 0.0
    if trade_date and maturity_date:
        delta = maturity_date - trade_date
        time_to_maturity_years = delta.total_seconds() / (365.25 * 24 * 60 * 60)

    return {
        "internalTradeId": row["internal_trade_id"],
        "venueExecutionId": row["venue_execution_id"],
        "regulatoryReportId": row["regulatory_report_id"],
        "parentTradeId": row["parent_trade_id"],
        "allocationId": row["allocation_id"],
        "tradeDate": row["trade_date"],
        "executionTimestamp": row["execution_timestamp"],
        "originalEntryTime": row["original_entry_time"],
        "settlementDate": row["settlement_date"],
        "side": row["side"],
        "notional": row["notional"],
        "quantityTypeCode": row["quantity_type_code"] or "PAR",
        "cleanPrice": row["clean_price"],
        "priceType": row["price_type"] or "PERCENTAGE",
        "yield": row["yield"],
        "yieldType": row["yield_type"],
        "accruedInterestAmount": row["accrued_interest_amount"],
        "grossTradeAmount": row["gross_trade_amount"],
        "netMoney": row["net_money"],
        "tradeCurrency": row["trade_currency"],
        "settlementCurrency": row["settlement_currency"],
        "fxRate": row["fx_rate"],
        "notionalUsd": row["notional_usd"],
        "counterpartyId": row["counterparty_id"],
        "counterpartyName": row["counterparty_name"],
        "executingBrokerId": row["executing_broker_id"],
        "traderId": row["trader_id"],
        "deskId": row["desk_id"] or "UNKNOWN",
        "cusip": row["cusip"],
        "ticker": row["ticker"],
        "product": row["product"],
        "tenor": row["tenor"],
        "coupon": row["coupon"],
        "maturityDate": row["maturity_date"],
        "timeToMaturityYears": round(time_to_maturity_years, 6),
        "sector": row["sector"],
        "bclassLevel1": row["bclass_level1"],
        "bclassLevel2": row["bclass_level2"],
        "bclassLevel3": row["bclass_level3"],
        "bclassLevel4": row["bclass_level4"],
    }


def fetch_all_trades() -> list[dict]:
    """Return all trades as list of dicts (camelCase) for JSON response."""
    conn = get_connection()
    try:
        cur = conn.execute(TRADES_QUERY)
        return [row_to_trade(row) for row in cur.fetchall()]
    finally:
        conn.close()


def get_trades_by_ids(internal_trade_ids: list[str | int]) -> list[dict]:
    """
    Return full trade rows (camelCase) for the given internal_trade_id list.
    IDs are TEXT in DB (e.g. 'TRD-...'); pass through as-is for the IN clause.
    Preserves order of ids where possible.
    """
    if not internal_trade_ids:
        return []
    conn = get_connection()
    try:
        placeholders = ",".join("?" * len(internal_trade_ids))
        sql = (
            TRADES_QUERY.rstrip()
            .replace(
                "JOIN desks d ON tr.desk_id = d.id\nORDER BY",
                f"JOIN desks d ON tr.desk_id = d.id\nWHERE t.internal_trade_id IN ({placeholders})\nORDER BY",
            )
        )
        cur = conn.execute(sql, internal_trade_ids)
        rows = cur.fetchall()
        by_id = {row["internal_trade_id"]: row_to_trade(row) for row in rows}
        return [by_id[i] for i in internal_trade_ids if i in by_id]
    finally:
        conn.close()
