# Morning Blotter - Post-Trade Analytics Dashboard

React + TypeScript dashboard for post-trade analytics.  
It supports two data modes:
- **SQLite API mode** when backend is running (`/api/trades`)
- **Mock fallback mode** when backend is unavailable

## Current Features

### Trade Blotter
- AG Grid-based trade table
- Quick search, sorting, filtering, and column controls
- Double-click a row to drive intraday chart selection
- Excel export (grid data or AI table result)

### Analytics Panels
- **Daily Insights**: trade count and total notional
- **Asset Class Sunburst** and **Treemap** with BCLASS drill filter
- **Intraday Price** chart for selected trade
- **Yield Curve Scatter** panel
- **Anomalies** panel fed by backend statistical detectors

### AI Assistant
- **Data Query mode** (`/api/ai/query`): natural-language question -> SQL -> result table/chart
- **General Chat mode** (`/api/ai/chat`): follow-up Q&A with context from latest query
- AI chart output can render in dedicated chart panels

### Layout and Panel Behavior
- AI Assistant is always visible in the left slot
- Up to 4 panels can be active at once
- Opening chart panels uses an overlay mode on the right area
- Panel visibility is controlled from the **Panels** menu
- Saved views (filters/columns/sort/date range) are stored in Zustand persistence

## Tech Stack

- React 19 + TypeScript + Vite
- AG Grid
- ECharts (`echarts-for-react`)
- Zustand
- FastAPI + SQLite
- AWS Bedrock (optional, for AI)
- NumPy/SciPy (backend anomaly computation)

## Run Locally

### Prerequisites
- Node.js 18+
- Python 3.9+

### 1) Frontend
```bash
npm install
npm run dev
```
Default URL: `http://localhost:5173`

### 2) Optional backend (SQLite + AI + anomalies)
From project root:

```bash
python3 -c "from db.generate_sqlite import generate_database; generate_database(2500, 10)"
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend will call backend at `http://localhost:8000` by default (or `VITE_API_BASE_URL` if set).

### 3) Optional Bedrock credentials for AI endpoints
```bash
cp backend/bedrock_credentials.env.example backend/bedrock_credentials.env
```
Then fill:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `BEDROCK_MODEL_ID`

Do not commit credentials.

## Backend Endpoints

- `GET /api/health`
- `GET /api/trades`
- `GET /api/anomalies`
- `POST /api/ai/query`
- `POST /api/ai/chat`
- `POST /api/ai/train`
- `GET /api/ai/supported`

## Project Structure

```text
src/
  components/              # UI panels and dashboard layout
  api/client.ts            # Frontend API client
  store/useBlotterStore.ts # Global state (filters, panels, AI, anomalies)
  data/                    # Mock relational dataset + chart generators
backend/
  main.py                  # FastAPI app
  ai_routes.py             # AI query/chat endpoints
  anomaly_routes.py        # Anomaly endpoint
  db.py                    # SQLite read helpers
db/
  generate_sqlite.py       # SQLite generator
  schema.sql               # Generated schema/views
```

## License

Private - All rights reserved
