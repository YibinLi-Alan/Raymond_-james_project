# Morning Blotter - Post-Trade Analytics Dashboard

A real-time post-trade analytics dashboard built with React, featuring interactive visualizations and a flexible dockable panel layout.

## Features

### Trade Blotter Grid
- AG Grid-powered trade blotter with 2,500+ trades (from **SQLite** when the API is running, or in-memory mock otherwise)
- Sortable, filterable columns with custom set filters
- Quick filter search across all fields
- Row selection with keyboard shortcuts (Ctrl+C to copy, Ctrl+Shift+C for column panel)
- Export to Excel functionality
- **Smart export**: if the AI Data Query returned tabular `data`, Export downloads that result; otherwise it exports the full trade list
- **Row highlighting**: size anomalies from `/api/anomalies` are styled in the grid with tooltips; AI queries can return `anomalyTradeIds` to mark additional outlier rows
- On first load, the first visible trade is auto-selected so the intraday panel has an immediate context (when data is available)

### Intraday Price Chart
- Interactive intraday eval price visualization for any security
- **Double-click a trade row** to view the CUSIP's intraday pricing (7 AM - 5 PM, 15-min intervals)
- Diamond markers show trade execution points at exact time and price
- Selected trade highlighted in green, related trades in gray
- L-shaped mark lines connect execution points to price axis
- Tooltip shows eval price and nearby trade executions
- When the AI returns a `chartOption`, it can **replace** the intraday chart in that panel (same slot as eval prices)

### Asset Class Breakdown
- **Sunburst** chart visualization of BCLASS taxonomy hierarchy
- **Treemap** panel with the same BCLASS hierarchy and click-to-filter behavior
- Click segments to filter **`displayTrades`** (insights, treemap/sunburst context, yield scatter, anomalies, etc.); the AG Grid blotter itself still loads the **full** trade list (toggle the same segment again to clear)
- 4-level hierarchy: Asset Class > Group > Sector > Sub-Sector

### Yield Curve (Scatter)
- Optional panel: scatter plot of **time to maturity vs yield**, colored by top-level asset class (`YieldCurveScatterPanel`)

### Daily Insights Panel
- Summary statistics for filtered trades
- Trade count and total notional display
- Numbers follow **`displayTrades`**: when an AI Data Query returns a `trades` array, panels that bind to `displayTrades` (insights, BCLASS charts, yield scatter, anomalies) reflect that result set; the **Trade Blotter grid** is wired to the **full** `allTrades` list from the API/mock so row-level browsing stays complete
- The toolbar **date range** preset is stored with saved views and is included in **AI query context** (it does not, by itself, re-query or slice the SQLite dataset in `App.tsx`)

### Flexible Layout
- Dockview-powered panel system
- Drag and drop to rearrange panels
- Close/restore panels via dropdown menu (checkmarks reflect only panels currently visible)
- Persistent layout (auto-saved to localStorage)
- **Default visible panels**: AI Assistant, AI Data Table, and Daily Insights — open **Trade Blotter** from the Panels menu when you need the full grid
- **At most four panels** visible at once; opening a **chart** panel switches to an overlay-style layout (AI Assistant stays fixed, active chart uses the remaining area)
- **Trade Blotter** and **AI Data Table** can replace each other when the layout is at capacity (so you can still swap them without closing AI)
- **Columns** button opens the AG Grid column tool panel (separate from the Panels menu)

### Anomaly Detection
- Backend endpoint **`GET /api/anomalies`**: statistical size anomalies (log-notional z-scores per counterparty) and frequency anomalies (trade-count vs historical daily average), plus **day notional percentile** and computation timestamp
- Fetched automatically after trades load when the API is up; **failures are non-fatal** — the dashboard still runs without anomaly data
- **Anomalies** panel: charts, sortable tables, tabs (all / size / frequency), optional methodology section, and row actions that focus a trade in the blotter context

### AI Assistant
- **Data Query mode**: Natural-language SQL over trade data (e.g., "show notional by product", "chart volume by counterparty")
- **General Chat mode**: Ask questions about your data, with context from the last query
- **AI-generated charts**: Bar, line, pie, area, scatter, and doughnut charts; request a type (e.g., "I want a pie chart") and the AI will regenerate
- Responses can include **`trades`** shaped like `v_trades_full` rows — when present, **`displayTrades`** (insights, classification charts, yield scatter, anomalies) use that set; the trade grid continues to show the full loaded dataset
- Optional **`anomalyTradeIds`** in the AI response for extra outlier highlighting in the trade grid

### Saved Views
- Save the current grid configuration (columns, filters, sort, grouping, date range) from the toolbar
- Load or delete saved views; **up to 50** stored names; state is **persisted in the browser** (Zustand `persist`)

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **AG Grid** - High-performance data grid
- **ECharts** - Interactive charting library
- **Dockview** - Flexible docking layout system
- **Zustand** - State management
- **date-fns** - Date manipulation
- **SQLite** - Trade data store (same schema as in-memory mock)
- **FastAPI** - Backend API (trades, AI endpoints)
- **AWS Bedrock** - Claude for AI text-to-SQL and chart generation

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Python 3.9+ (for backend and SQLite generation)

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

