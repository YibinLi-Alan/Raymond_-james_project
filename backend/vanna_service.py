"""
Text-to-SQL and RAG chat using AWS Bedrock only.
Credentials from backend/bedrock_credentials.env via vanna_config.
"""

from __future__ import annotations

import json
import sqlite3
import re
from typing import Any

from backend import vanna_config
from backend.vanna_training_data import DDL, DOCS, QUESTION_SQL_PAIRS


def _bedrock_chat(messages: list[dict], system: str | None = None) -> tuple[str | None, str | None]:
    """Call AWS Bedrock Converse API. Returns (response_text, error_message). On success error is None."""
    if not vanna_config.is_llm_configured():
        return None, "Credentials missing. Create backend/bedrock_credentials.env (or .env in project root) with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID."
    try:
        import boto3
        kwargs = {"region_name": vanna_config.AWS_REGION}
        if vanna_config.AWS_ACCESS_KEY_ID and vanna_config.AWS_SECRET_ACCESS_KEY:
            kwargs["aws_access_key_id"] = vanna_config.AWS_ACCESS_KEY_ID
            kwargs["aws_secret_access_key"] = vanna_config.AWS_SECRET_ACCESS_KEY
        client = boto3.client("bedrock-runtime", **kwargs)
        api_messages = [
            {"role": msg["role"], "content": [{"text": msg["content"]}]}
            for msg in messages
        ]
        request = {
            "modelId": vanna_config.BEDROCK_MODEL_ID,
            "messages": api_messages,
            "inferenceConfig": {"temperature": 0, "maxTokens": 2048},
        }
        if system:
            request["system"] = [{"text": system}]
        response = client.converse(**request)
        parts = response.get("output", {}).get("message", {}).get("content", [])
        text = "".join(p.get("text", "") for p in parts)
        return (text.strip() or None), None
    except Exception as e:
        return None, str(e)


def _generate_sql_bedrock_with_error(question: str, context: dict[str, Any] | None) -> tuple[str | None, str | None]:
    """Generate SQL using AWS Bedrock. Returns (sql, error_message)."""
    prompt = question
    if context:
        prompt += "\n\nCurrent dashboard context (optional): " + json.dumps(context, default=str)
    system = f"""You are a SQL expert for a fixed income trading database (SQLite).
Schema (snake_case):
{DDL[:3000]}

Rule: Two output types. (1) Trade Blotter: For 'top N by price' or 'top 10 order by price' or 'give me top 10 trader order by price', use the simple query: SELECT * FROM v_trades_full ORDER BY clean_price DESC LIMIT N. Do not use a subquery. For trades from top N traders by amount/count (not price), use the subquery pattern. (2) AI Data Table: for summary-only questions (average price by trader, total by product) return the aggregate query; that result is shown in the AI Data Table panel.

Example questions and SQL:
{chr(10).join(f"Q: {q} -> {s}" for q, s in QUESTION_SQL_PAIRS)}

Generate only a single SQL SELECT statement, no explanation. Use tables: trades, securities, counterparties, traders, desks, or views v_trades_full, v_daily_summary, v_counterparty_activity, v_trader_performance. You may use ORDER BY, LIMIT, subqueries (IN (SELECT ...), FROM (SELECT ...) AS alias), CTEs (WITH cte AS (SELECT ...) SELECT ... FROM cte), and window functions (ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...), RANK() OVER (...), SUM(...) OVER (...)) as needed."""
    text, err = _bedrock_chat([{"role": "user", "content": prompt}], system=system)
    if err:
        return None, err
    if not text:
        return None, "Bedrock returned no text."
    match = re.search(r"(SELECT\s+.+?)(?:;|$)", text, re.IGNORECASE | re.DOTALL)
    sql = (match.group(1).strip() + ";" if match else text) or None
    return sql, None


def train_vanna() -> tuple[bool, str]:
    """Bedrock-only mode: no Vanna training needed."""
    return True, "Using Bedrock only; no training required."


def generate_sql(question: str, context: dict[str, Any] | None = None) -> tuple[str | None, str | None]:
    """Generate SQL from natural language via Bedrock."""
    sql, sql_err = _generate_sql_bedrock_with_error(question, context)
    if sql:
        return sql, None
    return None, sql_err or "Bedrock failed. Check backend/bedrock_credentials.env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID)."


