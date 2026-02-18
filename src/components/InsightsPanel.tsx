import { useMemo } from 'react';
import { Trade } from '../types/trade';

interface InsightsPanelProps {
  trades: Trade[];
  tradeCount: number;
  totalNotional: number;
}

// Format currency for display
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${(value / 1_000).toFixed(0)}K`;
}

interface RankedItem {
  name: string;
  value: number;
  adv: number;
  pctDiff: number;
  isUp: boolean;
}

export function InsightsPanel({ trades, tradeCount: _tradeCount, totalNotional }: InsightsPanelProps) {
  void _tradeCount;

  const insights = useMemo(() => {
    if (trades.length === 0) {
      return null;
    }

    // Get all trade dates
    const tradeDates = [...new Set(trades.map(t => t.tradeDate))].sort().reverse();
    const latestDate = tradeDates[0];
    const todaysTrades = trades.filter(t => t.tradeDate === latestDate);
    const todaysVolume = todaysTrades.reduce((sum, t) => sum + t.notionalUsd, 0);
    const numDays = tradeDates.length;

    // Calculate percentile
    const avgDailyVolume = totalNotional / Math.max(numDays, 1);
    const volumeRatio = todaysVolume / avgDailyVolume;
    const percentile = Math.min(99, Math.max(1, Math.round(50 + (volumeRatio - 1) * 30)));

    // Helper to calculate ADV for a grouping
    function calculateADV(
      allTrades: Trade[],
      groupKey: (t: Trade) => string,
      valueKey: (t: Trade) => number = (t) => t.notionalUsd
    ): Record<string, number> {
      const dailyTotals: Record<string, Record<string, number>> = {};

      // Group by date, then by key
      allTrades.forEach(t => {
        const date = t.tradeDate;
        const key = groupKey(t);
        if (!dailyTotals[key]) dailyTotals[key] = {};
        if (!dailyTotals[key][date]) dailyTotals[key][date] = 0;
        dailyTotals[key][date] += valueKey(t);
      });

      // Calculate average across days for each key
      const adv: Record<string, number> = {};
      Object.entries(dailyTotals).forEach(([key, dateValues]) => {
        const total = Object.values(dateValues).reduce((sum, v) => sum + v, 0);
        adv[key] = total / numDays;
      });

      return adv;
    }

    // Helper to calculate percentage difference
    function calcPctDiff(value: number, adv: number): number {
      if (adv === 0) return value > 0 ? 100 : 0;
      return ((value - adv) / adv) * 100;
    }

    // Top 5 counterparties with ADV
    const counterpartyADV = calculateADV(trades, t => t.counterpartyName);
    const counterpartyVolumes: Record<string, number> = {};
    todaysTrades.forEach(t => {
      counterpartyVolumes[t.counterpartyName] = (counterpartyVolumes[t.counterpartyName] || 0) + t.notionalUsd;
    });
    const topCounterparties: RankedItem[] = Object.entries(counterpartyVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => {
        const adv = counterpartyADV[name] || 0;
        const pctDiff = calcPctDiff(value, adv);
        return {
          name,
          value,
          adv,
          pctDiff,
          isUp: pctDiff >= 0,
        };
      });

    // Top 5 traders with ADV
    const traderADV = calculateADV(trades, t => t.traderId);
    const traderVolumes: Record<string, number> = {};
    todaysTrades.forEach(t => {
      traderVolumes[t.traderId] = (traderVolumes[t.traderId] || 0) + t.notionalUsd;
    });
    const topTraders: RankedItem[] = Object.entries(traderVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => {
        const adv = traderADV[name] || 0;
        const pctDiff = calcPctDiff(value, adv);
        return {
          name,
          value,
          adv,
          pctDiff,
          isUp: pctDiff >= 0,
        };
      });

    // Top 5 trades (individual trades don't have ADV, use ticker ADV)
    const tickerADV = calculateADV(trades, t => t.ticker);
    const topTrades = [...todaysTrades]
      .sort((a, b) => b.notionalUsd - a.notionalUsd)
      .slice(0, 5)
      .map(t => {
        const adv = tickerADV[t.ticker] || 0;
        const pctDiff = calcPctDiff(t.notionalUsd, adv);
        return {
          name: t.ticker,
          value: t.notionalUsd,
          adv,
          pctDiff,
          isUp: pctDiff >= 0,
          tradeId: t.internalTradeId,
        };
      });

    // Top 5 products with ADV
    const productADV = calculateADV(trades, t => t.product);
    const productVolumes: Record<string, number> = {};
    todaysTrades.forEach(t => {
      productVolumes[t.product] = (productVolumes[t.product] || 0) + t.notionalUsd;
    });
    const topProducts: RankedItem[] = Object.entries(productVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => {
        const adv = productADV[name] || 0;
        const pctDiff = calcPctDiff(value, adv);
        return {
          name,
          value,
          adv,
          pctDiff,
          isUp: pctDiff >= 0,
        };
      });

    // Top 5 asset classes with ADV
    const assetClassADV = calculateADV(trades, t => t.bclassLevel1);
    const assetClassVolumes: Record<string, number> = {};
    todaysTrades.forEach(t => {
      assetClassVolumes[t.bclassLevel1] = (assetClassVolumes[t.bclassLevel1] || 0) + t.notionalUsd;
    });
    const topAssetClasses: RankedItem[] = Object.entries(assetClassVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => {
        const adv = assetClassADV[name] || 0;
        const pctDiff = calcPctDiff(value, adv);
        return {
          name,
          value,
          adv,
          pctDiff,
          isUp: pctDiff >= 0,
        };
      });

    // Top 5 tenors with ADV
    const tenorADV = calculateADV(trades, t => t.tenor);
    const tenorVolumes: Record<string, number> = {};
    todaysTrades.forEach(t => {
      tenorVolumes[t.tenor] = (tenorVolumes[t.tenor] || 0) + t.notionalUsd;
    });
    const topTenors: RankedItem[] = Object.entries(tenorVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => {
        const adv = tenorADV[name] || 0;
        const pctDiff = calcPctDiff(value, adv);
        return {
          name,
          value,
          adv,
          pctDiff,
          isUp: pctDiff >= 0,
        };
      });

    // Buy/Sell breakdown
    const buyVolume = todaysTrades.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.notionalUsd, 0);
    const buyPct = (buyVolume / todaysVolume) * 100;

    return {
      latestDate,
      todaysVolume,
      todaysTradeCount: todaysTrades.length,
      percentile,
      topCounterparties,
      topTraders,
      topTrades,
      topProducts,
      topAssetClasses,
      topTenors,
      buyPct,
    };
  }, [trades, totalNotional]);

  if (!insights) {
    return (
      <div className="insights-panel">
        <div className="insights-empty">No trading data available</div>
      </div>
    );
  }

  const formatPctDiff = (pct: number) => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  };

  const renderItem = (item: RankedItem, idx: number, key: string) => (
    <div key={key} className="column-item">
      <span className="item-rank">{idx + 1}.</span>
      <span className="item-name">{item.name}</span>
      <span className={`item-arrow ${item.isUp ? 'up' : 'down'}`}>
        {item.isUp ? '▲' : '▼'}
      </span>
      <span className={`item-pct ${item.isUp ? 'up' : 'down'}`}>{formatPctDiff(item.pctDiff)}</span>
      <span className="item-value">{formatCurrency(item.value)}</span>
    </div>
  );

  return (
    <div className="insights-panel">
      {/* Top Metrics Row */}
      <div className="insights-metrics-row">
        <div className="insights-metric">
          <span className="metric-value">{formatCurrency(insights.todaysVolume)}</span>
          <span className="metric-label">Notional</span>
        </div>
        <div className="insights-metric">
          <span className="metric-value">{insights.todaysTradeCount.toLocaleString()}</span>
          <span className="metric-label">Executions</span>
        </div>
        <div className="insights-metric">
          <span className="metric-value">{insights.percentile}th</span>
          <span className="metric-label">Percentile</span>
        </div>
        <div className="insights-metric flow-metric">
          <div className="metric-flow-bar">
            <div
              className="flow-buy"
              style={{ width: `${insights.buyPct}%` }}
            >
              <span className="flow-label-inside">Buy {insights.buyPct.toFixed(0)}%</span>
            </div>
            <div
              className="flow-sell"
              style={{ width: `${100 - insights.buyPct}%` }}
            >
              <span className="flow-label-inside">Sell {(100 - insights.buyPct).toFixed(0)}%</span>
            </div>
          </div>
          <span className="metric-label">Flow</span>
        </div>
      </div>

      {/* Six Panel Grid - 2 rows x 3 columns */}
      <div className="insights-grid">
        {/* Row 1 */}
        <div className="insights-column">
          <div className="column-title">Top Counterparties</div>
          <div className="column-list">
            {insights.topCounterparties.map((item, idx) => renderItem(item, idx, item.name))}
          </div>
        </div>

        <div className="insights-column">
          <div className="column-title">Top Traders</div>
          <div className="column-list">
            {insights.topTraders.map((item, idx) => renderItem(item, idx, item.name))}
          </div>
        </div>

        <div className="insights-column">
          <div className="column-title">Top Trades</div>
          <div className="column-list">
            {insights.topTrades.map((item, idx) => (
              <div key={item.tradeId} className="column-item">
                <span className="item-rank">{idx + 1}.</span>
                <span className="item-name">{item.name}</span>
                <span className={`item-arrow ${item.isUp ? 'up' : 'down'}`}>
                  {item.isUp ? '▲' : '▼'}
                </span>
                <span className={`item-pct ${item.isUp ? 'up' : 'down'}`}>{formatPctDiff(item.pctDiff)}</span>
                <span className="item-value">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 */}
        <div className="insights-column">
          <div className="column-title">Top Products</div>
          <div className="column-list">
            {insights.topProducts.map((item, idx) => renderItem(item, idx, item.name))}
          </div>
        </div>

        <div className="insights-column">
          <div className="column-title">Top Asset Classes</div>
          <div className="column-list">
            {insights.topAssetClasses.map((item, idx) => renderItem(item, idx, item.name))}
          </div>
        </div>

        <div className="insights-column">
          <div className="column-title">Top Tenors</div>
          <div className="column-list">
            {insights.topTenors.map((item, idx) => renderItem(item, idx, item.name))}
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="insights-footnote">
        * % change vs. average daily volume
      </div>
    </div>
  );
}
