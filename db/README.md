# SQLite database for Morning Blotter

This folder holds the **SQLite** trade database used by the optional FastAPI backend and ready for **Vanna** (text-to-SQL).

## Generate the database

From the **project root**:

```bash
python3 -c "from db.generate_sqlite import generate_database; generate_database(2500, 10)"
```

- Creates `db/morning_blotter.db` (trades, securities, counterparties, traders, desks).
- Writes `db/schema.sql` (DDL + views) for documentation and Vanna training.

## Schema overview

- **counterparties**, **desks**, **traders** – reference data.
- **securities** – instruments (CUSIP, ticker, product, tenor, BCLASS, etc.).
- **trades** – main fact table (FKs to securities, counterparties, traders).
- **v_trades_full** – joined view (one row per trade with security/counterparty/trader/desk).
- **v_daily_summary**, **v_counterparty_activity**, **v_trader_performance** – summary views.

Column names in the DB are **snake_case**; the API converts to **camelCase** for the frontend.

## Vanna

Use `schema.sql` (and optionally sample questions) to train Vanna, and point it at `morning_blotter.db` for execution. Tables and views are documented in `schema.sql`.
