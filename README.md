# Morning Blotter - Post-Trade Analytics Dashboard

A real-time post-trade analytics dashboard built with React, featuring interactive visualizations and a flexible dockable panel layout.

## Executive Summary

Morning Blotter is a fixed-income post-trade analytics platform built to help users explore trading activity, monitor statistical anomalies, and ask natural-language questions about trade data through an AI-assisted workflow. The system combines a React frontend, a FastAPI backend, a SQLite data layer, and AWS Bedrock-powered AI services to create a single workspace for blotter review, chart-based analysis, anomaly detection, and AI-generated insights.

In the `final` branch, the project includes:

- an interactive AG Grid trade blotter
- dockable analytics panels powered by Dockview
- anomaly detection for unusual trade size and counterparty activity
- AI data query and AI chat modes
- AI-generated charts and tables
- SQLite-backed trade retrieval with mock-data fallback
- saved views and persistent grid/date settings

This repository is intended to be both a working codebase and a developer handoff package. The README and supporting documentation are written so a new engineer can understand what the project does, how to run it, what is safe to share under NDA, and where the main technical entry points are.

## Repository Handoff Checklist

This repository now includes or documents the following handoff items:

- `README.md`
  - project purpose
  - how to run the code
  - what is included
  - technical walkthrough
  - contact handoff section
- `data-access.md`
  - what data is safe to share under NDA
  - what should not be uploaded
- `src/`
  - clear frontend entry points
- `backend/`
  - clear backend entry points
- `requirements.txt`
  - Python backend dependencies
- `docs/`
  - data dictionary
  - API and usage notes
  - license/IP/NDA note
- `results/`
  - placeholder folder for sample outputs and approved artifacts

## Repository Entry Points

For developers opening the codebase for the first time, these are the most important files to start with:

- `src/main.tsx`
  - frontend bootstrap entry point
- `src/App.tsx`
  - main frontend orchestration layer
- `src/store/useBlotterStore.ts`
  - shared application state
- `src/components/DockviewLayout.tsx`
  - panel layout manager
- `backend/main.py`
  - FastAPI entry point
- `backend/ai_routes.py`
  - AI endpoints
- `backend/anomaly_routes.py`
  - anomaly endpoint
- `backend/vanna_service.py`
  - main AI logic and text-to-SQL behavior
- `db/schema.sql`
  - relational schema and analytical views

## What Is Included In This Repository

The repository includes:

- frontend application code in `src/`
- backend API code in `backend/`
- SQLite schema and generator code in `db/`
- project dependencies in `package.json` and `requirements.txt`
- technical documentation in `README.md`, `docs/`, and `technicalspec.md`
- AI/Vanna training and prompt support files in the backend
- example database artifacts used for local development

The repository should not be treated as a place to upload confidential sponsor raw data unless the sponsor has explicitly approved that use and the repository is private and NDA-compliant.

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

## Update/Testing Branch Guide

This section explains what the `Update/Testing` branch is doing, which tools and technologies it relies on, how it differs from the `final` branch, and which files are responsible for the behavior. The goal is to make it easy for developers to understand the branch without having to reconstruct the history from Git commits.

### Important Branch Context

There are two slightly different versions of this branch in the repository history:

- `origin/Update/Testing`: the remote branch centered on the AI assistant and Vanna workflow
- `Update/Testing`: the local branch, which also includes anomaly-detection work merged in from another line of development

This matters because if a developer checks the remote branch, they mainly get the AI assistant expansion. If they check the local branch, they get the AI assistant expansion plus anomaly-detection integration.

The most important commits are:

- `c88749f` on March 27, 2026: adds `UPDATEREADME.md`
- `c71aebd` on March 31, 2026: `feat: expand AI assistant and Vanna workflow`
- `167d43a` on March 31, 2026: local merge commit using the remote version of `DockviewLayout.tsx`

### What This Branch Is Trying To Do

The purpose of `Update/Testing` is to move the dashboard from a mainly panel-driven analytics app into a more guided AI-assisted analysis workflow.

Before this update, the app already had:

- a trade blotter
- charts and insights panels
- anomaly detection support
- an AI assistant capable of natural-language querying

