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
        ctx_copy = {
            k: v
            for k, v in context.items()
            if k not in ("preferTradeBlotter", "previousQueryResult")
        }
        if ctx_copy.get("conversationHistory"):
            hist = ctx_copy.pop("conversationHistory", [])
            if hist:
                prompt = "Recent conversation:\n" + "\n".join(
                    f"{h.get('role', 'user')}: {h.get('content', '')}" for h in hist[-4:]
                ) + "\n\nCurrent question: " + question
        if ctx_copy:
            prompt += "\n\nCurrent dashboard context (optional): " + json.dumps(ctx_copy, default=str)
    prefer_trade_blotter = context.get("preferTradeBlotter", False) if context else False
    if prefer_trade_blotter:
        target_rule = """IMPORTANT: The user is viewing the Trade Blotter. Return trade-level rows from v_trades_full so results appear in the blotter grid. Use SELECT * FROM v_trades_full (with WHERE/ORDER BY/LIMIT as needed) or queries that return full trade rows. Avoid aggregates-only; the user wants to see individual trades."""
    else:
        target_rule = """The user is viewing the AI Data Table. Aggregates, summaries, and custom columns are fine. For summary questions (totals, averages, counts by dimension) return the aggregate query."""
    system = f"""You are a SQL expert for a fixed income trading database (SQLite).
Schema (snake_case):
{DDL[:3000]}

Rule: Two output types. (1) Trade Blotter: For 'top N by price' or 'top 10 order by price' or 'give me top 10 trader order by price', use the simple query: SELECT * FROM v_trades_full ORDER BY clean_price DESC LIMIT N. Do not use a subquery. For trades from top N traders by amount/count (not price), use the subquery pattern. (2) AI Data Table: for summary-only questions (average price by trader, total by product) return the aggregate query; that result is shown in the AI Data Table panel.

{target_rule}

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


BROAD_QUERY_REFUSAL = (
    "I'm sorry, this request is too broad to provide a precise analysis. "
    "Could you please specify a ticker, a date range, or a specific counterparty?"
)
NO_RESULTS_MESSAGE = (
    "I cannot fulfill this request as the current database does not contain "
    "information matching your criteria."
)


def _user_asked_for_graph(question: str) -> bool:
    """True if user explicitly requested a chart, graph, or visualization."""
    q = question.lower()
    return any(
        x in q
        for x in [
            "chart",
            "graph",
            "plot",
            "visualize",
            "visualization",
            "show me a graph",
            "draw a chart",
        ]
    )


def _is_query_too_vague(question: str) -> bool:
    """Refuse overly broad queries that cannot be executed precisely."""
    q = question.lower().strip()
    vague_patterns = [
        "analyze all trades",
        "tell me about stocks",
        "analyze everything",
        "show me all data",
        "everything about",
        "all the trades",
        "all trades",
    ]
    return any(p in q for p in vague_patterns)


def _claude_second_pass(
    question: str,
    rows: list[dict],
    columns: list[str],
    *,
    user_asked_for_graph: bool = False,
) -> dict[str, Any]:
    """
    Second pass: Claude analyzes query results for summary, anomalies, and optional ECharts.
    Returns {summary, anomaly_trade_ids, echarts_option}.
    echarts_option is only set when user_asked_for_graph is True.
    """
    data_json = json.dumps(rows[:100], default=str)[:8000]
    system = """You are a fixed income trading analyst. Analyze the query result JSON and respond in this exact JSON format:
{
  "summary": "2-3 sentence natural language summary of the data, highlighting key insights.",
  "anomaly_trade_ids": ["TRD-xxx", "TRD-yyy"],
  "echarts_option": null
}

