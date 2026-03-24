"""
Anomaly detection for Morning Blotter.

Pure numpy / scipy — no sklearn, no SQL-side aggregations.
All functions accept list[dict] already fetched from DB (camelCase keys as
produced by db.row_to_trade):
  - internalTradeId, counterpartyName, notionalUsd, tradeDate, cleanPrice, ...
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import numpy as np
from scipy import stats


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _log_notionals(trades: list[dict]) -> np.ndarray:
    """Return log(notionalUsd) array, NaN for any non-positive value."""
    raw = np.array([t.get("notionalUsd") or 0.0 for t in trades], dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        logged = np.where(raw > 0, np.log(raw), np.nan)
    return logged


def _group_by(trades: list[dict], key: str) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in trades:
        v = t.get(key) or ""
        if v:
            groups[v].append(t)
    return dict(groups)


# Minimum notional to include in both baseline statistics and anomaly scoring.
# Trades below this threshold are synthetic stub lots; including them inflates
# σ in log-space and suppresses HIGH flags by pushing the +2σ bound too high.
_MIN_NOTIONAL_USD: float = 1_000_000.0


# ---------------------------------------------------------------------------
# Function 1 — Size-based outliers
# ---------------------------------------------------------------------------

def compute_size_anomalies(trades: list[dict]) -> list[dict]:
    """
    Flag individual trades where log(notional_usd) deviates more than ±2 σ
    from that counterparty's historical log-notional distribution.

    Only trades with notional_usd >= _MIN_NOTIONAL_USD are used to build the
    per-CP baseline AND as candidates for flagging.  This prevents tiny stub
    trades from inflating σ and masking genuine large-notional outliers.

    Returns one dict per flagged trade, sorted by |z_score| descending.
    """
    by_cp = _group_by(trades, "counterpartyName")

    # Build per-CP log-notional baseline — exclude sub-threshold trades
    baselines: dict[str, tuple[float, float, int]] = {}  # cp -> (mu, sigma, n)
    for cp, cp_trades in by_cp.items():
        eligible = [t for t in cp_trades
                    if (t.get("notionalUsd") or 0.0) >= _MIN_NOTIONAL_USD]
        if len(eligible) < 5:
            continue
        log_vals = _log_notionals(eligible)
        valid = log_vals[~np.isnan(log_vals)]
        if len(valid) < 5:
            continue
        mu = float(np.mean(valid))
        sigma = float(np.std(valid, ddof=1))
        if sigma == 0.0:
            continue
        baselines[cp] = (mu, sigma, len(valid))

    results: list[dict] = []
    for trade in trades:
        cp = trade.get("counterpartyName") or ""
        if cp not in baselines:
            continue

        notional = trade.get("notionalUsd") or 0.0
        if notional < _MIN_NOTIONAL_USD:  # skip stub trades — same threshold as baseline
            continue

        mu, sigma, n = baselines[cp]
        z = (math.log(notional) - mu) / sigma

        if abs(z) <= 2.0:
            continue

        results.append({
            "tradeId": trade.get("internalTradeId"),
            "counterpartyName": cp,
            "zScore": round(z, 4),
            "direction": "HIGH" if z > 0 else "LOW",
            "notionalUsd": notional,
            # exp(mu) = geometric mean of raw notionals (log-space mean)
            "cpMeanNotionalUsd": round(math.exp(mu), 2),
            "sampleSize": n,
        })

    results.sort(key=lambda x: abs(x["zScore"]), reverse=True)
    return results


# ---------------------------------------------------------------------------
# Function 2 — Frequency anomalies
# ---------------------------------------------------------------------------

def compute_frequency_anomalies(trades: list[dict]) -> list[dict]:
    """
    Flag counterparties whose trade count on the most recent date deviates
    more than ±1.5 σ from their historical daily average.

    Directions:
      HIGH   — unusually many trades today
      LOW    — unusually few trades today (but > 0)
      SILENT — CP has trading history but sent 0 trades today

    lowConfidence is True when fewer than 30 sample days are available.
    Returns one dict per flagged counterparty, sorted by |z_score| descending.
    """
    # Build CP → {date → count} matrix
    daily: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for trade in trades:
        cp = trade.get("counterpartyName") or ""
        date = trade.get("tradeDate") or ""
        if cp and date:
            daily[cp][date] += 1

    all_dates = sorted({t.get("tradeDate") for t in trades if t.get("tradeDate")})
    if not all_dates:
        return []
    today = all_dates[-1]  # max(trade_date) in the dataset — never datetime.today()

    results: list[dict] = []

    for cp, date_counts in daily.items():
        counts_arr = np.array(list(date_counts.values()), dtype=float)
        n_days = int(counts_arr.size)

        mu = float(np.mean(counts_arr))
        sigma = float(np.std(counts_arr, ddof=1)) if n_days > 1 else 0.0

        today_count = date_counts.get(today, 0)

        # Z-score (guard against sigma == 0)
        if sigma > 0:
            z = (today_count - mu) / sigma
        else:
            # No historical variation — any deviation is noteworthy
            z = 0.0

        # Classify direction and decide whether to flag
        if today_count == 0 and mu >= 1.0:
            # CP has a real trading history but was completely silent today
            direction = "SILENT"
        elif z > 1.5:
            direction = "HIGH"
        elif z < -1.5:
            direction = "LOW"
        else:
            continue  # within normal range — skip

        results.append({
            "counterpartyName": cp,
            "direction": direction,
            "zScore": round(z, 4),
            "todayCount": today_count,
            "historicalDailyAvg": round(mu, 2),
            "sampleDays": n_days,
            "lowConfidence": n_days < 30,
        })

    results.sort(key=lambda x: abs(x["zScore"]), reverse=True)
    return results


# ---------------------------------------------------------------------------
# Function 3 — Day volume percentile
# ---------------------------------------------------------------------------

def compute_day_percentile(trades: list[dict]) -> float:
    """
    Return the percentile rank of today's total notional_usd relative to all
    other trading days in the dataset.
    'today' = max(trade_date) in the dataset — never datetime.today().

    Uses scipy.stats.percentileofscore with kind='rank' so that a day equal
    to the historical max scores at the 100th percentile.
    """
    daily_vol: dict[str, float] = defaultdict(float)
    for trade in trades:
        date = trade.get("tradeDate") or ""
        notional = trade.get("notionalUsd") or 0.0
        if date:
            daily_vol[date] += notional

    if not daily_vol:
        return 0.0

    today = max(daily_vol.keys())
    today_volume = daily_vol[today]
    all_volumes = np.array(list(daily_vol.values()), dtype=float)

    pct = float(stats.percentileofscore(all_volumes, today_volume, kind="rank"))
    return round(pct, 2)


# ---------------------------------------------------------------------------
# Function 4 — Aggregate entry point
# ---------------------------------------------------------------------------

def get_all_anomalies(trades: list[dict]) -> dict[str, Any]:
    """
    Run all three detectors against the provided trade list and return a
    single envelope consumed by GET /api/anomalies.
    """
    size_anomalies = compute_size_anomalies(trades)
    frequency_anomalies = compute_frequency_anomalies(trades)
    day_percentile = compute_day_percentile(trades)

    return {
        "sizeAnomalies": size_anomalies,
        "frequencyAnomalies": frequency_anomalies,
        "dayPercentile": day_percentile,
        "computedAt": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "size": len(size_anomalies),
            "frequency": len(frequency_anomalies),
        },
    }