The `Update/Testing` branch pushes the AI workflow further by making the assistant more structured, more user-guiding, and more presentation-friendly.

At a high level, the branch adds or improves:

- guided natural-language prompts
- formally supported AI query types
- short and detailed explanation modes
- automatic chart and table generation for analytical questions
- better handling of "today" and "yesterday" in sample data
- improved AI result presentation inside the UI
- in the local branch, anomaly integration alongside the AI workflow

### Tools And Technologies Used For This Update

The feature work in `Update/Testing` uses the following tools, libraries, and systems:

- **React 19**: used for the frontend interface and component-driven UI updates
- **TypeScript**: used for type-safe API calls, component props, and UI state
- **Vite**: used for local frontend development and bundling
- **FastAPI**: used for backend endpoints such as AI query, AI chat, and anomaly APIs
- **SQLite**: used as the source database for trade and analytics data
- **AWS Bedrock / Claude**: used for AI chat, text-to-SQL generation, summaries, and chart suggestion support
- **Vanna-style text-to-SQL workflow**: used in the backend service layer to map natural-language prompts to SQL over the trade database
- **AG Grid**: used for the trade blotter and AI result table rendering
- **ECharts**: used for AI-generated charts and chart display in the result panels
- **Dockview**: used for the panel-based workspace layout
- **Zustand**: used for shared state such as AI results, panel state, anomaly state, and context snapshots
- **date-fns**: used for date formatting and toolbar range logic

For developers reading Git history, the branch was examined using standard Git comparison workflows:

- `git log` to understand branch history and commit order
- `git diff` to inspect code-level changes
- `git diff --stat` to summarize changed files
- `git merge-base` to identify where the branch diverged

### Core Behavior Added By The Remote Update/Testing Branch

The remote `origin/Update/Testing` branch is mainly about expanding the AI assistant and Vanna workflow.

#### 1. Structured AI query support

The backend now defines explicit supported query intents. Instead of leaving everything to a general LLM prompt, the app recognizes common analytics questions such as:

- most traded securities
- top traders by activity
- sector activity
- counterparty activity
- largest trades
- daily versus historical comparison
- unusual volume
- trader behavior change
- trade outliers

This makes AI responses more predictable and makes the assistant better at answering common dashboard questions.

#### 2. Better handling of relative dates

The branch changes the meaning of "today" and "yesterday" in the AI flow.

Instead of using the computer's real current date, the backend interprets relative dates using the latest available `trade_date` in the sample database. This is important because demo or sample datasets often stop before the actual calendar date. Without this fix, AI SQL queries could return empty results even when the data exists.

#### 3. Better chat responses

The assistant now supports two response styles:

- `short`
- `detailed`

The frontend asks the user how they want the answer explained, and the backend adapts the AI prompt accordingly. This makes the assistant useful for both quick summaries and fuller analytical explanations.

#### 4. More automatic visuals

If the user asks an analytical question, the backend is more willing to attach a chart and supporting table automatically. Even if the LLM-generated chart output is incomplete, the backend now has fallback chart-building logic so the UI can still show a usable graph.

#### 5. Stronger unsupported-metric guardrails

The branch explicitly blocks or redirects unsupported questions involving fields the dataset does not contain, such as:

- P&L
- VWAP
- slippage
- benchmark price
- win rate

This prevents misleading answers when the data model cannot support those metrics.

### File-By-File Explanation

This section maps the main branch behavior to the files that implement it.

#### Backend

- `backend/ai_routes.py`
  - adds `response_style` to chat requests
  - adds `GET /api/ai/supported`
  - passes the chosen explanation style into the backend chat workflow

- `backend/vanna_service.py`
  - contains the biggest logic change in the branch
  - defines supported query intents and example prompt categories
  - adds rule-based SQL routing for common business questions
  - remaps "today" and "yesterday" to the latest trade date in the database
  - blocks unsupported execution/P&L questions
  - improves graph generation and fallback chart creation
  - improves AI chat summarization and automatic visual attachment

- `backend/vanna_training_data.py`
  - teaches the text-to-SQL layer how to interpret relative dates in a sample dataset
  - adds more example question/SQL pairs for common trader, sector, volume, and anomaly questions