Rules:
- anomaly_trade_ids: List TradeIDs (internal_trade_id or internalTradeId) of rows that are outliers by price or volume. Only include clear anomalies. Use empty array [] if none.
- echarts_option: ONLY set if the user explicitly asked for a chart/graph in their question. Otherwise always null.
- For echarts_option: professional dark theme for trading terminal. Include:
  * grid: { top: 40, right: 30, bottom: 50, left: 60, containLabel: true }
  * tooltip: { backgroundColor: "#2d2d2d", borderColor: "#3d3d3d", textStyle: { color: "#e0e0e0", fontSize: 12 } }
  * title: { textStyle: { color: "#e0e0e0", fontSize: 14 } }, left: "center"
  * axisLine: { lineStyle: { color: "#3d3d3d" } }, axisTick: { show: false }, axisLabel: { color: "#a0a0a0", fontSize: 11 }
  * splitLine: { lineStyle: { color: "#2d2d2d", type: "dashed" } } for yAxis
  * For pie: itemStyle: { borderRadius: 4, borderColor: "#1e1e1e", borderWidth: 2 }; use palette: ["#2E75B6","#5B9BD5","#8FAADC","#BDD7EE","#4472C4","#9DC3E6","#7C8A96","#A6A6A6","#6B8CAE","#BFBFBF"]
  * For bar/line/area: itemStyle/lineStyle color from same palette or single "#5B9BD5"; smooth: true for line; areaStyle: {} for area
  * For scatter: symbolSize: 8, emphasis: { scale: 2 }"""
    chart_type_hint = _extract_chart_type_preference(question)
    chart_instruction = f" User wants {chart_type_hint} chart." if chart_type_hint else ""
    prompt = f"""User question: {question}{chart_instruction}

Query result (JSON):
{data_json}

Columns: {columns}

