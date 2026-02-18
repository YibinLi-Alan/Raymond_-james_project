# Morning Blotter - Post-Trade Analytics Dashboard

A real-time post-trade analytics dashboard built with React, featuring interactive visualizations and a flexible dockable panel layout.

## Features

### Trade Blotter Grid
- AG Grid-powered trade blotter with 2,500+ trades (from **SQLite** when the API is running, or in-memory mock otherwise)
- Sortable, filterable columns with custom set filters
- Quick filter search across all fields
- Row selection with keyboard shortcuts (Ctrl+C to copy, Ctrl+Shift+C for column panel)
- Export to Excel functionality

### Intraday Price Chart
- Interactive intraday eval price visualization for any security
- **Double-click a trade row** to view the CUSIP's intraday pricing (7 AM - 5 PM, 15-min intervals)
- Diamond markers show trade execution points at exact time and price
- Selected trade highlighted in green, related trades in gray
- L-shaped mark lines connect execution points to price axis
- Tooltip shows eval price and nearby trade executions

### Asset Class Breakdown
- Sunburst chart visualization of BCLASS taxonomy hierarchy
- Click segments to filter the trade grid by asset class
- 4-level hierarchy: Asset Class > Group > Sector > Sub-Sector

### Daily Insights Panel
- Summary statistics for filtered trades
- Trade count and total notional display

### Flexible Layout
- Dockview-powered panel system
- Drag and drop to rearrange panels
- Close/restore panels via dropdown menu
- Persistent layout (auto-saved to localStorage)

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **AG Grid** - High-performance data grid
- **ECharts** - Interactive charting library
- **Dockview** - Flexible docking layout system
- **Zustand** - State management
- **date-fns** - Date manipulation
- **SQLite** - Trade data store (same schema as in-memory mock; ready for **Vanna** text-to-SQL)
- **FastAPI** - Optional backend that serves trades from SQLite

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

The app runs at `http://localhost:5173` by default.

### Data: SQLite backend (optional)

Trade data can be served from a **SQLite database** so you can later plug in **Vanna** for natural-language SQL.

1. **Generate the database** (from project root):
   ```bash
   python3 -c "from db.generate_sqlite import generate_database; generate_database(2500, 10)"
   ```
   This creates `db/morning_blotter.db` and `db/schema.sql`.

2. **Run the API** (from project root):
   ```bash
   pip install fastapi uvicorn   # or use a venv
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```
   Then open the app at `http://localhost:5173`. It will load trades from `GET http://localhost:8000/api/trades`. If the API is not running, the app falls back to in-memory mock data.

3. **Vanna**: Use `db/schema.sql` and `db/morning_blotter.db` with [Vanna](https://github.com/vanna-ai/vanna) for text-to-SQL. The schema includes tables `trades`, `securities`, `counterparties`, `traders`, `desks` and views such as `v_trades_full`, `v_daily_summary`, `v_counterparty_activity`, `v_trader_performance`.

## Usage

1. **View Trade Details**: The trade blotter shows all trades with key columns (Trade ID, Side, CUSIP, Ticker, Notional, Price, Yield, Counterparty)

2. **Intraday Price Analysis**: Double-click any trade row to see the intraday eval prices for that security. The chart displays:
   - Blue line showing price movement throughout the day
   - Diamond markers at each trade execution point
   - The selected trade highlighted in green

3. **Filter by Asset Class**: Click on the sunburst chart segments to filter trades by BCLASS classification

4. **Customize Layout**: Drag panel headers to rearrange, or use the Panels dropdown to show/hide panels

## Project Structure

```
src/
  components/
    TradeGrid.tsx          # AG Grid trade blotter
    IntradayPriceChart.tsx # Intraday eval price visualization
    BClassSunburstChart.tsx# Asset class breakdown chart
    InsightsPanel.tsx      # Summary statistics
    DockviewLayout.tsx     # Panel layout manager
    ControlBar.tsx         # Top toolbar
  data/
    relationalMockData.ts  # In-memory mock (fallback when API is down)
    evalPriceGenerator.ts  # Intraday price simulation
    bclassTaxonomy.ts      # BCLASS hierarchy
  api/
    client.ts              # Fetch trades from backend (SQLite)
db/
  generate_sqlite.py       # Generate SQLite DB + schema (same data shape as mock)
  schema.sql               # Written by generate_sqlite (for Vanna)
  morning_blotter.db       # Generated SQLite DB (optional in .gitignore)
backend/
  main.py                  # FastAPI app: GET /api/trades, GET /api/health
  db.py                    # SQLite access, camelCase response for frontend
  store/
    useBlotterStore.ts     # Zustand state management
  types/
    trade.ts               # TypeScript interfaces
```

## License

Private - All rights reserved