- `backend/main.py`
  - changes CORS behavior from localhost-only to wildcard origins
  - disables credentialed CORS
  - this makes local testing easier across environments, but developers should review this before production hardening

#### Frontend

- `src/api/client.ts`
  - updates the frontend AI chat client to send `response_style`
  - keeps the frontend and backend in sync for short vs detailed explanation requests

- `src/components/AIAssistant.tsx`
  - this is the main frontend feature file for the branch
  - adds suggestion chips for both data-query mode and general-chat mode
  - adds session-based suggestion rotation
  - adds explanation choice buttons
  - triggers either short or detailed explanations
  - improves Bedrock-related error messages
  - manages AI-produced chart/table results and keeps them in shared state
  - exposes persistent graph-type actions for the current result table

- `src/components/AIDataTablePanel.tsx`
  - upgrades the raw AI result table into a richer analysis panel
  - adds summary highlight cards
  - lets the user toggle between a table view and a graph view
  - embeds ECharts directly in the panel
  - improves column ordering and display formatting

- `src/utils/chartEnhancement.ts`
  - refines chart styling, spacing, colors, legend placement, and series formatting
  - revives formatter functions when chart options are passed through JSON
  - makes AI-generated charts look more polished and usable

- `src/components/ControlBar.tsx`
  - keeps date labels current as the day changes
  - helps the toolbar stay aligned with the active date state

- `src/components/TradeGrid.tsx`
  - updates AG Grid data assignment using `setGridOption('rowData', data)`
  - this is a compatibility/stability improvement for the grid update flow

- `src/components/DockviewLayout.tsx`
  - removes some unused props and internal constant definitions
  - the local merge commit intentionally keeps the remote branch version of this file

- `src/styles/index.css`
  - adds most of the UI polish for the branch
  - styles suggestion chips, explanation buttons, persistent chart controls, AI chart cards, and AI table highlight cards

- `src/App.tsx`
  - adjusts how AI-returned trade data is cast and passed into the app layout
  - removes an older `isAIResult` prop from the dock layout path

### Additional Local Update/Testing Changes

The local `Update/Testing` branch includes more than the remote branch. It also carries anomaly-related functionality that came from another development line.

Those local-only additions include:

- `backend/anomaly_routes.py`
- `backend/anomaly_service.py`
- `src/components/AnomaliesPanel.tsx`
- updates in `src/components/InsightsPanel.tsx`
- updates in `src/components/PanelContent.tsx`
- updates in `src/store/useBlotterStore.ts`
- extra anomaly-aware behavior in `src/components/TradeGrid.tsx`

What these local additions do:

- provide backend anomaly endpoints
- compute statistical trade anomalies
- display anomalies in a dedicated panel
- keep anomaly state in the shared frontend store
- highlight anomaly rows in the blotter
- show anomaly tooltips explaining why a row was flagged

So the local branch is effectively:

- AI workflow expansion
- Vanna workflow expansion
- richer AI result presentation
- plus anomaly detection integration

### Clean Comparison: Update/Testing vs Final

This comparison helps developers understand what is different when switching between the two branches.

#### What `final` represents

The `final` branch contains later repository changes, including README-related commits and other branch history that is not the same as the `Update/Testing` feature snapshot.

#### What `Update/Testing` represents

The `Update/Testing` branch is a feature-focused branch centered on AI-guided analysis behavior. It is not simply "the final branch plus extra code." It diverges earlier in history and contains a feature set that should be understood as a specific testing/integration state.

#### Practical difference for developers

If a developer compares `final` to `Update/Testing`, the main conceptual differences are:

- `Update/Testing` is more AI-workflow-driven
- the assistant is more guided and structured
- the branch is more explicit about supported business questions
- the branch includes explanation style switching
- the branch emphasizes table-plus-chart AI results
- the local branch version also includes anomaly work merged in

Developers should not assume `Update/Testing` is a clean fast-forward candidate without reviewing branch ancestry and merge intent.

### What To Demo Or Present From This Branch

If this branch is being shown in a demo, presentation, or handoff, these are the clearest points to emphasize:

