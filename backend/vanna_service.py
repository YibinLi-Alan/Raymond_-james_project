"""
Text-to-SQL and RAG chat using AWS Bedrock only.
Credentials from backend/bedrock_credentials.env via vanna_config.
"""

from __future__ import annotations

import json
import sqlite3
import re
from functools import lru_cache
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


@lru_cache(maxsize=1)
def _latest_trade_date() -> str:
    from backend.db import ensure_db

    ensure_db()
    conn = sqlite3.connect(vanna_config.SQLITE_PATH)
    try:
        row = conn.execute("SELECT MAX(trade_date) FROM trades").fetchone()
        return str(row[0] or "date('now')")
    finally:
        conn.close()


def _date_aliases() -> dict[str, str]:
    latest = _latest_trade_date()
    return {
        "__TODAY__": latest,
        "__YESTERDAY__": f"date('{latest}', '-1 day')",
        "__LAST_7_DAYS__": f"date('{latest}', '-6 days')",
        "__LAST_30_DAYS__": f"date('{latest}', '-29 days')",
    }


def _apply_sample_date_aliases(sql: str) -> str:
    aliases = _date_aliases()
    for token, value in aliases.items():
        sql = sql.replace(token, value)
    sql = re.sub(r"date\('now'\)", f"date('{aliases['__TODAY__']}')", sql, flags=re.IGNORECASE)
    sql = re.sub(
        r"date\('now'\s*,\s*'-1 day'\)",
        aliases["__YESTERDAY__"],
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(
        r"date\('now'\s*,\s*'-7 days'\)",
        f"date('{aliases['__TODAY__']}', '-7 days')",
        sql,
        flags=re.IGNORECASE,
    )
    return sql


UNSUPPORTED_METRIC_MESSAGE = (
    "This dataset supports trading activity, volume, sector, trader activity, "
    "and simple anomaly analysis, but it does not currently include realized P&L, "
    "benchmark prices, VWAP, or slippage fields. I can still help with trade counts, "
    "notional, volume comparisons, outliers, and behavior changes."
)


SUPPORTED_QUERY_INTENTS: list[dict[str, Any]] = [
    {
        "id": "most_traded_securities",
        "category": "trading_activity",
        "description": "Most traded securities by trade count, volume, or notional.",
        "example_prompts": [
            "What were the most traded securities today?",
            "Which securities were traded the most today?",
        ],
        "keywords": ["most traded securit", "traded the most", "largest securities today"],
        "supports_chart": True,
    },
    {
        "id": "top_traders_by_activity",
        "category": "trading_activity",
        "description": "Traders with the most trades, notional, or trading amount.",
        "example_prompts": [
            "Which traders executed the most trades today?",
            "Show top traders by notional",
        ],
        "keywords": ["most trades trader", "executed the most trades", "top traders"],
        "supports_chart": True,
    },
    {
        "id": "sector_activity",
        "category": "trading_activity",
        "description": "Most active sectors or product-sector combinations.",
        "example_prompts": [
            "What sectors had the most trading activity today?",
            "Which sectors were most active?",
        ],
        "keywords": ["most activity sector", "sectors had the most trading activity"],
        "supports_chart": True,
    },
    {
        "id": "counterparty_activity",
        "category": "trading_activity",
        "description": "Counterparties ranked by activity, volume, or notional.",
        "example_prompts": [
            "Which counterparty had the highest activity today?",
            "Show counterparty activity",
        ],
        "keywords": ["highest activity counterparty", "counterparty activity"],
        "supports_chart": True,
    },
    {
        "id": "largest_trades",
        "category": "trading_activity",
        "description": "Largest trades today or across the available sample.",
        "example_prompts": [
            "What were the largest trades today?",
            "Show the largest trade",
        ],
        "keywords": ["largest trades today", "largest trade"],
        "supports_chart": True,
    },
    {
        "id": "daily_vs_historical_comparison",
        "category": "trading_activity",
        "description": "Today's volume compared with yesterday or historical averages.",
        "example_prompts": [
            "How did today's trading volume compare to yesterday?",
            "Compare today's volume to the historical average",
        ],
        "keywords": ["compare to yesterday", "historical average", "trading volume compare"],
        "supports_chart": True,
    },
    {
        "id": "unusual_volume",
        "category": "anomaly_detection",
        "description": "Securities with unusual volume versus their own average.",
        "example_prompts": [
            "Which securities had unusual trading volume today?",
            "Show abnormal volume",
        ],
        "keywords": ["unusual trading volume", "abnormal volume"],
        "supports_chart": True,
    },
    {
        "id": "behavior_change",
        "category": "behavioral_patterns",
        "description": "Traders whose frequency or ticket size changed versus their baseline.",
        "example_prompts": [
            "Did any traders change their trading behavior today?",
            "Who increased their trading frequency today?",
        ],
        "keywords": ["trading behavior", "change their trading patterns", "increased their trading frequency"],
        "supports_chart": True,
    },
    {
        "id": "trade_outliers",
        "category": "anomaly_detection",
        "description": "Trades with large size or price deviation versus their peer baseline.",
        "example_prompts": [
            "Which trades were outliers today?",
            "What unusual patterns occurred today?",
        ],
        "keywords": ["which trades were outliers", "unusual trading activity", "unusual patterns", "outlier trade"],
        "supports_chart": True,
    },
    {
        "id": "unsupported_execution_or_pnl_metrics",
        "category": "unsupported",
        "description": "P&L, VWAP, slippage, benchmark-price, and win-rate queries are not supported by the current dataset.",
        "example_prompts": [
            "Which trades generated the biggest losses?",
            "Which trades had the worst execution prices?",
        ],
        "keywords": ["p&l", "profit", "loss", "win rate", "vwap", "slippage", "benchmark"],
        "supports_chart": False,
    },
]


def get_supported_query_intents() -> list[dict[str, Any]]:
    return SUPPORTED_QUERY_INTENTS


def _matches_keywords(question: str, keywords: list[str]) -> bool:
    q = re.sub(r"\s+", " ", question.lower()).strip()
    return any(keyword in q for keyword in keywords)


def _intent_supported(question: str) -> str | None:
    for intent in SUPPORTED_QUERY_INTENTS:
        if intent["category"] == "unsupported":
            continue
        if _matches_keywords(question, intent["keywords"]):
            return str(intent["id"])
    return None


def _unsupported_metric_message(question: str) -> str | None:
    q = question.lower()
    unsupported_patterns = [
        "p&l",
        "profit",
        "profitable",
        "loss",
        "losses",
        "win rate",
        "vwap",
        "slippage",
        "execution quality",
        "benchmark price",
        "benchmark",
        "execution price vs benchmark",
    ]
    if any(pattern in q for pattern in unsupported_patterns):
        return UNSUPPORTED_METRIC_MESSAGE
    return None


def _rule_based_sql(question: str, context: dict[str, Any] | None) -> str | None:
    q = re.sub(r"\s+", " ", question.lower()).strip()
    prefer_trade_blotter = bool((context or {}).get("preferTradeBlotter"))
    if not q:
        return None

    today = "__TODAY__"
    yesterday = "__YESTERDAY__"
    intent_id = _intent_supported(q)

    if intent_id == "most_traded_securities" or ("most traded securit" in q or "traded the most" in q and "securit" in q):
        metric = "COUNT(*) AS trade_count, SUM(t.notional_usd) AS total_notional_usd"
        order_by = "trade_count DESC, total_notional_usd DESC"
        if "shares" in q or "volume" in q:
            metric = "SUM(t.notional) AS total_volume, COUNT(*) AS trade_count, SUM(t.notional_usd) AS total_notional_usd"
            order_by = "total_volume DESC, trade_count DESC"
        return (
            "SELECT s.ticker, s.cusip, s.issuer_name, s.product, s.sector, "
            f"{metric} "
            "FROM trades t JOIN securities s ON t.cusip = s.cusip "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY s.ticker, s.cusip, s.issuer_name, s.product, s.sector "
            f"ORDER BY {order_by} LIMIT 20;"
        )

    if ("traded the most" in q or "most activity" in q) and ("sector" not in q and "trader" not in q and "securit" not in q):
        return (
            "SELECT s.product, s.sector, COUNT(*) AS trade_count, SUM(t.notional) AS total_volume, "
            "SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN securities s ON t.cusip = s.cusip "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY s.product, s.sector "
            "ORDER BY total_notional_usd DESC, trade_count DESC LIMIT 20;"
        )

    if intent_id == "top_traders_by_activity" or ("which traders executed the most trades" in q or ("most trades" in q and "trader" in q)):
        return (
            "SELECT tr.id AS trader_id, tr.name AS trader_name, d.name AS desk_name, "
            "COUNT(*) AS trade_count, SUM(t.notional) AS total_volume, SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN traders tr ON t.trader_id = tr.id "
            "JOIN desks d ON tr.desk_id = d.id "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY tr.id, tr.name, d.name "
            "ORDER BY trade_count DESC, total_notional_usd DESC LIMIT 20;"
        )

    if ("best performance" in q or "top performing trader" in q) and "today" in q:
        return (
            "SELECT tr.id AS trader_id, tr.name AS trader_name, d.name AS desk_name, "
            "COUNT(*) AS trade_count, SUM(t.notional_usd) AS total_notional_usd, "
            "AVG(t.notional_usd) AS avg_trade_notional "
            "FROM trades t JOIN traders tr ON t.trader_id = tr.id "
            "JOIN desks d ON tr.desk_id = d.id "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY tr.id, tr.name, d.name "
            "ORDER BY total_notional_usd DESC, trade_count DESC LIMIT 20;"
        )

    if intent_id == "sector_activity" or ("sectors had the most trading activity" in q or ("most activity" in q and "sector" in q)):
        return (
            "SELECT s.sector, COUNT(*) AS trade_count, SUM(t.notional) AS total_volume, "
            "SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN securities s ON t.cusip = s.cusip "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY s.sector ORDER BY total_notional_usd DESC, trade_count DESC LIMIT 20;"
        )

    if "which securities were traded the most today" in q or "largest securities today" in q:
        return (
            "SELECT s.ticker, s.cusip, s.issuer_name, s.product, s.sector, COUNT(*) AS trade_count, "
            "SUM(t.notional) AS total_volume, SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN securities s ON t.cusip = s.cusip "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY s.ticker, s.cusip, s.issuer_name, s.product, s.sector "
            "ORDER BY total_notional_usd DESC, trade_count DESC LIMIT 20;"
        )

    if (
        "compare to yesterday" in q
        or "compared to yesterday" in q
        or "historical average" in q
        or "today's trading volume compare" in q
    ):
        return (
            "WITH daily AS ("
            "SELECT trade_date, COUNT(*) AS trade_count, SUM(notional) AS total_volume, SUM(notional_usd) AS total_notional_usd "
            "FROM trades GROUP BY trade_date"
            "), avg_hist AS ("
            "SELECT AVG(trade_count) AS avg_trade_count, AVG(total_volume) AS avg_total_volume, "
            "AVG(total_notional_usd) AS avg_total_notional_usd FROM daily"
            ") "
            "SELECT "
            f"(SELECT trade_count FROM daily WHERE trade_date = date('{today}')) AS today_trade_count, "
            f"(SELECT total_volume FROM daily WHERE trade_date = date('{today}')) AS today_total_volume, "
            f"(SELECT total_notional_usd FROM daily WHERE trade_date = date('{today}')) AS today_total_notional_usd, "
            f"(SELECT trade_count FROM daily WHERE trade_date = {yesterday}) AS yesterday_trade_count, "
            f"(SELECT total_volume FROM daily WHERE trade_date = {yesterday}) AS yesterday_total_volume, "
            f"(SELECT total_notional_usd FROM daily WHERE trade_date = {yesterday}) AS yesterday_total_notional_usd, "
            "avg_trade_count, avg_total_volume, avg_total_notional_usd, "
            "ROUND(CAST((SELECT total_volume FROM daily WHERE trade_date = date('__TODAY__')) AS REAL) / NULLIF(avg_total_volume, 0), 2) "
            "AS volume_vs_average_ratio "
            "FROM avg_hist;"
        )

    if "historical average" in q and ("security" in q or "ticker" in q or "securit" in q):
        return (
            "WITH daily_security AS ("
            "SELECT t.trade_date, s.ticker, s.cusip, s.issuer_name, COUNT(*) AS trade_count, "
            "SUM(t.notional) AS total_volume, SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN securities s ON t.cusip = s.cusip "
            "GROUP BY t.trade_date, s.ticker, s.cusip, s.issuer_name"
            "), baselines AS ("
            "SELECT ticker, cusip, AVG(trade_count) AS avg_trade_count, AVG(total_volume) AS avg_volume, "
            "AVG(total_notional_usd) AS avg_notional FROM daily_security GROUP BY ticker, cusip"
            ") "
            "SELECT d.ticker, d.cusip, d.issuer_name, d.trade_count, d.total_volume, d.total_notional_usd, "
            "b.avg_trade_count, b.avg_volume, b.avg_notional, "
            "ROUND(d.total_volume / NULLIF(b.avg_volume, 0), 2) AS volume_vs_avg_ratio "
            "FROM daily_security d JOIN baselines b ON d.ticker = b.ticker AND d.cusip = b.cusip "
            f"WHERE d.trade_date = date('{today}') "
            "ORDER BY volume_vs_avg_ratio DESC, d.total_notional_usd DESC LIMIT 20;"
        )

    if intent_id == "unusual_volume" or ("unusual trading volume" in q or ("abnormal" in q and "volume" in q)):
        return (
            "WITH daily_security AS ("
            "SELECT t.trade_date, s.ticker, s.cusip, s.issuer_name, s.product, s.sector, "
            "COUNT(*) AS trade_count, SUM(t.notional) AS total_volume, SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN securities s ON t.cusip = s.cusip "
            "GROUP BY t.trade_date, s.ticker, s.cusip, s.issuer_name, s.product, s.sector"
            "), baselines AS ("
            "SELECT ticker, cusip, AVG(total_volume) AS avg_volume, "
            "AVG(total_notional_usd) AS avg_notional, AVG(trade_count) AS avg_trade_count "
            "FROM daily_security GROUP BY ticker, cusip"
            ") "
            "SELECT d.ticker, d.cusip, d.issuer_name, d.product, d.sector, d.trade_count, d.total_volume, "
            "d.total_notional_usd, b.avg_volume, b.avg_notional, b.avg_trade_count, "
            "ROUND(d.total_volume / NULLIF(b.avg_volume, 0), 2) AS volume_vs_avg_ratio "
            "FROM daily_security d JOIN baselines b ON d.ticker = b.ticker AND d.cusip = b.cusip "
            f"WHERE d.trade_date = date('{today}') "
            "ORDER BY volume_vs_avg_ratio DESC, d.total_notional_usd DESC LIMIT 20;"
        )

    if intent_id == "counterparty_activity" or ("highest activity" in q and "counterparty" in q):
        return (
            "SELECT cp.id AS counterparty_id, cp.name AS counterparty_name, COUNT(*) AS trade_count, "
            "SUM(t.notional) AS total_volume, SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN counterparties cp ON t.counterparty_id = cp.id "
            f"WHERE t.trade_date = date('{today}') "
            "GROUP BY cp.id, cp.name ORDER BY total_notional_usd DESC, trade_count DESC LIMIT 20;"
        )

    if intent_id == "largest_trades" and "today" in q or ("largest trades today" in q or ("largest trade" in q and "today" in q)):
        return (
            "SELECT * FROM v_trades_full "
            f"WHERE trade_date = date('{today}') "
            "ORDER BY notional_usd DESC, notional DESC LIMIT 25;"
            if prefer_trade_blotter
            else
            "SELECT ticker, cusip, issuer_name, product, sector, counterparty_name, trader_name, "
            "trade_date, execution_timestamp, notional, notional_usd, clean_price "
            "FROM v_trades_full "
            f"WHERE trade_date = date('{today}') "
            "ORDER BY notional_usd DESC, notional DESC LIMIT 25;"
        )

    if "largest trade" in q:
        return (
            "SELECT * FROM v_trades_full ORDER BY notional_usd DESC, notional DESC LIMIT 25;"
            if prefer_trade_blotter
            else
            "SELECT ticker, cusip, issuer_name, product, sector, counterparty_name, trader_name, "
            "trade_date, execution_timestamp, notional, notional_usd, clean_price "
            "FROM v_trades_full ORDER BY notional_usd DESC, notional DESC LIMIT 25;"
        )

    if "top traders" in q and ("amount" in q or "notional" in q or "volume" in q):
        return (
            "SELECT trader_id, trader_name, desk_name, trade_count, total_notional_usd, "
            "(buy_notional_usd + sell_notional_usd) AS gross_notional_usd "
            "FROM v_trader_performance ORDER BY total_notional_usd DESC LIMIT 20;"
        )

    if "highest win rate" in q:
        return None

    if intent_id == "behavior_change" or ("trading behavior" in q or "change their trading patterns" in q or "increased their trading frequency" in q):
        return (
            "WITH daily_trader AS ("
            "SELECT t.trade_date, tr.id AS trader_id, tr.name AS trader_name, d.name AS desk_name, "
            "COUNT(*) AS trade_count, AVG(t.notional_usd) AS avg_trade_notional, SUM(t.notional_usd) AS total_notional_usd "
            "FROM trades t JOIN traders tr ON t.trader_id = tr.id "
            "JOIN desks d ON tr.desk_id = d.id "
            "GROUP BY t.trade_date, tr.id, tr.name, d.name"
            "), trader_avg AS ("
            "SELECT trader_id, AVG(trade_count) AS avg_trade_count, AVG(avg_trade_notional) AS avg_ticket_size "
            "FROM daily_trader GROUP BY trader_id"
            ") "
            "SELECT d.trader_id, d.trader_name, d.desk_name, d.trade_count, d.avg_trade_notional, d.total_notional_usd, "
            "a.avg_trade_count, a.avg_ticket_size, "
            "ROUND(d.trade_count / NULLIF(a.avg_trade_count, 0), 2) AS trade_count_vs_avg_ratio, "
            "ROUND(d.avg_trade_notional / NULLIF(a.avg_ticket_size, 0), 2) AS ticket_size_vs_avg_ratio "
            "FROM daily_trader d JOIN trader_avg a ON d.trader_id = a.trader_id "
            f"WHERE d.trade_date = date('{today}') "
            "ORDER BY trade_count_vs_avg_ratio DESC, ticket_size_vs_avg_ratio DESC LIMIT 20;"
        )

    if intent_id == "trade_outliers" or ("unusual trading activity" in q or "outlier" in q or "abnormal trading patterns" in q or "unusual patterns" in q):
        return (
            "WITH enriched AS ("
            "SELECT v.*, "
            "AVG(v.notional_usd) OVER (PARTITION BY v.trader_name) AS trader_avg_notional, "
            "AVG(v.clean_price) OVER (PARTITION BY v.ticker) AS ticker_avg_price "
            "FROM v_trades_full v"
            ") "
            "SELECT internal_trade_id, trade_date, execution_timestamp, ticker, cusip, issuer_name, "
            "product, sector, trader_name, counterparty_name, side, notional, notional_usd, clean_price, "
            "ROUND(notional_usd / NULLIF(trader_avg_notional, 0), 2) AS trade_size_vs_trader_avg, "
            "ROUND(clean_price - ticker_avg_price, 4) AS price_deviation_from_ticker_avg "
            "FROM enriched "
            f"WHERE trade_date = date('{today}') "
            "ORDER BY trade_size_vs_trader_avg DESC, ABS(price_deviation_from_ticker_avg) DESC LIMIT 25;"
        )

    if "which trades were outliers" in q or ("outlier" in q and "trade" in q):
        return (
            "WITH enriched AS ("
            "SELECT v.*, AVG(v.notional_usd) OVER (PARTITION BY v.trader_name) AS trader_avg_notional, "
            "AVG(v.clean_price) OVER (PARTITION BY v.ticker) AS ticker_avg_price "
            "FROM v_trades_full v"
            ") "
            "SELECT * FROM enriched "
            f"WHERE trade_date = date('{today}') "
            "ORDER BY ABS(clean_price - ticker_avg_price) DESC, notional_usd / NULLIF(trader_avg_notional, 0) DESC LIMIT 25;"
            if prefer_trade_blotter
            else
            "WITH enriched AS ("
            "SELECT v.*, AVG(v.notional_usd) OVER (PARTITION BY v.trader_name) AS trader_avg_notional, "
            "AVG(v.clean_price) OVER (PARTITION BY v.ticker) AS ticker_avg_price "
            "FROM v_trades_full v"
            ") "
            "SELECT internal_trade_id, trade_date, execution_timestamp, ticker, cusip, issuer_name, product, "
            "sector, trader_name, counterparty_name, side, notional, notional_usd, clean_price, "
            "ROUND(notional_usd / NULLIF(trader_avg_notional, 0), 2) AS trade_size_vs_trader_avg, "
            "ROUND(clean_price - ticker_avg_price, 4) AS price_deviation_from_ticker_avg "
            "FROM enriched "
            f"WHERE trade_date = date('{today}') "
            "ORDER BY ABS(clean_price - ticker_avg_price) DESC, trade_size_vs_trader_avg DESC LIMIT 25;"
        )

    return None


def _generate_sql_bedrock_with_error(question: str, context: dict[str, Any] | None) -> tuple[str | None, str | None]:
    """Generate SQL using AWS Bedrock. Returns (sql, error_message)."""
    rule_based = _rule_based_sql(question, context)
    if rule_based:
        return _apply_sample_date_aliases(rule_based), None

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
    latest_trade_date = _latest_trade_date()
    system = f"""You are a SQL expert for a fixed income trading database (SQLite).
Schema (snake_case):
{DDL[:3000]}

Rule: Two output types. (1) Trade Blotter: For 'top N by price' or 'top 10 order by price' or 'give me top 10 trader order by price', use the simple query: SELECT * FROM v_trades_full ORDER BY clean_price DESC LIMIT N. Do not use a subquery. For trades from top N traders by amount/count (not price), use the subquery pattern. (2) AI Data Table: for summary-only questions (average price by trader, total by product) return the aggregate query; that result is shown in the AI Data Table panel.

Date handling rule: this sample dataset's latest available trade_date is {latest_trade_date}. Treat "today" as date('{latest_trade_date}'), "yesterday" as date('{latest_trade_date}', '-1 day'), "last 7 days" as trade_date >= date('{latest_trade_date}', '-6 days'), and "last 30 days" as trade_date >= date('{latest_trade_date}', '-29 days'). Do not rely on date('now') for this app.

Capability rule: the dataset supports trade counts, trade lists, notional, volume, sector activity, trader activity, simple behavior changes, and anomaly-style comparisons. It does NOT include realized P&L, win rate, VWAP, benchmark price, or slippage columns. If the question requires those unsupported metrics, do not invent SQL or columns.

{target_rule}

Example questions and SQL:
{chr(10).join(f"Q: {q} -> {s}" for q, s in QUESTION_SQL_PAIRS)}

Generate only a single SQL SELECT statement, no explanation. Use tables: trades, securities, counterparties, traders, desks, or views v_trades_full, v_daily_summary, v_counterparty_activity, v_trader_performance. You may use ORDER BY, LIMIT, subqueries (IN (SELECT ...), FROM (SELECT ...) AS alias), CTEs (WITH cte AS (SELECT ...) SELECT ... FROM cte), and window functions (ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...), RANK() OVER (...), SUM(...) OVER (...)) as needed."""
    text, err = _bedrock_chat([{"role": "user", "content": prompt}], system=system)
    if err:
        return None, err
    if not text:
        return None, "Bedrock returned no text."
    sql = _sanitize_generated_sql(text)
    return sql, None


def _sanitize_generated_sql(text: str | None) -> str | None:
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:sql)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = re.sub(r"--.*?$", "", cleaned, flags=re.MULTILINE)

    with_match = re.search(r"(WITH\s+.+?)(?:;|$)", cleaned, re.IGNORECASE | re.DOTALL)
    select_match = re.search(r"(SELECT\s+.+?)(?:;|$)", cleaned, re.IGNORECASE | re.DOTALL)
    sql = with_match.group(1).strip() if with_match else (select_match.group(1).strip() if select_match else cleaned)

    sql = re.sub(r",\s*\)", ")", sql)
    sql = re.sub(r"\(\s*\)", "(NULL)", sql)
    sql = re.sub(r"\bIN\s*\(\s*NULL\s*\)", "IN (SELECT NULL WHERE 1=0)", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bWHERE\s+AND\b", "WHERE", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bOR\s+\)", ")", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bAND\s+\)", ")", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\s+", " ", sql)
    sql = re.sub(r";+\s*$", "", sql).strip()
    sql = _apply_sample_date_aliases(sql)
    return f"{sql};" if sql else None


