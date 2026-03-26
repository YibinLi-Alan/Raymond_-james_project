import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useBlotterStore } from '../store/useBlotterStore';
import type { SizeAnomaly, FrequencyAnomaly } from '../api/client';

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

type AnomalyRow = {
  type: 'size';
  tradeId: string;
  counterpartyName: string;
  notionalUsd: number;
  zScore: number;
  direction: 'HIGH' | 'LOW';
  cpMeanNotionalUsd: number;
  sampleSize: number;
  tradeDate: string;
} | {
  type: 'frequency';
  tradeId: null;
  counterpartyName: string;
  notionalUsd: null;
  zScore: number | null;
  direction: 'HIGH' | 'LOW' | 'SILENT';
  tradeDate: string;
  todayCount: number;
  historicalDailyAvg: number;
  sampleDays: number;
  lowConfidence: boolean;
};

interface AnomaliesPanelProps {
  trades: { internalTradeId: string; tradeDate: string }[];
}

export function AnomaliesPanel({ trades }: AnomaliesPanelProps) {
  const [showAllTime, setShowAllTime] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'size' | 'frequency'>('all');

  const sizeAnomalyDetails = useBlotterStore((s) => s.sizeAnomalyDetails);
  const frequencyAnomalies = useBlotterStore((s) => s.frequencyAnomalies);
  const anomalyDayPercentile = useBlotterStore((s) => s.anomalyDayPercentile);
  const anomalyIsLoading = useBlotterStore((s) => s.anomalyIsLoading);
  const anomalyLastComputedAt = useBlotterStore((s) => s.anomalyLastComputedAt);
  const setSelectedTradeId = useBlotterStore((s) => s.setSelectedTradeId);

  const tradeDateMap = useMemo(
    () => new Map(trades.map((t) => [t.internalTradeId, t.tradeDate])),
    [trades]
  );

  const maxTradeDate = useMemo(() => {
    if (trades.length === 0) return null;
    return trades.reduce((max, t) => (t.tradeDate > max ? t.tradeDate : max), trades[0].tradeDate);
  }, [trades]);

  const sizeAnomaliesWithDate = useMemo(
    () => sizeAnomalyDetails.map((a) => ({
      ...a,
      tradeDate: tradeDateMap.get(a.tradeId) ?? '',
    })),
    [sizeAnomalyDetails, tradeDateMap]
  );

  const filteredSizeAnomalies = useMemo(() => {
    if (showAllTime || !maxTradeDate) return sizeAnomaliesWithDate;
    return sizeAnomaliesWithDate.filter((a) => a.tradeDate === maxTradeDate);
  }, [sizeAnomaliesWithDate, showAllTime, maxTradeDate]);

  const filteredFrequencyAnomalies = useMemo(() => {
    // Frequency anomalies are always "today" by definition; show all when toggle is on
    return frequencyAnomalies;
  }, [frequencyAnomalies]);

  const tableRows = useMemo<AnomalyRow[]>(() => {
    const sizeRows: AnomalyRow[] = filteredSizeAnomalies.map((a) => ({
      type: 'size' as const,
      tradeId: a.tradeId,
      counterpartyName: a.counterpartyName,
      notionalUsd: a.notionalUsd,
      zScore: a.zScore,
      direction: a.direction,
      cpMeanNotionalUsd: a.cpMeanNotionalUsd,
      sampleSize: a.sampleSize,
      tradeDate: a.tradeDate,
    }));
    const freqRows: AnomalyRow[] = filteredFrequencyAnomalies.map((a) => ({
      type: 'frequency' as const,
      tradeId: null,
      counterpartyName: a.counterpartyName,
      notionalUsd: null,
      zScore: a.zScore,
      direction: a.direction,
      tradeDate: maxTradeDate ?? '',
      todayCount: a.todayCount,
      historicalDailyAvg: a.historicalDailyAvg,
      sampleDays: a.sampleDays,
      lowConfidence: a.lowConfidence,
    }));

    if (activeTab === 'size') return sizeRows;
    if (activeTab === 'frequency') return freqRows;
    return [...sizeRows, ...freqRows];
  }, [filteredSizeAnomalies, filteredFrequencyAnomalies, activeTab, maxTradeDate]);

  const [sortCol, setSortCol] = useState<string>('zScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    const rows = [...tableRows];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortCol) {
        case 'type':       av = a.type; bv = b.type; break;
        case 'cp':         av = a.counterpartyName; bv = b.counterpartyName; break;
        case 'date':       av = a.tradeDate; bv = b.tradeDate; break;
        case 'tradeId':    av = a.tradeId ?? ''; bv = b.tradeId ?? ''; break;
        case 'notional':   av = a.notionalUsd ?? 0; bv = b.notionalUsd ?? 0; break;
        case 'zScore':     av = a.zScore ?? 0; bv = b.zScore ?? 0; break;
        case 'direction':  av = a.direction; bv = b.direction; break;
        default:           return 0;
      }
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return rows;
  }, [tableRows, sortCol, sortDir]);

  // --- Scatter plot: Notional vs Z-Score (size anomalies only) ---
  const scatterOption = useMemo<EChartsOption>(() => {
    const highData = filteredSizeAnomalies
      .filter((a) => a.direction === 'HIGH')
      .map((a) => ({
        value: [a.notionalUsd, a.zScore],
        name: a.counterpartyName,
        tradeId: a.tradeId,
        notional: a.notionalUsd,
      }));
    const lowData = filteredSizeAnomalies
      .filter((a) => a.direction === 'LOW')
      .map((a) => ({
        value: [a.notionalUsd, a.zScore],
        name: a.counterpartyName,
        tradeId: a.tradeId,
        notional: a.notionalUsd,
      }));

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Notional vs Z-Score',
        textStyle: { color: '#e0e0e0', fontSize: 12, fontWeight: 500 },
        left: 10,
        top: 2,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1e1e2e',
        borderColor: '#444',
        textStyle: { color: '#e0e0e0', fontSize: 11 },
        formatter: (params: { data: { name: string; value: number[]; notional: number } }) => {
          const d = params.data;
          return `${d.name}<br/>Notional: ${formatCurrency(d.notional)}<br/>Z-Score: ${d.value[1].toFixed(2)}σ`;
        },
      },
      grid: { left: 60, right: 20, top: 50, bottom: 36 },
      xAxis: {
        type: 'value',
        name: 'Notional ($)',
        nameTextStyle: { color: '#888', fontSize: 10 },
        axisLabel: {
          color: '#888',
          fontSize: 10,
          formatter: (v: number) => {
            if (v >= 1e9) return `$${Math.round(v / 1e9)}B`;
            if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
            if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
            return `$${v}`;
          },
        },
        splitLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        name: 'Z-Score (σ)',
        nameLocation: 'end',
        nameGap: 8,
        nameTextStyle: { color: '#888', fontSize: 10 },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333' } },
      },
      series: [
        {
          name: 'HIGH',
          type: 'scatter',
          data: highData,
          symbolSize: 8,
          itemStyle: { color: '#ef4444' },
        },
        {
          name: 'LOW',
          type: 'scatter',
          data: lowData,
          symbolSize: 8,
          itemStyle: { color: '#3b82f6' },
        },
      ],
      legend: {
        data: ['HIGH', 'LOW'],
        textStyle: { color: '#aaa', fontSize: 10 },
        right: 10,
        top: 22,
      },
    };
  }, [filteredSizeAnomalies]);

  // --- Bar chart: Top counterparties by anomaly count ---
  const barOption = useMemo<EChartsOption>(() => {
    const cpCounts = new Map<string, { size: number; frequency: number }>();
    for (const a of filteredSizeAnomalies) {
      const entry = cpCounts.get(a.counterpartyName) ?? { size: 0, frequency: 0 };
      entry.size++;
      cpCounts.set(a.counterpartyName, entry);
    }
    for (const a of filteredFrequencyAnomalies) {
      const entry = cpCounts.get(a.counterpartyName) ?? { size: 0, frequency: 0 };
      entry.frequency++;
      cpCounts.set(a.counterpartyName, entry);
    }

    const sorted = [...cpCounts.entries()]
      .map(([name, counts]) => ({ name, ...counts, total: counts.size + counts.frequency }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const categories = sorted.map((d) => d.name);
    const sizeData = sorted.map((d) => d.size);
    const freqData = sorted.map((d) => d.frequency);

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Top CPs by Anomaly Count',
        textStyle: { color: '#e0e0e0', fontSize: 12, fontWeight: 500 },
        left: 10,
        top: 2,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e1e2e',
        borderColor: '#444',
        textStyle: { color: '#e0e0e0', fontSize: 11 },
      },
      grid: { left: 120, right: 20, top: 50, bottom: 24 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'category',
        data: categories.reverse(),
        axisLabel: {
          color: '#ccc',
          fontSize: 10,
          width: 100,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: 'Size Anomalies',
          type: 'bar',
          stack: 'total',
          data: [...sizeData].reverse(),
          itemStyle: { color: '#f59e0b' },
          barMaxWidth: 18,
        },
        {
          name: 'Frequency Anomalies',
          type: 'bar',
          stack: 'total',
          data: [...freqData].reverse(),
          itemStyle: { color: '#3b82f6' },
          barMaxWidth: 18,
        },
      ],
      legend: {
        data: ['Size Anomalies', 'Frequency Anomalies'],
        textStyle: { color: '#aaa', fontSize: 10 },
        left: 10,
        top: 22,
      },
    };
  }, [filteredSizeAnomalies, filteredFrequencyAnomalies]);

  const handleScatterClick = (params: { data?: { tradeId?: string } }) => {
    if (params.data?.tradeId) {
      setSelectedTradeId(params.data.tradeId);
    }
  };

  if (anomalyIsLoading) {
    return (
      <div className="anomalies-panel anomalies-panel--loading">
        <p>Computing anomalies...</p>
      </div>
    );
  }

  if (sizeAnomalyDetails.length === 0 && frequencyAnomalies.length === 0) {
    return (
      <div className="anomalies-panel anomalies-panel--empty">
        <p>No anomalies detected. All trades are within expected ranges.</p>
      </div>
    );
  }

  return (
    <div className="anomalies-panel">
      {/* Header */}
      <div className="anomalies-header">
        <div className="anomalies-header-left">
          <h3 className="anomalies-title">Anomaly Detection</h3>
          {anomalyDayPercentile !== null && anomalyDayPercentile >= 95 && (
            <span className="anomalies-volume-tag">
              {Math.round(anomalyDayPercentile)}th pctl volume day
            </span>
          )}
        </div>
        <div className="anomalies-header-right">
          {anomalyLastComputedAt && (
            <span className="anomalies-timestamp">
              Updated {new Date(anomalyLastComputedAt).toLocaleTimeString()}
            </span>
          )}
          <label className="anomalies-toggle">
            <input
              type="checkbox"
              checked={showAllTime}
              onChange={(e) => setShowAllTime(e.target.checked)}
            />
            <span>All-time</span>
          </label>
        </div>
      </div>

      {/* Methodology (collapsible) */}
      <div className="anomalies-methodology">
        <button
          className="anomalies-methodology-toggle"
          onClick={() => setMethodologyOpen(!methodologyOpen)}
        >
          {methodologyOpen ? '▾' : '▸'} How are anomalies detected?
        </button>
        {methodologyOpen && (
          <div className="anomalies-methodology-body">
            <div className="anomalies-methodology-section">
              <strong>Size Anomalies</strong>
              <p>
                Each trade's notional value is log-transformed and compared against its counterparty's
                historical distribution. Trades where the Z-score exceeds ±2 standard deviations are
                flagged. Only trades with notional ≥ $1M are considered. Counterparties with fewer
                than 5 historical trades are excluded.
              </p>
            </div>
            <div className="anomalies-methodology-section">
              <strong>Frequency Anomalies</strong>
              <p>
                For each counterparty, we compute the mean and standard deviation of their daily trade
                count across all historical trading days. If today's count deviates by more than ±1.5σ
                from the mean, the counterparty is flagged. A "SILENT" flag means the counterparty
                has trading history but zero trades today.
              </p>
            </div>
            <div className="anomalies-methodology-section">
              <strong>What do the colors mean?</strong>
              <p>
                <span style={{color: '#ef4444'}}>HIGH</span> = unusually large notional or high trade count.{' '}
                <span style={{color: '#3b82f6'}}>LOW</span> = unusually small notional or low trade count.{' '}
                <span style={{color: '#888'}}>SILENT</span> = counterparty expected to trade but sent nothing today.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Visualizations */}
      <div className="anomalies-charts">
        <div className="anomalies-chart-cell">
          <ReactECharts
            option={scatterOption}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={{ click: handleScatterClick }}
            notMerge
          />
        </div>
        <div className="anomalies-chart-cell">
          <ReactECharts
            option={barOption}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="anomalies-summary-bar">
        <span className="anomalies-count-badge anomalies-count-badge--size">
          {filteredSizeAnomalies.length} size anomalies
        </span>
        <span className="anomalies-count-badge anomalies-count-badge--freq">
          {filteredFrequencyAnomalies.length} frequency anomalies
        </span>
        {maxTradeDate && !showAllTime && (
          <span className="anomalies-date-label">Showing: {maxTradeDate}</span>
        )}
        {showAllTime && (
          <span className="anomalies-date-label">Showing: all trading days</span>
        )}
      </div>

      {/* Tab filter */}
      <div className="anomalies-tabs">
        {(['all', 'size', 'frequency'] as const).map((tab) => (
          <button
            key={tab}
            className={`anomalies-tab ${activeTab === tab ? 'anomalies-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All' : tab === 'size' ? 'Size' : 'Frequency'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="anomalies-table-wrapper">
        <table className="anomalies-table">
          <thead>
            <tr>
              {([
                ['type', 'Type'],
                ['cp', 'Counterparty'],
                ['date', 'Date'],
                ['tradeId', 'Trade ID'],
                ['notional', 'Notional'],
                ['zScore', 'Z-Score'],
                ['direction', 'Direction'],
              ] as const).map(([key, label]) => (
                <th
                  key={key}
                  className="anomalies-th-sortable"
                  onClick={() => handleSort(key)}
                >
                  {label} {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="anomalies-table-empty">
                  No anomalies match the current filter.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr
                  key={row.type === 'size' ? row.tradeId : `freq-${row.counterpartyName}-${idx}`}
                  className={`anomalies-table-row anomalies-table-row--${row.type}`}
                  onClick={() => {
                    if (row.type === 'size') setSelectedTradeId(row.tradeId);
                  }}
                  style={{ cursor: row.type === 'size' ? 'pointer' : 'default' }}
                >
                  <td>
                    <span className={`anomalies-type-badge anomalies-type-badge--${row.type}`}>
                      {row.type === 'size' ? 'Size' : 'Freq'}
                    </span>
                  </td>
                  <td className="anomalies-cell-cp">{row.counterpartyName}</td>
                  <td className="anomalies-cell-date">{row.tradeDate || '—'}</td>
                  <td className="anomalies-cell-id">{row.tradeId ?? '—'}</td>
                  <td className="anomalies-cell-notional">
                    {row.notionalUsd !== null ? formatCurrency(row.notionalUsd) : '—'}
                  </td>
                  <td className="anomalies-cell-zscore">
                    <span className={`anomalies-zscore anomalies-zscore--${row.direction.toLowerCase()}`}>
                      {row.zScore !== null ? `${row.zScore > 0 ? '+' : ''}${row.zScore.toFixed(2)}σ` : '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`anomalies-direction anomalies-direction--${row.direction.toLowerCase()}`}>
                      {row.direction}
                    </span>
                  </td>
                  <td className="anomalies-cell-detail">
                    {row.type === 'size'
                      ? `CP mean: ${formatCurrency(row.cpMeanNotionalUsd)} (n=${row.sampleSize})`
                      : row.type === 'frequency'
                      ? `Today: ${(row as Extract<AnomalyRow, {type:'frequency'}>).todayCount} vs avg ${(row as Extract<AnomalyRow, {type:'frequency'}>).historicalDailyAvg}/day${(row as Extract<AnomalyRow, {type:'frequency'}>).lowConfidence ? ' ⚠ low confidence' : ''}`
                      : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