1. The assistant now accepts more realistic business-style prompts.
2. The assistant knows how to answer specific supported analytics questions reliably.
3. The assistant can return either a short explanation or a detailed explanation.
4. The assistant can attach supporting graphs and tables more automatically.
5. The branch fixes relative-date behavior so demo data still answers "today" and "yesterday" questions correctly.
6. In the local branch, anomaly detection appears as an additional analytical capability alongside the AI workflow.

Example demo prompts:

- "What were the most traded securities today?"
- "Which traders executed the most trades today?"
- "What sectors had the most trading activity today?"
- "Compare today's trading volume to yesterday"
- "Which securities had unusual trading volume today?"
- "Did any traders change their trading behavior today?"
- "What unusual patterns occurred today?"

### Developer Notes And Risks

- The wildcard CORS configuration in `backend/main.py` is convenient for testing but should be reviewed before a stricter deployment environment.
- The branch includes both rule-based SQL and LLM-assisted logic, so future changes should preserve consistency between supported prompt definitions, training examples, and frontend suggestion chips.
- The local `Update/Testing` branch and remote `origin/Update/Testing` branch are not identical, so developers should be explicit about which one they are discussing during reviews or merges.
- Some generated `.vite` dependency files appear in branch comparisons; those are environment/build artifacts and should not be treated as core feature logic.

### Summary For Coders

If you want the shortest technical summary of the branch:

- the backend was upgraded to better understand specific natural-language trading questions
- the AI assistant was redesigned to guide the user through explanation choices and richer outputs
- the AI result table became a combined insight-and-visualization panel
- relative dates were fixed for sample data
- unsupported financial metrics were explicitly guarded
- the local version of the branch also merges anomaly detection into the same testing flow

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

## Documentation And Compliance Files

Additional handoff and governance documents are included here:

- [data-access.md](/c:/Users/VIHARIKA/OneDrive/Desktop/Capstone%20Project%20-%20Team%2012/Raymond_-james_project/data-access.md)
  - NDA-safe data sharing rules and what must not be uploaded
- [docs/data-dictionary.md](/c:/Users/VIHARIKA/OneDrive/Desktop/Capstone%20Project%20-%20Team%2012/Raymond_-james_project/docs/data-dictionary.md)
  - business/data field definitions
- [docs/api-usage.md](/c:/Users/VIHARIKA/OneDrive/Desktop/Capstone%20Project%20-%20Team%2012/Raymond_-james_project/docs/api-usage.md)
  - backend endpoint summary and usage notes
- [docs/license-ip-note.md](/c:/Users/VIHARIKA/OneDrive/Desktop/Capstone%20Project%20-%20Team%2012/Raymond_-james_project/docs/license-ip-note.md)
  - IP, NDA, and repository-use guidance

## Results Folder Guidance

The `results/` folder is the place for approved review-ready artifacts such as:

- redacted screenshots of the dashboard
- approved sample CSV or Excel exports with no confidential sponsor data
- sanitized AI query outputs
- demonstration charts generated from synthetic or approved data
- serialized models or model artifacts only if they are approved under the NDA/EPA terms

Do not place the following in `results/` unless explicitly approved:

- raw sponsor trading records
- confidential counterparty or trader extracts
- private production logs
- secret credentials
- unreviewed AI outputs containing sensitive information

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

## Complete Developer Walkthrough

This section is the coder-facing explanation of how the `final` branch works end to end. It is meant to answer the practical questions a new developer usually has:

- what the app is supposed to do
- how the frontend and backend are connected
- how data flows through the system
- how AI features work
- how anomaly detection works
- how layout and panels are managed
- which files are responsible for each feature

### What The Final Branch Contains

The `final` branch is a complete post-trade analytics dashboard with three major layers working together:

1. A panel-based frontend for blotter exploration and analytics
2. A FastAPI backend serving trade data, anomaly results, and AI endpoints
3. A SQLite-based data model used both for normal analytics and AI text-to-SQL workflows

From a user point of view, the app supports:

- browsing and filtering the trade blotter
- opening multiple analytics panels in a docked layout
- running anomaly detection on the trade population
- asking natural-language AI questions about the data
- generating charts and tables from AI answers
- saving and reloading grid and filter views

### High-Level Architecture