def _validate_sql(sql: str | None) -> str | None:
    if not sql:
        return "No SQL generated."
    stripped = sql.strip()
    upper = stripped.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return "Only SELECT queries are allowed."
    if stripped.count("(") != stripped.count(")"):
        return "Generated SQL has mismatched parentheses."
    if re.search(r",\s*(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|\))", stripped, re.IGNORECASE):
        return "Generated SQL has a trailing comma."
    if re.search(r"\bIN\s*\(\s*\)", stripped, re.IGNORECASE):
        return "Generated SQL has an empty IN clause."
    forbidden = re.search(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA)\b", upper)
    if forbidden:
        return "Only read-only SELECT queries are allowed."
    return None


def _repair_sql_after_error(
    question: str,
    bad_sql: str,
    error_message: str,
    context: dict[str, Any] | None = None,
) -> tuple[str | None, str | None]:
    latest_trade_date = _latest_trade_date()
    system = f"""You are fixing a SQLite SELECT query for a fixed income trading database.
The latest available trade_date in this sample data is {latest_trade_date}. Treat "today" as date('{latest_trade_date}').
Return only a corrected SQLite SELECT statement. No explanation. No markdown. No comments.
Only use tables: trades, securities, counterparties, traders, desks, or views v_trades_full, v_daily_summary, v_counterparty_activity, v_trader_performance."""
    prompt = (
        f"User question:\n{question}\n\n"
        f"Broken SQL:\n{bad_sql}\n\n"
        f"SQLite error:\n{error_message}\n\n"
        "Fix the SQL so it runs correctly in SQLite and answers the same question."
    )
    if context:
        prompt += "\n\nOptional dashboard context:\n" + json.dumps(
            {k: v for k, v in context.items() if k not in ("previousQueryResult", "conversationHistory")},
            default=str,
        )
    text, err = _bedrock_chat([{"role": "user", "content": prompt}], system=system)
    if err:
        return None, err
    return _sanitize_generated_sql(text), None