Respond with ONLY valid JSON (no markdown, no explanation)."""
    text, err = _bedrock_chat([{"role": "user", "content": prompt}], system=system)
    if err or not text:
        return {"summary": "", "anomaly_trade_ids": [], "echarts_option": None}
    try:
        text_clean = text.strip()
        if text_clean.startswith("```"):
            text_clean = re.sub(r"^```\w*\n?", "", text_clean)
            text_clean = re.sub(r"\n?```\s*$", "", text_clean)
        out = json.loads(text_clean)
        echarts = out.get("echarts_option") if user_asked_for_graph else None
        return {
            "summary": str(out.get("summary", ""))[:500],
            "anomaly_trade_ids": list(out.get("anomaly_trade_ids", []))[:20],
            "echarts_option": echarts,
        }
    except json.JSONDecodeError:
        return {"summary": "", "anomaly_trade_ids": [], "echarts_option": None}


def suggest_chart_type(question: str, columns: list[str], row_count: int) -> str | None:
    if row_count <= 0 or row_count > 500:
        return None
    user_type = _extract_chart_type_preference(question)
    if user_type:
        return user_type
    q = question.lower()
    if any(x in q for x in ["chart", "graph", "plot", "by product", "by counterparty", "by trader", "by date", "daily", "trend"]):
        if row_count <= 20 and any(c.lower() in ["product", "counterparty_name", "trader_name", "side"] for c in columns):
            return "bar"
        if any(c.lower() in ["trade_date", "date"] for c in columns) and row_count <= 100:
            return "line"
    return None


def text_to_sql_and_run(question: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Mode 1: Generate SQL, execute, return data + optional ECharts option. Two-pass AI for summary and anomalies."""
    previous = (context or {}).get("previousQueryResult") or {}
    prev_data = previous.get("data") if isinstance(previous, dict) else []
    if (
        _user_wants_graph_from_chat(question)
        and prev_data
        and isinstance(prev_data, list)
        and len(prev_data) > 0
    ):
        columns = list(prev_data[0].keys()) if prev_data else []
        chart_type = _extract_chart_type_preference(question)
        chart_option = _generate_chart_from_data(
            prev_data, columns, chart_type_hint=chart_type
        )
        prev_sql = previous.get("sql", "")
        return {
            "data": prev_data,
            "sql": prev_sql,
            "chartOption": chart_option,
            "aiSummary": "I've created a graph from the previous query results.",
            "anomalyTradeIds": [],
            "error": None,
        }

    if _is_query_too_vague(question):
        return {
            "data": [],
            "sql": None,
            "chartOption": None,
            "aiSummary": BROAD_QUERY_REFUSAL,
            "anomalyTradeIds": [],
            "error": BROAD_QUERY_REFUSAL,
        }

    sql, err = generate_sql(question, context)
    if err or not sql:
        return {
            "data": [],
            "sql": sql or "",
            "chartOption": None,
            "aiSummary": None,
            "anomalyTradeIds": [],
            "error": err or "No SQL generated.",
        }

    rows, run_err = run_sql(sql)
    if run_err:
        return {
            "data": [],
            "sql": sql,
            "chartOption": None,
            "aiSummary": None,
            "anomalyTradeIds": [],
            "error": run_err,
        }

    if not rows:
        return {
            "data": [],
            "sql": sql,
            "chartOption": None,
            "aiSummary": NO_RESULTS_MESSAGE,
            "anomalyTradeIds": [],
            "error": NO_RESULTS_MESSAGE,
        }

    columns = list(rows[0].keys())
    user_asked_for_graph = _user_asked_for_graph(question)
    second = _claude_second_pass(question, rows, columns, user_asked_for_graph=user_asked_for_graph)

    chart_option = second.get("echarts_option") if user_asked_for_graph else None
    if not chart_option and user_asked_for_graph:
        chart_type = suggest_chart_type(question, columns, len(rows))
        if chart_type and rows:
            cat_col = next((c for c in columns if c in ["product", "counterparty_name", "trader_name", "side", "trade_date"] and rows[0].get(c) is not None), columns[0] if columns else None)
            num_col = next((c for c in columns if c not in [cat_col] and isinstance(rows[0].get(c), (int, float))), None)
            date_col = next((c for c in columns if "date" in c.lower()), None)
            _palette = ["#2E75B6", "#5B9BD5", "#8FAADC", "#BDD7EE", "#4472C4", "#9DC3E6", "#7C8A96", "#A6A6A6", "#6B8CAE", "#BFBFBF"]
            _grid = {"top": 40, "right": 30, "bottom": 50, "left": 60, "containLabel": True}
            _tooltip = {"backgroundColor": "#2d2d2d", "borderColor": "#3d3d3d", "textStyle": {"color": "#e0e0e0", "fontSize": 12}}
            _axis_style = {"axisLine": {"lineStyle": {"color": "#3d3d3d"}}, "axisTick": {"show": False}, "axisLabel": {"color": "#a0a0a0", "fontSize": 11}}
            _title = {"text": question[:60], "left": "center", "textStyle": {"color": "#e0e0e0", "fontSize": 14}}
            if chart_type == "bar" and cat_col is not None and num_col is not None:
                chart_option = {
                    "backgroundColor": "transparent",
                    "title": _title,
                    "grid": _grid,
                    "tooltip": _tooltip,
                    "xAxis": {"type": "category", "data": [str(r.get(cat_col, "")) for r in rows[:20]], **_axis_style},
                    "yAxis": {"type": "value", "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}, **_axis_style},
                    "series": [{"type": "bar", "data": [r.get(num_col) for r in rows[:20]], "itemStyle": {"color": "#5B9BD5"}, "emphasis": {"itemStyle": {"borderColor": "#fff", "borderWidth": 1}}}],
                }
            elif chart_type == "line" and date_col and num_col:
                chart_option = {
                    "backgroundColor": "transparent",
                    "title": _title,
                    "grid": _grid,
                    "tooltip": _tooltip,
                    "xAxis": {"type": "category", "data": [str(r.get(date_col, "")) for r in rows[:31]], **_axis_style},
                    "yAxis": {"type": "value", "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}, **_axis_style},
                    "series": [{"type": "line", "data": [r.get(num_col) for r in rows[:31]], "smooth": True, "symbol": "circle", "symbolSize": 6, "lineStyle": {"width": 2, "color": "#5B9BD5"}, "itemStyle": {"color": "#5B9BD5"}, "emphasis": {"focus": "series", "itemStyle": {"borderColor": "#fff", "borderWidth": 2}}}],
                }
            elif chart_type in ("pie", "doughnut") and cat_col is not None and num_col is not None:
                series_cfg: dict = {
                    "type": "pie",
                    "data": [{"name": str(r.get(cat_col, "")), "value": r.get(num_col)} for r in rows[:15]],
                    "color": _palette,
                    "itemStyle": {"borderRadius": 4, "borderColor": "#1e1e1e", "borderWidth": 2},
                    "label": {"color": "#a0a0a0", "fontSize": 10},
                    "labelLine": {"lineStyle": {"color": "#3d3d3d"}},
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.5)"}},
                }
                if chart_type == "doughnut":
                    series_cfg["radius"] = ["45%", "75%"]
                chart_option = {
                    "backgroundColor": "transparent",
                    "title": _title,
                    "tooltip": _tooltip,
                    "series": [series_cfg],
                }
            elif chart_type == "area" and date_col and num_col:
                chart_option = {
                    "backgroundColor": "transparent",
                    "title": _title,
                    "grid": _grid,
                    "tooltip": _tooltip,
                    "xAxis": {"type": "category", "data": [str(r.get(date_col, "")) for r in rows[:31]], **_axis_style},
                    "yAxis": {"type": "value", "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}, **_axis_style},
                    "series": [{"type": "line", "areaStyle": {"color": "rgba(91,155,213,0.35)"}, "data": [r.get(num_col) for r in rows[:31]], "smooth": True, "symbol": "circle", "symbolSize": 4, "lineStyle": {"width": 2, "color": "#5B9BD5"}, "itemStyle": {"color": "#5B9BD5"}, "emphasis": {"focus": "series"}}],
                }
            elif chart_type == "scatter" and num_col and len(columns) >= 2:
                xcol = columns[0] if columns[0] != num_col else (columns[1] if len(columns) > 1 else None)
                if xcol and isinstance(rows[0].get(xcol), (int, float)):
                    chart_option = {
                        "backgroundColor": "transparent",
                        "title": _title,
                        "grid": _grid,
                        "tooltip": _tooltip,
                        "xAxis": {"type": "value", "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}, **_axis_style},
                        "yAxis": {"type": "value", "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}, **_axis_style},
                        "series": [{"type": "scatter", "data": [[r.get(xcol), r.get(num_col)] for r in rows[:100]], "symbolSize": 8, "itemStyle": {"color": "#5B9BD5"}, "emphasis": {"scale": 2, "itemStyle": {"borderColor": "#fff", "borderWidth": 1}}}],
                    }

    summary = second.get("summary", "")
    if not chart_option and summary:
        summary = summary.rstrip() + "\n\nWould you like me to create a graph from this data?"
    elif not chart_option:
        summary = "Would you like me to create a graph from this data?"

    return {
        "data": rows,
        "sql": sql,
        "chartOption": chart_option,
        "aiSummary": summary,
        "anomalyTradeIds": [str(x) for x in second.get("anomaly_trade_ids", [])],
        "error": None,
    }


def _generate_chart_from_data(
    rows: list[dict],
    columns: list[str],
    *,
    chart_type_hint: str | None = None,
) -> dict | None:
    """Ask Claude to generate an ECharts option from the given data. Returns echarts_option or None.
    chart_type_hint: pie, bar, line, area, scatter, doughnut - use this type if the user requested it."""
    data_json = json.dumps(rows[:100], default=str)[:8000]
    type_instruction = ""
    if chart_type_hint:
        type_instruction = f'IMPORTANT: The user specifically wants a "{chart_type_hint}" chart. Use series type "{chart_type_hint}" (for pie/doughnut use type "pie" with radius). '
    system = f"""You are an ECharts 6 specialist for a professional fixed income trading terminal. Given JSON data, produce a polished ECharts option object.
Respond with ONLY valid JSON in this format: {{ "echarts_option": {{ ... }} }}
{type_instruction}Use "bar" for categorical, "line" for time series, "pie" for proportions, "scatter" for correlations.
REQUIRED styling (trading-terminal dark theme):
- backgroundColor: "transparent"
- grid: {{ top: 40, right: 30, bottom: 50, left: 60, containLabel: true }}
- tooltip: {{ backgroundColor: "#2d2d2d", borderColor: "#3d3d3d", textStyle: {{ color: "#e0e0e0", fontSize: 12 }} }}
- title: {{ left: "center", textStyle: {{ color: "#e0e0e0", fontSize: 14 }} }}
- xAxis/yAxis: axisLine: {{ lineStyle: {{ color: "#3d3d3d" }} }}, axisTick: {{ show: false }}, axisLabel: {{ color: "#a0a0a0", fontSize: 11 }}, splitLine for yAxis: {{ lineStyle: {{ color: "#2d2d2d", type: "dashed" }} }}
- Pie: itemStyle: {{ borderRadius: 4, borderColor: "#1e1e1e", borderWidth: 2 }}, color: ["#2E75B6","#5B9BD5","#8FAADC","#BDD7EE","#4472C4","#9DC3E6","#7C8A96","#A6A6A6","#6B8CAE","#BFBFBF"]
- Bar/Line: itemStyle/lineStyle color "#5B9BD5" or use palette; smooth: true for line
- Scatter: symbolSize: 8, emphasis: {{ scale: 2 }}
- For pie/doughnut use series type "pie" with data: [{{"name": "...", "value": ...}}]. No extra text."""
    prompt = f"Data:\n{data_json}\n\nColumns: {columns}\n\nGenerate ECharts option JSON."
    if chart_type_hint:
        prompt += f"\n\nUser requested: {chart_type_hint} chart."
    text, err = _bedrock_chat([{"role": "user", "content": prompt}], system=system)
    if err or not text:
        return None
    try:
        text_clean = text.strip()
        if text_clean.startswith("```"):
            text_clean = re.sub(r"^```\w*\n?", "", text_clean)
            text_clean = re.sub(r"\n?```\s*$", "", text_clean)
        out = json.loads(text_clean)
        return out.get("echarts_option")
    except json.JSONDecodeError:
        return None


def _extract_chart_type_preference(message: str) -> str | None:
    """Extract user's chart type preference from message. Returns pie, bar, line, area, scatter, doughnut, or None."""
    m = message.lower()
    if "pie chart" in m or "piechart" in m or " pie " in m:
        return "pie"
    if "bar chart" in m or "barchart" in m or " bar " in m and "chart" in m:
        return "bar"
    if "line chart" in m or "linechart" in m or " line " in m and "chart" in m:
        return "line"
    if "area chart" in m or "areachart" in m:
        return "area"
    if "scatter" in m:
        return "scatter"
    if "doughnut" in m or "donut" in m:
        return "doughnut"
    if "not a bar" in m or "not bar" in m:
        if "pie" in m:
            return "pie"
        if "line" in m:
            return "line"
        return "pie"
    if "not a pie" in m or "not pie" in m:
        if "bar" in m:
            return "bar"
        return "bar"
    if "not a line" in m or "not line" in m:
        if "pie" in m:
            return "pie"
        if "bar" in m:
            return "bar"
        return "bar"
    return None


def _user_wants_graph_from_chat(message: str) -> bool:
    """True if user says yes to graph offer or explicitly asks for a graph."""
    m = message.lower().strip()
    if m in ("yes", "yeah", "yep", "please", "sure", "ok", "okay"):
        return True
    return any(
        x in m
        for x in [
            "graph",
            "chart",
            "plot",
            "visualize",
            "show me a graph",
            "create a graph",
            "draw a chart",
        ]
    )


def rag_chat(
    question: str,
    history: list[dict[str, str]] | None = None,
    context_snapshot: dict | None = None,
) -> tuple[str, dict | None, list | None, str | None]:
    """Mode 2: RAG chat via Bedrock.
    If context_snapshot is provided (from last Data Query), prepend it so the LLM can analyze that data.
    Returns (answer, chart_option). chart_option is set when user says 'yes' to graph or asks for one."""
    system = "You are a fixed income trading analyst. Answer based on the database schema: tables trades, securities, counterparties, traders, desks; views v_trades_full, v_daily_summary, v_counterparty_activity, v_trader_performance. Be concise."
    user_content = question
    if context_snapshot and context_snapshot.get("data"):
        data = context_snapshot.get("data", [])
        sql = context_snapshot.get("sql")
        json_str = json.dumps(data, default=str)[:12000]  # Cap size to avoid token limits
        prefix = (
            "System Context: The user is looking at the following data from a previous query.\n"
            "You previously offered: 'Would you like me to create a graph from this data?'\n"
            f"[JSON_DATA]\n{json_str}\n[/JSON_DATA]\n"
        )
        if sql:
            prefix += f"SQL that produced this data:\n```sql\n{sql}\n```\n\n"
        prefix += "Analyze this data to answer the user's question.\n\nUser question: "
        user_content = prefix + question
    messages = []
    if history:
        for h in history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_content})
    text, err = _bedrock_chat(messages, system=system)
    answer = text if text else (err or "Bedrock is not responding. Check backend/bedrock_credentials.env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID).")

    chart_option = None
    extra_data = None
    extra_sql = None
    if _user_wants_graph_from_chat(question):
        if context_snapshot and context_snapshot.get("data"):
            data = context_snapshot.get("data", [])
            columns = list(data[0].keys()) if data else []
            chart_type = _extract_chart_type_preference(question)
            chart_option = _generate_chart_from_data(
                data, columns, chart_type_hint=chart_type
            )
            if chart_option and not any(
                c in answer.lower() for c in ["here is the graph", "i've created", "here's the chart"]
            ):
                answer = answer.rstrip() + "\n\nI've created a graph from the data. It should appear in the AI Graph panel."
        elif not context_snapshot or not context_snapshot.get("data"):
            result = text_to_sql_and_run(question, None)
            if not result.get("error") and result.get("data"):
                chart_option = result.get("chartOption")
                extra_data = result.get("data", [])
                extra_sql = result.get("sql")
                answer = (result.get("aiSummary") or "").rstrip()
                if not answer:
                    answer = f"Here are the results. Returned {len(extra_data)} row(s)."
                if chart_option:
                    answer += "\n\nI've created a graph. It should appear in the AI Graph panel."
                if extra_sql:
                    answer += f"\n\n```sql\n{extra_sql}\n```"
    return (answer, chart_option, extra_data, extra_sql)