At runtime, the architecture looks like this:

1. The React frontend starts and renders `src/App.tsx`.
2. `App.tsx` tries to load trades from `GET /api/trades`.
3. If the API is available, SQLite-backed trades are used.
4. If the API is unavailable, the app falls back to in-memory relational mock data.
5. After trades are loaded from the API, the frontend also calls `GET /api/anomalies`.
6. Zustand stores UI state, AI results, anomaly metadata, saved views, and layout state.
7. Dockview renders the visible dashboard panels.
8. AI features call backend endpoints under `/api/ai`.
9. The backend uses SQLite schema/data plus Bedrock-powered LLM logic for chat and text-to-SQL.

### Main Runtime Flow

The central flow starts in `src/App.tsx`.

That file is the top-level orchestrator for the app. It is responsible for:

- loading trade data
- deciding whether the source is SQLite or mock
- fetching anomaly results after trades load
- computing filtered and display-ready trade sets
- calculating summary metrics
- wiring handlers into the toolbar and dock layout
- synchronizing the selected trade with the intraday chart

The most important trade collections in the app are:

- `allTrades`: the full trade population currently loaded from SQLite or mock data
- `filteredTrades`: the result after chart/date/BCLASS filters are applied
- `displayTrades`: the dataset used by analytics panels; this can be replaced by AI-returned trades

This distinction is important:

- the blotter grid is designed to stay usable as a browsing surface
- the analytics panels are allowed to react to AI-returned data
- when AI returns trade-like rows, those rows can drive insights/charts without replacing the entire app state permanently

### Frontend Feature Breakdown

#### `src/App.tsx`

This is the application coordinator.

Key responsibilities:

- loads trades from the backend
- falls back to `mockDatabase.getAllTradesJoined()` if backend loading fails
- fetches anomalies after trades load successfully
- computes `filteredTrades` from selected chart points and BCLASS filters
- computes `displayTrades` from AI results or filtered trades
- computes summary stats such as total trade count and total notional
- wires keyboard shortcuts like `Ctrl+F` and `Escape`
- creates the `DatabaseProvider`
- passes everything into `DockviewLayout`

If you want to understand the overall behavior of the frontend, this is the best first file to read.

#### `src/store/useBlotterStore.ts`

This is the central shared state store for the dashboard.

It manages:

- quick filter text
- date range state
- selected trade ID
- grid column/filter/sort/group state
- saved views
- visible panel IDs
- active chart panel
- AI result state
- last AI query context
- AI chart option
- anomaly IDs and anomaly details

This store is critical because many panels communicate indirectly through it instead of passing props deeply through the component tree.

Examples:

- the AI Assistant stores `aiQueryResult` and `aiChartOption`
- the trade grid reads anomaly IDs for highlighting
- saved views persist grid/date configuration
- the layout reads visible panels and active chart information

#### `src/components/DockviewLayout.tsx`

This file manages the panel workspace. It controls which panels are visible and how they are arranged.

Important behavior:

- AI Assistant is a core panel in the layout
- visible panels are tracked in Zustand
- there is a maximum number of simultaneously visible panels
- chart-oriented panels can switch the layout into an overlay-style presentation
- the layout can replace certain middle-slot panels with one another

This is the file to inspect when panel visibility or docking behavior changes.

#### `src/components/PanelContent.tsx`

This file maps a panel ID to the component that should be rendered.

It is effectively the routing table for the dashboard panels:

- `insights` -> `InsightsPanel`
- `grid` -> `TradeGrid`
- `intradayChart` -> `IntradayPriceChart`
- `aiAssistant` -> `AIAssistant`
- `aiDataTable` -> `AIDataTablePanel`
- `aiGraphPanel` -> `AIGraphPanel`
- `anomalies` -> `AnomaliesPanel`

If a developer adds a new panel, this file will almost always need to be updated.

#### `src/components/TradeGrid.tsx`

This is the AG Grid-powered trade blotter.

It is responsible for:

- showing the main trade rows
- supporting sort/filter/selection
- responding to quick filter changes
- opening the intraday chart context on double-click
- styling anomaly rows
- showing anomaly tooltips
- supporting export-related workflows