def train_vanna() -> tuple[bool, str]:
    """Bedrock-only mode: no Vanna training needed."""
    return True, "Using Bedrock only; no training required."


def generate_sql(question: str, context: dict[str, Any] | None = None) -> tuple[str | None, str | None]:
    """Generate SQL from natural language via Bedrock."""
    sql, sql_err = _generate_sql_bedrock_with_error(question, context)
    validation_err = _validate_sql(sql)
    if sql and not validation_err:
        return sql, None
    if validation_err and sql:
        repaired_sql, repair_err = _repair_sql_after_error(question, sql, validation_err, context)
        repaired_validation_err = _validate_sql(repaired_sql)
        if repaired_sql and not repair_err and not repaired_validation_err:
            return repaired_sql, None
        return None, repaired_validation_err or repair_err or validation_err
    return None, sql_err or "Bedrock failed. Check backend/bedrock_credentials.env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID)."


def run_sql(sql: str) -> tuple[list[dict] | None, str | None]:
    """Execute SQL against SQLite. Ensures DB exists and is populated (same as /api/trades)."""
    validation_err = _validate_sql(sql)
    if validation_err:
        return None, validation_err
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


def _format_metric_label(name: str) -> str:
    return name.replace("_", " ").title()


def _metric_formatter(metric_name: str | None) -> str:
    metric = (metric_name or "").lower()
    if "ratio" in metric or "pct" in metric or "percent" in metric or "share" in metric:
        return "{c}%"
    if "price" in metric or "yield" in metric or "deviation" in metric:
        return "{c}"
    if "notional" in metric or "volume" in metric or "amount" in metric or "gross" in metric:
        return "${c}"
    return "{c}"