**Configure API base URL** (optional): set `VITE_API_BASE_URL` (e.g. `http://localhost:8000`) so the frontend and AI client call a non-default host/port.

### Data: SQLite backend (optional)

Trade data can be served from a **SQLite database** so you can later plug in **Vanna** for natural-language SQL.

1. **Generate the database** (from project root):
   ```bash
   python3 -c "from db.generate_sqlite import generate_database; generate_database(2500, 10)"
   ```
   This creates `db/morning_blotter.db` and `db/schema.sql`.

2. **Run the API** (from project root):
   ```bash
   pip install -r requirements.txt   # or use a venv
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```
   Then open the app at `http://localhost:5173`. It will load trades from `GET /api/trades` and anomalies from `GET /api/anomalies` (same base URL). If the API is not running, the app falls back to in-memory mock data and skips anomaly enrichment.

**Refresh** behavior: with SQLite data, Refresh refetches trades from the API; in mock mode it reloads the page.

3. **AI features (optional)** – requires AWS Bedrock:
   ```bash
   cp backend/bedrock_credentials.env.example backend/bedrock_credentials.env
   # Edit bedrock_credentials.env and add your AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID
   ```
   Do not commit `bedrock_credentials.env`. The AI Assistant uses Claude on Bedrock for text-to-SQL and chart generation.

4. **Vanna**: The backend uses `db/schema.sql` and `db/morning_blotter.db` for text-to-SQL. The schema includes tables `trades`, `securities`, `counterparties`, `traders`, `desks` and views such as `v_trades_full`, `v_daily_summary`, `v_counterparty_activity`, `v_trader_performance`.

## Usage

1. **View Trade Details**: The trade blotter shows all trades with key columns (Trade ID, Side, CUSIP, Ticker, Notional, Price, Yield, Counterparty)

2. **Intraday Price Analysis**: Double-click any trade row to see the intraday eval prices for that security. The chart displays:
   - Blue line showing price movement throughout the day
   - Diamond markers at each trade execution point
   - The selected trade highlighted in green

3. **Filter by Asset Class**: Click sunburst or treemap segments to filter the **analytic panels** tied to `displayTrades` by BCLASS (the blotter grid keeps the full dataset for lookup)

4. **Customize Layout**: Use the Panels dropdown to show/hide panels. When a chart overlay (e.g., AI Graph) is active, only the visible panels are checked.

5. **AI Data Query**: In the AI Assistant, ask questions like "chart notional by product" or "show me volume by counterparty as a pie chart". You can request specific chart types (pie, bar, line, area, scatter, doughnut).

6. **Date range**: Use the toolbar presets (yesterday, last 7 / 30 trading days, month-to-date, custom) so AI queries receive that range in context and saved views can restore it.

7. **Keyboard**: **Ctrl+F** focuses the quick filter; **Escape** clears the quick filter, BCLASS chart filter, and any active product/date chart selection held in app state.

## Project Structure

```
src/
  components/
    TradeGrid.tsx              # AG Grid trade blotter
    IntradayPriceChart.tsx     # Intraday eval price visualization
    BClassSunburstChart.tsx    # Asset class sunburst
    BClassTreemapChart.tsx     # Asset class treemap
    YieldCurveScatterPanel.tsx # Maturity vs yield scatter
    InsightsPanel.tsx          # Summary statistics
    AIAssistant.tsx            # AI Data Query + General Chat
    AIGraphPanel.tsx           # AI-generated chart display
    AIDataTablePanel.tsx       # AI query result table
    AnomaliesPanel.tsx         # Anomaly charts + tables
    DockviewLayout.tsx         # Panel layout manager
    ControlBar.tsx             # Top toolbar (date range, views, actions)
    PanelsDropdown.tsx         # Show/hide panels
    ColumnsButton.tsx          # AG Grid column panel trigger
    SavedViewsDropdown.tsx     # Save/load/delete views
  data/
    relationalMockData.ts  # In-memory mock (fallback when API is down)
    evalPriceGenerator.ts  # Intraday price simulation
    bclassTaxonomy.ts      # BCLASS hierarchy
  api/
    client.ts              # Fetch trades from backend (SQLite)
  store/
    useBlotterStore.ts     # Zustand state management
  types/
    trade.ts               # TypeScript interfaces
db/
  generate_sqlite.py       # Generate SQLite DB + schema (same data shape as mock)
  schema.sql               # Written by generate_sqlite (for Vanna)
  morning_blotter.db       # Generated SQLite DB (optional in .gitignore)
backend/
  main.py                  # FastAPI app: /api/trades, /api/health, AI routes
  ai_routes.py             # AI Data Query + General Chat endpoints
  anomaly_routes.py        # GET /api/anomalies
  anomaly_service.py       # Statistical anomaly computation
  vanna_service.py         # Text-to-SQL, chart generation (Bedrock)
  bedrock_credentials.py   # Loads backend/bedrock_credentials.env
  db.py                    # SQLite access, camelCase response for frontend
contexts/
  DatabaseContext.tsx      # React context for the active trade source (API or mock)
```

## License

Private - All rights reserved