The grid is one of the most interactive pieces of the app, so changes here tend to affect both usability and performance.

#### `src/components/InsightsPanel.tsx`

This panel summarizes the currently active dataset, usually `displayTrades`.

It shows the high-level metrics developers and users expect first:

- trade count
- total notional
- summary statistics based on the current analytic context

This panel is useful because it reflects how the rest of the analytic layer is currently scoped.

#### `src/components/BClassSunburstChart.tsx` and `src/components/BClassTreemapChart.tsx`

These panels visualize the BCLASS hierarchy and let users filter analytical views by classification.

They do not simply act as charts. They also function as cross-filter controls:

- clicking a segment updates BCLASS filter state
- the selected filter narrows analytics panels tied to `displayTrades`
- clicking the same segment again clears the selection

#### `src/components/IntradayPriceChart.tsx`

This panel displays intraday price context for a selected trade or security.

It is driven by:

- the selected trade ID from the store
- synthetic/generated intraday data from `src/data/evalPriceGenerator.ts`
- optional AI chart replacement behavior when AI returns a chart option

This gives the dashboard a chart that is both trade-specific and interactive.

#### `src/components/AnomaliesPanel.tsx`

This is the anomaly-analysis view.

It presents:

- size anomalies
- frequency anomalies
- tables and charts for anomaly review
- actions that can connect anomalies back to trade context

This panel is frontend-only display logic, while the statistical calculations themselves are performed in the backend.

#### `src/components/AIAssistant.tsx`

This is one of the most important feature files in the project.

It handles:

- AI data-query mode
- general AI chat mode
- suggestion chips
- response style choice
- follow-up context from prior AI results
- graph regeneration requests
- pushing AI results into shared state
- opening AI result panels automatically

For developers, the key thing to understand is that the AI Assistant is not just a chat box. It is a controller for multiple downstream UI updates.

When a successful AI response comes back, it can update:

- AI messages
- AI data table contents
- AI chart option
- visible panels
- last AI context snapshot for future follow-up questions

#### `src/components/AIDataTablePanel.tsx`

This panel displays AI query results in table form and can also show a chart representation of the same result set.

It supports:

- AG Grid result display
- summary highlight cards
- graph/table switching
- ECharts rendering for AI result visualization

This panel is important because it acts as the bridge between raw AI output and human-readable analytics output.

#### `src/components/AIGraphPanel.tsx`

This panel is the standalone graph viewer for AI-generated chart options.

It exists separately from the data table so the app can support chart-focused workflows and layout switching.

#### `src/components/ControlBar.tsx`

This is the top toolbar.

It manages:

- quick filter input
- refresh behavior
- export behavior
- reset behavior
- panel controls
- date range selection
- saved-view interactions

This file is where top-level user actions usually enter the system.

### Backend Feature Breakdown

#### `backend/main.py`

This file creates the FastAPI app and wires together the backend routes.

It is responsible for:

- creating the FastAPI application
- applying CORS middleware
- mounting the AI router
- mounting the anomaly router
- exposing `/api/health`
- exposing `/api/trades`

The current version uses wildcard CORS and disables credentialed requests, which is convenient for testing but should still be reviewed for stricter deployment scenarios.

#### `backend/db.py`

This file is the SQLite access layer.

It is responsible for:

- opening the SQLite database
- reading joined trade records
- converting database rows into frontend-friendly shapes
- supporting helper fetches such as full trade rows by ID

Whenever the frontend expects camelCase trade data, this layer is part of what makes that mapping possible.

#### `backend/ai_routes.py`

This file exposes the AI API surface:

- `POST /api/ai/train`
- `GET /api/ai/supported`
- `POST /api/ai/query`
- `POST /api/ai/chat`

It is responsible for:

- validating request payloads
- checking whether Bedrock is configured
- calling the Vanna service layer
- returning data, chart options, AI summaries, and optional trade rows
- returning a context-aware chat answer and optional graph/table payloads

One particularly important behavior in this file is trade-like result handling:

- if AI SQL returns rows that look like trades, the backend fetches full trade rows
- that allows analytics panels to work properly with AI-driven result sets

#### `backend/vanna_service.py`

