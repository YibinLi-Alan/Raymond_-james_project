"""
Anomaly detection API endpoint.
No LLM calls — pure statistical computation via anomaly_service.
"""

from fastapi import APIRouter, HTTPException

from backend.db import fetch_all_trades
from backend.anomaly_service import get_all_anomalies

router = APIRouter(prefix="/api", tags=["anomalies"])


@router.get("/anomalies")
def get_anomalies():
    """
    Run all anomaly detectors against the full trade dataset and return results.

    Returns:
      sizeAnomalies      — trades whose log(notional) deviates >2σ from their
                           counterparty's historical mean (≥$100K trades only)
      frequencyAnomalies — counterparties whose today trade count deviates >1.5σ
                           from their historical daily average
      dayPercentile      — percentile rank of today's total notional vs all days
      computedAt         — UTC ISO timestamp of this computation
      counts             — { size: int, frequency: int }
    """
    try:
        trades = fetch_all_trades()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load trades: {exc}")

    try:
        result = get_all_anomalies(trades)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Anomaly computation failed: {exc}")

    return result