def run_sql(sql: str) -> tuple[list[dict] | None, str | None]:
    """Execute SQL against SQLite. Ensures DB exists and is populated (same as /api/trades)."""
    if not sql or not sql.strip().upper().startswith("SELECT"):
        return None, "Only SELECT queries are allowed."
    try:
        from backend.db import ensure_db
        ensure_db()
        conn = sqlite3.connect(vanna_config.SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.execute(sql)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows, None
    except Exception as e:
        return None, str(e)


def suggest_chart_type(question: str, columns: list[str], row_count: int) -> str | None:
    if row_count <= 0 or row_count > 500:
        return None
    q = question.lower()
    if any(x in q for x in ["chart", "graph", "plot", "by product", "by counterparty", "by trader", "by date", "daily", "trend"]):
        if row_count <= 20 and any(c.lower() in ["product", "counterparty_name", "trader_name", "side"] for c in columns):
            return "bar"
        if any(c.lower() in ["trade_date", "date"] for c in columns) and row_count <= 100:
            return "line"
    return None


def text_to_sql_and_run(question: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Mode 1: Generate SQL, execute, return data + optional ECharts option."""
    sql, err = generate_sql(question, context)
    if err or not sql:
        return {"data": [], "sql": sql or "", "chartOption": None, "error": err or "No SQL generated."}

    rows, run_err = run_sql(sql)
    if run_err:
        return {"data": [], "sql": sql, "chartOption": None, "error": run_err}

    columns = list(rows[0].keys()) if rows else []
    chart_type = suggest_chart_type(question, columns, len(rows))
    chart_option = None
    if chart_type and rows:
        if chart_type == "bar":
            cat_col = next((c for c in columns if c in ["product", "counterparty_name", "trader_name", "side", "trade_date"] and rows[0].get(c) is not None), columns[0] if columns else None)
            num_col = next((c for c in columns if c not in [cat_col] and isinstance(rows[0].get(c), (int, float))), None)
            if cat_col is not None and num_col is not None:
                chart_option = {
                    "title": {"text": question[:50], "textStyle": {"color": "#e0e0e0"}},
                    "tooltip": {},
                    "xAxis": {"type": "category", "data": [str(r.get(cat_col, "")) for r in rows[:20]], "axisLabel": {"color": "#a0a0a0"}},
                    "yAxis": {"type": "value", "axisLabel": {"color": "#a0a0a0"}},
                    "series": [{"type": "bar", "data": [r.get(num_col) for r in rows[:20]], "itemStyle": {"color": "#4dabf7"}}],
                    "backgroundColor": "transparent",
                }
        elif chart_type == "line" and any("date" in c.lower() for c in columns):
            date_col = next((c for c in columns if "date" in c.lower()), columns[0])
            num_col = next((c for c in columns if c != date_col and isinstance(rows[0].get(c), (int, float))), None)
            if num_col:
                chart_option = {
                    "title": {"text": question[:50], "textStyle": {"color": "#e0e0e0"}},
                    "tooltip": {},
                    "xAxis": {"type": "category", "data": [str(r.get(date_col, "")) for r in rows[:31]], "axisLabel": {"color": "#a0a0a0"}},
                    "yAxis": {"type": "value", "axisLabel": {"color": "#a0a0a0"}},
                    "series": [{"type": "line", "data": [r.get(num_col) for r in rows[:31]], "smooth": True, "lineStyle": {"color": "#4dabf7"}}],
                    "backgroundColor": "transparent",
                }

    return {"data": rows, "sql": sql, "chartOption": chart_option, "error": None}


def rag_chat(question: str, history: list[dict[str, str]] | None = None) -> str:
    """Mode 2: RAG chat via Bedrock."""
    system = "You are a fixed income trading analyst. Answer based on the database schema: tables trades, securities, counterparties, traders, desks; views v_trades_full, v_daily_summary, v_counterparty_activity, v_trader_performance. Be concise."
    messages = []
    if history:
        for h in history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": question})
    text, err = _bedrock_chat(messages, system=system)
    if text:
        return text
    return err or "Bedrock is not responding. Check backend/bedrock_credentials.env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID)."