This is the main AI logic engine in the backend.

It handles:

- Bedrock chat calls
- text-to-SQL generation
- supported-intent definitions
- rule-based SQL generation for common questions
- chart creation and chart fallback behavior
- RAG-style chat over schema and prior context
- unsupported metric filtering
- date alias remapping such as interpreting "today" via the latest sample trade date

This file contains a large share of the application's intelligence logic. If the AI starts behaving differently, this is usually the first backend file to inspect.

#### `backend/vanna_training_data.py`

This file supplies the AI system with:

- documentation snippets
- schema guidance
- few-shot question/SQL examples

It helps the AI stay anchored to the actual database structure instead of generating random or invalid SQL.

#### `backend/anomaly_routes.py`

This file exposes `GET /api/anomalies`.

It loads the trade population from the database, runs anomaly detection, and returns:

- size anomalies
- frequency anomalies
- percentile-style day metrics
- timestamps and counts

#### `backend/anomaly_service.py`

This file contains the statistical anomaly logic.

The README feature summary references two main anomaly families:

- size anomalies based on log-notional z-scores per counterparty
- frequency anomalies based on today's count versus historical daily average

This service computes those values and turns them into a shape the frontend can render.

### API Endpoints In The Final Branch

The backend currently exposes the following main endpoints:

- `GET /api/health`
  - health/status check

- `GET /api/trades`
  - returns all trades from SQLite in frontend-compatible shape

- `GET /api/anomalies`
  - computes and returns anomaly data for the current trade dataset

- `POST /api/ai/train`
  - trains the Vanna/AI layer with schema/docs/examples

- `GET /api/ai/supported`
  - returns supported AI intent definitions

- `POST /api/ai/query`
  - natural-language data query path
  - returns data, optional chart option, optional AI summary, optional trade list, optional anomaly IDs

- `POST /api/ai/chat`
  - conversational analysis path
  - supports history, prior-result context, and response style selection

### Data Flow: Normal Dashboard Mode

When the app is being used without AI, the flow is:

1. `App.tsx` loads all trades.
2. The app stores the data source as either SQLite or mock.
3. Analytics filters such as BCLASS and chart point selection produce `filteredTrades`.
4. `displayTrades` is derived from `filteredTrades`.
5. Summary panels and analytics charts use `displayTrades`.
6. The trade grid remains available for row-level inspection.
7. When a row is double-clicked, the selected trade ID is stored and the intraday chart is updated.

### Data Flow: AI Query Mode

When the user uses AI Data Query mode, the flow is:

1. The user types a natural-language data request.
2. `AIAssistant.tsx` sends the question to `POST /api/ai/query`.
3. `backend/ai_routes.py` calls `text_to_sql_and_run(...)`.
4. `backend/vanna_service.py` either rule-maps the question or uses Bedrock-assisted SQL generation.
5. SQL is executed over SQLite.
6. The backend returns:
   - tabular data
   - optional SQL
   - optional AI summary
   - optional chart option
   - optional trade-like rows
   - optional anomaly IDs
7. The frontend stores the result in Zustand.
8. The AI Data Table panel and AI Graph panel can render the returned result.
9. If the result is trade-shaped, analytics panels can use those rows as `displayTrades`.

### Data Flow: AI Chat Mode

When the user uses general chat mode, the flow is:

1. The user asks an analytical or explanatory question.
2. The assistant can prompt for short vs detailed explanation.
3. The frontend sends the request to `POST /api/ai/chat`.
4. Previous conversation history may be included.
5. The last AI query result may be included as a context snapshot.
6. The backend runs `rag_chat(...)`.
7. The backend may return:
   - a written answer
   - a chart option
   - additional data
   - SQL used for a supporting query
8. The frontend adds the assistant message and optionally opens table/chart views for the result.

This is why chat mode can act both like a conversational assistant and like an analytics launcher.

### How Anomaly Detection Works

Anomaly detection is intentionally separated from the LLM path.

The anomaly endpoint is pure statistics:

- no Bedrock calls
- no natural-language generation required to compute the anomaly outputs

The frontend flow is:

