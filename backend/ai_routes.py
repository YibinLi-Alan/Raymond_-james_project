"""
AI Assistant API: Text-to-SQL (Mode 1) and RAG Chat (Mode 2).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from backend.vanna_config import is_llm_configured
from backend.vanna_service import (
    train_vanna,
    text_to_sql_and_run,
    rag_chat,
)
from backend.db import get_trades_by_ids

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    question: str
    context: Optional[dict[str, Any]] = None  # e.g. current grid filter state


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[dict[str, str]]] = None


# Snake to camel for trade-like rows (partial mapping)
def _row_to_camel(row: dict) -> dict:
    key_map = {
        "internal_trade_id": "internalTradeId",
        "venue_execution_id": "venueExecutionId",
        "regulatory_report_id": "regulatoryReportId",
        "parent_trade_id": "parentTradeId",
        "allocation_id": "allocationId",
        "trade_date": "tradeDate",
        "execution_timestamp": "executionTimestamp",
        "original_entry_time": "originalEntryTime",
        "settlement_date": "settlementDate",
        "side": "side",
        "notional": "notional",
        "quantity_type_code": "quantityTypeCode",
        "clean_price": "cleanPrice",
        "price_type": "priceType",
        "yield": "yield",
        "yield_type": "yieldType",
        "accrued_interest_amount": "accruedInterestAmount",
        "gross_trade_amount": "grossTradeAmount",
        "net_money": "netMoney",
        "trade_currency": "tradeCurrency",
        "settlement_currency": "settlementCurrency",
        "fx_rate": "fxRate",
        "notional_usd": "notionalUsd",
        "counterparty_id": "counterpartyId",
        "counterparty_name": "counterpartyName",
        "executing_broker_id": "executingBrokerId",
        "trader_id": "traderId",
        "desk_id": "deskId",
        "cusip": "cusip",
        "ticker": "ticker",
        "issuer_name": "issuerName",
        "product": "product",
        "tenor": "tenor",
        "coupon": "coupon",
        "maturity_date": "maturityDate",
        "issue_date": "issueDate",
        "sector": "sector",
        "bclass_level1": "bclassLevel1",
        "bclass_level2": "bclassLevel2",
        "bclass_level3": "bclassLevel3",
        "bclass_level4": "bclassLevel4",
    }
    out = {}
    for k, v in row.items():
        out[key_map.get(k, k)] = v
    if "maturityDate" in out and "tradeDate" in out and "timeToMaturityYears" not in out:
        try:
            from datetime import datetime
            td = datetime.strptime(str(out["tradeDate"])[:10], "%Y-%m-%d")
            md = datetime.strptime(str(out["maturityDate"])[:10], "%Y-%m-%d")
            delta = (md - td).total_seconds() / (365.25 * 24 * 60 * 60)
            out["timeToMaturityYears"] = round(delta, 6)
        except Exception:
            out["timeToMaturityYears"] = 0
    return out


def _is_trade_like_result(data: list[dict]) -> bool:
    if not data:
        return False
    first = data[0]
    return "internal_trade_id" in first or "internalTradeId" in first


def _extract_trade_ids(data: list[dict]) -> list[str | int]:
    """Extract internal_trade_id from query result (DB uses TEXT, e.g. 'TRD-...')."""
    ids = []
    for row in data:
        tid = row.get("internal_trade_id") or row.get("internalTradeId")
        if tid is not None:
            ids.append(tid)
    return ids


def _sql_is_trade_query(sql: str | None) -> bool:
    """True if the SQL selects from v_trades_full or trades (so we should return trades for panels)."""
    if not sql or not sql.strip():
        return False
    s = sql.lower()
    return "v_trades_full" in s or " from trades " in s or " from trades;" in s or " join trades " in s


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/train")
def api_train():
    """Train Vanna on DDL, docs, and few-shot examples."""
    if not is_llm_configured():
        raise HTTPException(status_code=503, detail="Bedrock not configured. Create backend/bedrock_credentials.env with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID.")
    ok, msg = train_vanna()
    if not ok:
        raise HTTPException(status_code=500, detail=msg)
    return {"status": "ok", "message": msg}


@router.post("/query")
def api_query(req: QueryRequest):
    """
    Mode 1: Text-to-SQL. Generate SQL from question, execute, return data + optional ECharts option.
    If the result set looks like trades (e.g. from v_trades_full), also return trades for the grid.
    """
    if not is_llm_configured():
        raise HTTPException(status_code=503, detail="Bedrock not configured. Create backend/bedrock_credentials.env with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID.")
    result = text_to_sql_and_run(req.question, req.context)
    if result.get("error"):
        return result
    # When the query result is trade-like, fetch full trade rows so all panels get complete data
    if _is_trade_like_result(result["data"]):
        ids = _extract_trade_ids(result["data"])
        result["trades"] = get_trades_by_ids(ids) if ids else []
    # When the query returns 0 rows but is a trade query, still set trades=[] so panels show empty (not stale filtered data)
    elif not result["data"] and _sql_is_trade_query(result.get("sql")):
        result["trades"] = []
    return result


@router.post("/chat")
def api_chat(req: ChatRequest):
    """Mode 2: RAG chat — answer fixed income questions from schema and history."""
    if not is_llm_configured():
        raise HTTPException(status_code=503, detail="Bedrock not configured. Create backend/bedrock_credentials.env with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID.")
    answer = rag_chat(req.message, req.history)
    return {"answer": answer}