def _pick_chart_columns(rows: list[dict], columns: list[str]) -> tuple[str | None, str | None]:
    if not rows or not columns:
        return None, None
    category_priority = [
        "ticker",
        "issuer_name",
        "product",
        "sector",
        "counterparty_name",
        "trader_name",
        "trader_id",
        "desk_name",
        "side",
        "trade_date",
        "date",
    ]
    metric_priority = [
        "volume_vs_avg_ratio",
        "trade_count_vs_avg_ratio",
        "ticket_size_vs_avg_ratio",
        "total_notional_usd",
        "gross_notional_usd",
        "total_volume",
        "trade_count",
        "avg_trade_notional",
        "avg_notional",
        "avg_volume",
        "avg_trade_count",
        "notional_usd",
        "notional",
        "clean_price",
        "yield",
        "price_deviation_from_ticker_avg",
        "trade_size_vs_trader_avg",
    ]
    category = next((c for c in category_priority if c in columns), None)
    if category is None:
        category = next((c for c in columns if not isinstance(rows[0].get(c), (int, float))), None)
    metric = next((c for c in metric_priority if c in columns and isinstance(rows[0].get(c), (int, float))), None)
    if metric is None:
        metric = next((c for c in columns if c != category and isinstance(rows[0].get(c), (int, float))), None)
    return category, metric