1. Trades load successfully from the API.
2. The app calls `fetchAnomalies()`.
3. The response is stored in Zustand via `setAnomalyState(...)`.
4. The grid uses anomaly IDs/details to highlight rows and show tooltips.
5. The Anomalies panel uses the returned arrays to show analysis views.

The README-visible anomaly types are:

- size anomalies
- frequency anomalies
- day percentile context

### Saved Views And Persistence

Saved views are handled in Zustand persistence.

Persisted items include:

- column state
- filter model
- sort model
- group state
- saved views
- date range

This means saved views survive page reloads because they are persisted in browser storage.

The app also stores layout-related behavior separately, but not every transient runtime state is persisted.

### Data Sources In The Final Branch

There are two trade data sources:

- SQLite-backed API data
- in-memory mock relational data

Why this matters:

- SQLite mode is the realistic app path and supports backend analytics plus AI SQL
- mock mode keeps the frontend usable when the backend is not running

Key files involved:

- `db/generate_sqlite.py`
- `db/schema.sql`
- `db/morning_blotter.db`
- `src/data/relationalMockData.ts`
- `src/contexts/DatabaseContext.tsx`

### Important Developer Mental Model

To work effectively in this codebase, it helps to think of the app as five connected subsystems:

1. Data loading
   - `App.tsx`, `api/client.ts`, `backend/db.py`, SQLite/mock

2. Shared state
   - `useBlotterStore.ts`

3. Panel workspace
   - `DockviewLayout.tsx`, `PanelContent.tsx`

4. Analytics features
   - grid, insights, BCLASS charts, intraday chart, anomaly panel

5. AI workflow
   - `AIAssistant.tsx`, `AIDataTablePanel.tsx`, `AIGraphPanel.tsx`, `backend/ai_routes.py`, `backend/vanna_service.py`

When debugging, try to first identify which subsystem owns the behavior you are looking at.

### Common Developer Questions

#### Why do some panels change when AI returns results?

Because `displayTrades` can be replaced by `aiQueryResult.trades`. Analytics panels use `displayTrades`, so AI-generated trade subsets can drive those panels.

#### Why does the app still work when the backend is down?

Because `App.tsx` falls back to `mockDatabase.getAllTradesJoined()` when `fetchTrades()` fails.

#### Why can AI follow up on previous results?

Because the last AI result is stored as `lastAiQueryResult` in Zustand and can be injected into the chat endpoint as a context snapshot.

#### Why are anomaly highlights available without the AI?

Because anomaly detection is computed independently through `GET /api/anomalies` and stored separately from the AI workflow.

#### Why do "today" and "yesterday" matter so much in AI behavior?

Because the data is sample/demo-style trading data. The backend AI service remaps relative dates to the latest trade date in the dataset so queries remain meaningful.

### Branch Notes For Developers

The `final` branch already contains the full dashboard stack described above, including:

- AI assistant workflows
- anomaly detection
- SQLite-backed backend
- saved views
- panel-based layout
- chart-based analytical panels

The earlier `Update/Testing` work should be understood as part of the evolution toward this more complete final state.

### Short Summary

If you need the quickest possible coder summary of the `final` branch:

- `App.tsx` is the top-level orchestrator
- Zustand is the shared runtime state layer
- Dockview is the panel workspace
- AG Grid powers the blotter and AI result tables
- ECharts powers analytics and AI charts
- FastAPI serves trades, anomalies, and AI endpoints
- SQLite is the structured analytics data source
- AWS Bedrock powers the AI reasoning and text-to-SQL behavior
- anomaly detection is statistical and separate from the LLM flow
- AI can return both explanations and data/visual artifacts that feed back into the dashboard

## License

Private - All rights reserved

## Contact And Ownership

Project Owners & Repository Stewards (NDA & Compliance):

- Kanishka Gupta - kanishk2@tepper.cmu.edu
- Viharika Mandappa Appaneravanda - vappaner@tepper.cmu.edu
- Stella Lu - stellalu@tepper.cmu.edu
- Yibin Li - yibinli@tepper.cmu.edu

Organization:

Carnegie Mellon University - MS in Business Analytics (MSBA) Capstone Project - Tepper School of Business

In association with Raymond James: Garrett Crawford - garrett.crawford@raymondjames.com 
