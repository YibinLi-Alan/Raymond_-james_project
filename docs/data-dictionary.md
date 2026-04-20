# Data Dictionary

This document summarizes the main data entities, key fields, and analytical views used in the Morning Blotter project.

## Primary Tables

### `counterparties`

- `id`
  - unique counterparty identifier
- `name`
  - counterparty display name
- `lei`
  - legal entity identifier when available
- `type`
  - categorical type such as asset manager, hedge fund, bank, insurance, or pension
- `tier`
  - internal tier classification

### `desks`

- `id`
  - unique desk identifier
- `name`
  - desk name
- `location`
  - desk location such as NYC, LON, HKG, or TOK
- `asset_class`
  - high-level desk asset class such as rates, credit, muni, or securitized

### `traders`

- `id`
  - unique trader identifier
- `name`
  - trader name
- `desk_id`
  - foreign key to `desks`
- `email`
  - trader email
- `hire_date`
  - trader hire date

### `securities`

- `cusip`
  - primary security identifier
- `isin`
  - ISIN when available
- `ticker`
  - issuer ticker
- `issuer_name`
  - issuer display name
- `product`
  - product category
- `tenor`
  - maturity bucket or tenor label
- `coupon`
  - coupon rate
- `maturity_date`
  - maturity date
- `issue_date`
  - issue date
- `sector`
  - sector grouping
- `bclass_level1` to `bclass_level4`
  - hierarchical Bloomberg-style classification fields
- `rating`
  - security rating when available
- `callable_flag`
  - callable indicator
- `putable_flag`
  - putable indicator

### `trades`

- `internal_trade_id`
  - unique internal trade identifier
- `cusip`
  - foreign key to `securities`
- `counterparty_id`
  - foreign key to `counterparties`
- `trader_id`
  - foreign key to `traders`
- `executing_broker_id`
  - optional broker reference
- `venue_execution_id`
  - external execution ID when present
- `regulatory_report_id`
  - external reporting ID when present
- `parent_trade_id`
  - parent linkage for block/allocation relationships
- `allocation_id`
  - allocation linkage
- `trade_date`
  - trade date
- `execution_timestamp`
  - trade execution timestamp
- `original_entry_time`
  - original system entry time
- `settlement_date`
  - settlement date
- `side`
  - BUY or SELL
- `notional`
  - trade quantity/notional in trade currency units
- `quantity_type_code`
  - currently modeled as `PAR`
- `clean_price`
  - quoted clean price
- `price_type`
  - price representation type
- `yield`
  - trade yield when applicable
- `yield_type`
  - yield convention
- `accrued_interest_amount`
  - accrued interest amount
- `gross_trade_amount`
  - gross amount
- `net_money`
  - net settlement money
- `trade_currency`
  - trade currency
- `settlement_currency`
  - settlement currency
- `fx_rate`
  - FX conversion rate if needed
- `notional_usd`
  - USD-normalized notional

## Frontend Trade Model

The frontend `Trade` interface in `src/types/trade.ts` exposes the most important combined fields:

- trade identity
  - `internalTradeId`, `tradeDate`, `executionTimestamp`, `settlementDate`
- economics
  - `notional`, `cleanPrice`, `yield`, `grossTradeAmount`, `netMoney`, `notionalUsd`
- instrument
  - `cusip`, `ticker`, `product`, `tenor`, `coupon`, `maturityDate`, `sector`
- party information
  - `counterpartyId`, `counterpartyName`, `traderId`, `deskId`
- classification
  - `bclassLevel1`, `bclassLevel2`, `bclassLevel3`, `bclassLevel4`
- derived field
  - `timeToMaturityYears`

## Analytical Views

### `v_trades_full`

Joined trade-level view combining:

- trade fields
- security attributes
- counterparty attributes
- trader attributes
- desk attributes

Use this view for:

- row-level AI trade queries
- full trade-context analysis
- chart and table outputs that need descriptive labels

### `v_daily_summary`

Daily aggregated summary by:

- `trade_date`
- `product`
- `side`

Includes:

- `trade_count`
- `total_notional_usd`
- `avg_price`
- `avg_yield`

### `v_counterparty_activity`

Counterparty activity summary including:

- `counterparty_id`
- `counterparty_name`
- `tier`
- `trade_count`
- `total_notional_usd`
- `active_days`
- `first_trade_date`
- `last_trade_date`

### `v_trader_performance`

Trader-level summary including:

- `trader_id`
- `trader_name`
- `desk_name`
- `asset_class`
- `trade_count`
- `total_notional_usd`
- `buy_notional_usd`
- `sell_notional_usd`

## Notes For Developers

- The backend returns trade data in camelCase-friendly form for the frontend.
- The AI layer relies heavily on `v_trades_full` and the aggregate views for text-to-SQL.
- Relative-date prompts such as "today" are interpreted against the latest trade date in the sample database, not necessarily the system date.
