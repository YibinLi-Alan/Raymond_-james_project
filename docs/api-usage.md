# API And Usage Notes

This document summarizes the backend API endpoints and how the frontend uses them.

## Base Runtime

Default local backend URL:

- `http://localhost:8000`

The frontend can override the backend URL using:

- `VITE_API_BASE_URL`

## Health Endpoint

### `GET /api/health`

Purpose:

- quick connectivity check
- confirms that the backend is running

Typical response:

```json
{
  "status": "ok",
  "source": "sqlite"
}
```

## Trade Data Endpoint

### `GET /api/trades`

Purpose:

- returns the full joined trade dataset in frontend-compatible shape

Frontend usage:

- called on application startup from `src/App.tsx`
- if it fails, the app falls back to mock data

## Anomaly Endpoint

### `GET /api/anomalies`

Purpose:

- returns statistical anomaly results derived from the current trade population

Includes:

- `sizeAnomalies`
- `frequencyAnomalies`
- `dayPercentile`
- `computedAt`
- `counts`

Frontend usage:

- fetched after trades load successfully from the backend
- failure is non-fatal; the app can continue without anomaly enrichment

## AI Endpoints

### `POST /api/ai/train`

Purpose:

- trains or initializes the Vanna/AI layer on schema, documentation, and example question-SQL pairs

Use case:

- backend setup or refresh of AI metadata

### `GET /api/ai/supported`

Purpose:

- returns the officially supported AI query intents for the current dataset

Use case:

- developer inspection
- future UI-driven help or prompt suggestion features

### `POST /api/ai/query`

Purpose:

- natural-language data query path

Expected request shape:

```json
{
  "question": "What were the most traded securities today?",
  "context": {}
}
```

Possible response fields:

- `data`
- `trades`
- `sql`
- `chartOption`
- `aiSummary`
- `anomalyTradeIds`
- `error`

Frontend usage:

- driven by AI Data Query mode in `src/components/AIAssistant.tsx`
- successful results feed the AI Data Table panel and optionally chart views

### `POST /api/ai/chat`

Purpose:

- conversational AI analysis path

Expected request shape:

```json
{
  "message": "Explain today's trading activity",
  "history": [],
  "context_snapshot": null,
  "response_style": "detailed"
}
```

Possible response fields:

- `answer`
- `chartOption`
- `data`
- `sql`

Frontend usage:

- driven by General Chat mode in `AIAssistant.tsx`
- may reuse prior AI query output as context for follow-up questions

## Run Instructions

## Frontend

```bash
npm install
npm run dev
```

## Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Optional Database Generation

```bash
python3 -c "from db.generate_sqlite import generate_database; generate_database(2500, 10)"
```

## Optional AI Configuration

Create:

- `backend/bedrock_credentials.env`

Based on:

- `backend/bedrock_credentials.env.example`

Do not commit live credentials.

## Practical Usage Notes

- If the backend is not running, the frontend still works using mock data.
- AI features require valid Bedrock configuration.
- Anomaly detection is statistical and does not require the LLM.
- The AI layer works best against the SQLite-backed schema and views.