def _tooltip_js(metric_name: str | None, chart_type: str) -> str:
    label = _format_metric_label(metric_name or "value")
    is_pct = chart_type in ("pie", "doughnut")
    prefix = _metric_formatter(metric_name)
    return (
        "function(params){"
        "const point = Array.isArray(params) ? (params[0] || {}) : params;"
        "const rawValue = point && Object.prototype.hasOwnProperty.call(point, 'value')"
        " ? point.value"
        " : (point && point.data && Object.prototype.hasOwnProperty.call(point.data, 'value') ? point.data.value : undefined);"
        "const baseValue = Array.isArray(rawValue) ? rawValue[1] : rawValue;"
        "const val = baseValue != null ? baseValue : (typeof point.axisValue !== 'undefined' ? point.axisValue : undefined);"
        f"const metric = '{label}';"
        f"const prefix = '{prefix}';"
        "const formatted = (typeof val === 'number')"
        " ? (prefix === '${c}' ? ('$' + Number(val).toLocaleString(undefined,{maximumFractionDigits:2}))"
        " : (prefix === '{c}%' ? (Number(val).toFixed(2) + '%') : Number(val).toLocaleString(undefined,{maximumFractionDigits:4})))"
        " : String(val ?? '');"
        + ("return `${point.name}<br/>${metric}: ${formatted}<br/>Share: ${Number(point.percent || 0).toFixed(1)}%`;}" if is_pct
           else "return `${point.name || ''}<br/>${metric}: ${formatted}`;}")
    )


def _is_generic_graph_followup(question: str) -> bool:
    normalized = re.sub(r"\s+", " ", (question or "").strip().lower())
    return normalized in {
        "yes",
        "yeah",
        "yep",
        "please",
        "sure",
        "ok",
        "okay",
        "yes please",
        "sure please",
        "show graph",
        "show chart",
        "create graph",
        "create a graph",
        "make graph",
        "make a graph",
    }


def _derive_chart_title(question: str, category_col: str | None, metric_col: str) -> str:
    metric_label = _format_metric_label(metric_col)
    if category_col:
        category_label = _format_metric_label(category_col)
        if len(metric_label) <= 22 and len(category_label) <= 18:
            return f"{metric_label} by {category_label}"
        return f"{metric_label} View"
    return metric_label[:28]


def _build_chart_option(
    rows: list[dict],
    columns: list[str],
    question: str,
    chart_type: str | None,
) -> dict | None:
    if not rows or not columns:
        return None
    chart_type = chart_type or "bar"
    category_col, metric_col = _pick_chart_columns(rows, columns)
    if metric_col is None:
        return None

    palette = ["#0EA5E9", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#22C55E", "#F97316", "#6366F1", "#EAB308", "#EC4899"]
    grid = {"top": 78, "right": 32, "bottom": 86, "left": 76, "containLabel": True}
    tooltip = {
        "trigger": "item" if chart_type in ("pie", "doughnut") else "axis",
        "triggerOn": "mousemove|click",
        "backgroundColor": "#2d2d2d",
        "borderColor": "#3d3d3d",
        "textStyle": {"color": "#e0e0e0", "fontSize": 12},
        "confine": True,
        "axisPointer": {"type": "shadow" if chart_type == "bar" else "line"} if chart_type not in ("pie", "doughnut", "scatter") else None,
        "formatter": _tooltip_js(metric_col, chart_type),
    }
    title = {
        "text": _derive_chart_title(question, category_col, metric_col),
        "left": "center",
        "top": 10,
        "textStyle": {"color": "#f5f7fa", "fontSize": 12, "fontWeight": 700},
    }
    axis_style = {"axisLine": {"lineStyle": {"color": "#3d3d3d"}}, "axisTick": {"show": False}, "axisLabel": {"color": "#a0a0a0", "fontSize": 11}}

    trimmed = rows[:20 if chart_type not in ("line", "area", "scatter") else 40]
    categories = [str(r.get(category_col, f"Row {i+1}")) if category_col else f"Row {i+1}" for i, r in enumerate(trimmed)]
    values = [r.get(metric_col) for r in trimmed]
    numeric_values = [v for v in values if isinstance(v, (int, float))]
    max_value = max(numeric_values) if numeric_values else None

    if chart_type in ("pie", "doughnut"):
        series = {
            "type": "pie",
            "name": _format_metric_label(metric_col),
            "radius": ["42%", "72%"] if chart_type == "doughnut" else "68%",
            "center": ["50%", "52%"],
            "data": [{"name": categories[i], "value": values[i]} for i in range(len(categories))],
            "color": palette,
            "itemStyle": {"borderRadius": 8, "borderColor": "#1e1e1e", "borderWidth": 2},
            "label": {"show": False},
            "labelLine": {"lineStyle": {"color": "#3d3d3d"}},
            "emphasis": {"scale": True, "itemStyle": {"shadowBlur": 14, "shadowColor": "rgba(0,0,0,0.45)"}},
        }
        return {
            "backgroundColor": "transparent",
            "title": title,
            "tooltip": tooltip,
            "legend": {
                "type": "scroll",
                "bottom": 6,
                "left": "center",
                "icon": "circle",
                "textStyle": {"color": "#cdd6df", "fontSize": 11},
            },
            "series": [series],
        }

    if category_col and ("date" in category_col.lower() or category_col.lower() == "trade_date") and chart_type not in ("scatter",):
        categories = categories

    if chart_type == "scatter":
        x_candidates = [c for c in columns if c != metric_col and isinstance(rows[0].get(c), (int, float))]
        if not x_candidates:
            return None
        x_col = x_candidates[0]
        series = [{
            "type": "scatter",
            "name": _format_metric_label(metric_col),
            "data": [[r.get(x_col), r.get(metric_col), str(r.get(category_col, ""))] for r in trimmed],
            "symbolSize": 10,
            "itemStyle": {"color": palette[1], "opacity": 0.85},
            "emphasis": {"scale": 1.8, "itemStyle": {"borderColor": "#fff", "borderWidth": 1}},
        }]
        return {
            "backgroundColor": "transparent",
            "title": title,
            "grid": grid,
            "legend": {"top": 38, "left": "center", "icon": "circle", "textStyle": {"color": "#cdd6df", "fontSize": 11}},
            "tooltip": {
                **tooltip,
                "formatter": (
                    "function(params){"
                    f"const xLabel = '{_format_metric_label(x_col)}';"
                    f"const yLabel = '{_format_metric_label(metric_col)}';"
                    "return `${params.value[2] || 'Point'}<br/>${xLabel}: ${params.value[0]}<br/>${yLabel}: ${params.value[1]}`;}"
                ),
            },
            "xAxis": {"type": "value", "name": _format_metric_label(x_col), **axis_style, "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}},
            "yAxis": {"type": "value", "name": _format_metric_label(metric_col), **axis_style, "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}},
            "series": series,
        }

    common_series = {
        "data": values,
        "label": {"show": False},
            "itemStyle": {"color": palette[1], "borderRadius": [8, 8, 0, 0]},
            "emphasis": {"itemStyle": {"borderColor": "#fff", "borderWidth": 1}},
            "markPoint": {"data": [{"type": "max", "name": "Top"}]} if max_value is not None else None,
    }

    if chart_type == "bar":
        bar_data = [
                {
                    "value": values[i],
                    "itemStyle": {
                        "color": {
                            "type": "linear",
                            "x": 0,
                            "y": 0,
                            "x2": 0,
                            "y2": 1,
                            "colorStops": [
                                {"offset": 0, "color": palette[i % len(palette)]},
                                {"offset": 1, "color": "rgba(255,255,255,0.12)"},
                            ],
                        },
                        "borderRadius": [8, 8, 0, 0],
                    },
                }
                for i in range(len(values))
        ]
        return {
            "backgroundColor": "transparent",
            "title": title,
            "grid": grid,
            "legend": {"top": 38, "left": "center", "icon": "circle", "textStyle": {"color": "#cdd6df", "fontSize": 11}},
            "tooltip": tooltip,
            "xAxis": {"type": "category", "data": categories, **axis_style, "axisLabel": {**axis_style["axisLabel"], "rotate": 24}},
            "yAxis": {"type": "value", "name": _format_metric_label(metric_col), **axis_style, "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}},
            "series": [{
                "type": "bar",
                **common_series,
                "name": _format_metric_label(metric_col),
                "data": bar_data,
            }],
        }

    if chart_type in ("line", "area"):
        series = {
            "type": "line",
            "name": _format_metric_label(metric_col),
            **common_series,
            "smooth": True,
            "symbol": "circle",
            "symbolSize": 8,
            "lineStyle": {"width": 3, "color": palette[0]},
            "itemStyle": {"color": palette[0]},
            "areaStyle": {"color": {"type": "linear", "x": 0, "y": 0, "x2": 0, "y2": 1, "colorStops": [{"offset": 0, "color": "rgba(14,165,233,0.42)"}, {"offset": 1, "color": "rgba(20,184,166,0.06)"}]}} if chart_type == "area" else None,
            "label": {"show": False},
            "endLabel": {"show": False} if values else None,
        }
        return {
            "backgroundColor": "transparent",
            "title": title,
            "grid": grid,
            "legend": {"top": 38, "left": "center", "icon": "circle", "textStyle": {"color": "#cdd6df", "fontSize": 11}},
            "tooltip": tooltip,
            "xAxis": {"type": "category", "data": categories, **axis_style},
            "yAxis": {"type": "value", "name": _format_metric_label(metric_col), **axis_style, "splitLine": {"lineStyle": {"color": "#2d2d2d", "type": "dashed"}}},
            "series": [series],
        }

    return None


def _finalize_chart_option(
    chart_option: dict | None,
    rows: list[dict],
    columns: list[str],
    question: str,
) -> dict | None:
    chart_type = _extract_chart_type_preference(question) or suggest_chart_type(question, columns, len(rows)) or "bar"
    local_option = _build_chart_option(rows, columns, question, chart_type)
    return local_option or chart_option


def text_to_sql_and_run(question: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Mode 1: Generate SQL, execute, return data + optional ECharts option. Two-pass AI for summary and anomalies."""
    unsupported_message = _unsupported_metric_message(question)
    if unsupported_message:
        return {
            "data": [],
            "sql": None,
            "chartOption": None,
            "aiSummary": unsupported_message,
            "anomalyTradeIds": [],
            "error": unsupported_message,
        }

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
        chart_option = _finalize_chart_option(chart_option, prev_data, columns, question)
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
    attempts = 0
    while run_err and attempts < 2:
        repaired_sql, repair_err = _repair_sql_after_error(question, sql, run_err, context)
        if not repaired_sql or repair_err:
            break
        rows, next_err = run_sql(repaired_sql)
        if not next_err:
            sql = repaired_sql
            run_err = None
            break
        sql = repaired_sql
        run_err = next_err
        attempts += 1
    if run_err:
        return {
            "data": [],
            "sql": sql,
            "chartOption": None,
            "aiSummary": None,
            "anomalyTradeIds": [],
            "error": (
                "I couldn't generate a valid database query for that request. "
                "Please try rephrasing it with a specific metric, date, trader, sector, or security."
            ),
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
    if user_asked_for_graph:
        chart_option = _finalize_chart_option(chart_option, rows, columns, question)

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
        return _build_chart_option(rows, columns, "Generated from query results", chart_type_hint or "bar")
    try:
        text_clean = text.strip()
        if text_clean.startswith("```"):
            text_clean = re.sub(r"^```\w*\n?", "", text_clean)
            text_clean = re.sub(r"\n?```\s*$", "", text_clean)
        out = json.loads(text_clean)
        return out.get("echarts_option") or _build_chart_option(rows, columns, "Generated from query results", chart_type_hint or "bar")
    except json.JSONDecodeError:
        return _build_chart_option(rows, columns, "Generated from query results", chart_type_hint or "bar")


def _extract_chart_type_preference(message: str) -> str | None:
    """Extract user's chart type preference from message. Returns pie, bar, line, area, scatter, doughnut, or None."""
    m = f" {message.lower().strip()} "

    if re.search(r"\b(not\s+a?\s*)?doughnut\b|\bdonut\b", m):
        return "doughnut" if "not doughnut" not in m and "not donut" not in m else "bar"
    if re.search(r"\bscatter(?:\s+plot|\s+chart|\s+graph)?\b", m):
        return "scatter" if "not scatter" not in m else "bar"
    if re.search(r"\barea(?:\s+chart|\s+graph)?\b", m):
        return "area" if "not area" not in m else "bar"
    if re.search(r"\bline(?:\s+chart|\s+graph)?\b", m):
        if "not a line" in m or "not line" in m:
            if "pie" in m:
                return "pie"
            if "bar" in m:
                return "bar"
            return "bar"
        return "line"
    if re.search(r"\bbar(?:\s+chart|\s+graph)?\b", m):
        if "not a bar" in m or "not bar" in m:
            if "pie" in m:
                return "pie"
            if "line" in m:
                return "line"
            return "pie"
        return "bar"
    if re.search(r"\bpie(?:\s+chart|\s+graph)?\b", m):
        if "not a pie" in m or "not pie" in m:
            if "bar" in m:
                return "bar"
            return "bar"
        return "pie"
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


def _should_attach_visuals_for_chat(question: str) -> bool:
    q = (question or "").lower()
    if _intent_supported(q):
        return True
    return any(
        token in q
        for token in [
            "show",
            "compare",
            "summarize",
            "summary",
            "explain",
            "which",
            "what",
            "largest",
            "most",
            "top",
            "outlier",
            "unusual",
            "activity",
        ]
    )


def _clean_chat_visual_summary(summary: str | None) -> str:
    text = (summary or "").strip()
    if not text:
        return ""
    return re.sub(
        r"\n*\s*Would you like me to create a graph from this data\?\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()


def rag_chat(
    question: str,
    history: list[dict[str, str]] | None = None,
    context_snapshot: dict | None = None,
    response_style: str | None = "detailed",
) -> tuple[str, dict | None, list | None, str | None]:
    """Mode 2: RAG chat via Bedrock.
    If context_snapshot is provided (from last Data Query), prepend it so the LLM can analyze that data.
    Returns (answer, chart_option). chart_option is set when user says 'yes' to graph or asks for one."""
    unsupported_message = _unsupported_metric_message(question)
    if unsupported_message:
        return unsupported_message, None, None, None

    style = (response_style or "detailed").lower()
    style_instruction = (
        "Use the heading 'Short Explanation' followed by a concise answer. "
        "Then use the heading 'Feedback' and place the practical recommendation there at the end."
        if style == "short"
        else "Use the heading 'Detailed Explanation' followed by a fuller explanation. "
        "Then use the heading 'Feedback' and place the practical recommendation there at the end."
    )
    system = (
        "You are a fixed income trading analyst. Answer based on the database schema: "
        "tables trades, securities, counterparties, traders, desks; views v_trades_full, "
        "v_daily_summary, v_counterparty_activity, v_trader_performance. "
        f"The latest available trade_date in this sample data is {_latest_trade_date()}, so interpret "
        "\"today\" as that date and \"yesterday\" as one day earlier. "
        "Explain insights clearly, do not include SQL in your answer, and if the user asks for unsupported "
        "metrics like P&L, win rate, VWAP, benchmark prices, or slippage, say the dataset does not contain those fields. "
        "Do not use markdown asterisks around titles. "
        f"{style_instruction}"
    )
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
                answer = _clean_chat_visual_summary(result.get("aiSummary"))
                if not answer:
                    answer = f"Here are the results. Total Trades: {len(extra_data)}."
                if chart_option:
                    answer += "\n\nI've created a graph. It should appear in the AI Graph panel."
    elif not context_snapshot and _should_attach_visuals_for_chat(question):
        result = text_to_sql_and_run(question, None)
        if not result.get("error") and result.get("data"):
            extra_data = result.get("data", [])
            extra_sql = result.get("sql")
            columns = list(extra_data[0].keys()) if extra_data else []
            chart_option = result.get("chartOption") or _finalize_chart_option(
                None,
                extra_data,
                columns,
                question,
            )
            visual_summary = _clean_chat_visual_summary(result.get("aiSummary"))
            if visual_summary and visual_summary.lower() not in answer.lower():
                answer = answer.rstrip() + "\n\n" + visual_summary
            if chart_option and "ai graph panel" not in answer.lower():
                answer = answer.rstrip() + "\n\nI've added a supporting graph and table for this question."
    return (answer, chart_option, extra_data, extra_sql)
