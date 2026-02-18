import { useMemo, useCallback, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Trade } from '../types/trade';
import { BCLASS_COLORS } from '../data/bclassTaxonomy';

export interface BClassFilter {
  level1?: string;
  level2?: string;
  level3?: string;
}

interface BClassSunburstChartProps {
  trades: Trade[];
  onSegmentClick?: (filter: BClassFilter) => void;
  selectedFilter?: BClassFilter | null;
}

type MetricMode = 'volume' | 'count';

interface SunburstDataItem {
  name: string;
  value: number;
  tradeCount: number;
  children?: SunburstDataItem[];
  itemStyle?: { color: string };
  level?: number;
  path?: string;
}

// Format volume for display
function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Build hierarchical data for sunburst from trades
function buildSunburstData(
  trades: Trade[],
  metric: MetricMode
): SunburstDataItem[] {
  // Create hierarchy: Level1 -> Level2 -> Level3
  const hierarchy = new Map<string, Map<string, Map<string, { volume: number; count: number }>>>();

  trades.forEach(trade => {
    const l1 = trade.bclassLevel1;
    const l2 = trade.bclassLevel2;
    const l3 = trade.bclassLevel3;

    if (!hierarchy.has(l1)) {
      hierarchy.set(l1, new Map());
    }
    const l1Map = hierarchy.get(l1)!;

    if (!l1Map.has(l2)) {
      l1Map.set(l2, new Map());
    }
    const l2Map = l1Map.get(l2)!;

    const existing = l2Map.get(l3) || { volume: 0, count: 0 };
    l2Map.set(l3, {
      volume: existing.volume + trade.notionalUsd,
      count: existing.count + 1,
    });
  });

  // Convert hierarchy to sunburst format
  const data: SunburstDataItem[] = [];

  hierarchy.forEach((l1Map, l1Name) => {
    const l1Children: SunburstDataItem[] = [];
    let l1Total = { volume: 0, count: 0 };

    l1Map.forEach((l2Map, l2Name) => {
      const l2Children: SunburstDataItem[] = [];
      let l2Total = { volume: 0, count: 0 };

      l2Map.forEach((metrics, l3Name) => {
        l2Total.volume += metrics.volume;
        l2Total.count += metrics.count;

        l2Children.push({
          name: l3Name,
          value: metric === 'volume' ? metrics.volume : metrics.count,
          tradeCount: metrics.count,
          level: 3,
          path: `${l1Name}/${l2Name}/${l3Name}`,
          itemStyle: { color: BCLASS_COLORS[l3Name] || BCLASS_COLORS[l2Name] || BCLASS_COLORS[l1Name] || '#4B5563' },
        });
      });

      l1Total.volume += l2Total.volume;
      l1Total.count += l2Total.count;

      l1Children.push({
        name: l2Name,
        value: metric === 'volume' ? l2Total.volume : l2Total.count,
        tradeCount: l2Total.count,
        children: l2Children,
        level: 2,
        path: `${l1Name}/${l2Name}`,
        itemStyle: { color: BCLASS_COLORS[l2Name] || BCLASS_COLORS[l1Name] || '#525252' },
      });
    });

    data.push({
      name: l1Name,
      value: metric === 'volume' ? l1Total.volume : l1Total.count,
      tradeCount: l1Total.count,
      children: l1Children,
      level: 1,
      path: l1Name,
      itemStyle: { color: BCLASS_COLORS[l1Name] || '#78716C' },
    });
  });

  // Sort by value descending
  data.sort((a, b) => (b.value || 0) - (a.value || 0));
  data.forEach(l1 => {
    l1.children?.sort((a, b) => (b.value || 0) - (a.value || 0));
    l1.children?.forEach(l2 => {
      l2.children?.sort((a, b) => (b.value || 0) - (a.value || 0));
    });
  });

  return data;
}

export function BClassSunburstChart({
  trades,
  onSegmentClick,
  selectedFilter,
}: BClassSunburstChartProps) {
  const [metric, setMetric] = useState<MetricMode>('volume');

  const sunburstData = useMemo(
    () => buildSunburstData(trades, metric),
    [trades, metric]
  );

  const totalValue = useMemo(() => {
    if (metric === 'volume') {
      return trades.reduce((sum, t) => sum + t.notionalUsd, 0);
    }
    return trades.length;
  }, [trades, metric]);

  const handleChartClick = useCallback((params: { data?: SunburstDataItem }) => {
    if (!params.data || !params.data.path) return;

    const { path } = params.data;
    const parts = path.split('/');

    // Build filter based on clicked level - no drill-down, just filter
    const filter: BClassFilter = {};
    if (parts[0]) filter.level1 = parts[0];
    if (parts[1]) filter.level2 = parts[1];
    if (parts[2]) filter.level3 = parts[2];

    onSegmentClick?.(filter);
  }, [onSegmentClick]);

  const option = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(23, 23, 23, 0.95)',
        borderColor: '#404040',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#E5E5E5',
          fontSize: 12,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        extraCssText: 'border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);',
        formatter: (params: { data?: SunburstDataItem }) => {
          if (!params.data) return '';
          const { name, value, tradeCount } = params.data;
          const displayValue = metric === 'volume' ? formatVolume(value!) : value?.toLocaleString();
          return `
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #FAFAFA;">${name}</div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #A3A3A3;">${metric === 'volume' ? 'Volume' : 'Count'}</span>
              <span style="color: #F57C00; font-weight: 600;">${displayValue}</span>
            </div>
            ${metric === 'volume' ? `
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-top: 4px;">
              <span style="color: #A3A3A3;">Trades</span>
              <span style="color: #D4D4D4;">${tradeCount?.toLocaleString()}</span>
            </div>
            ` : ''}
          `;
        },
      },
      series: [{
        type: 'sunburst',
        data: sunburstData,
        radius: ['15%', '92%'],
        center: ['50%', '50%'],
        sort: undefined,
        nodeClick: false,
        emphasis: {
          focus: 'ancestor',
          itemStyle: {
            shadowBlur: 25,
            shadowColor: 'rgba(245, 124, 0, 0.4)',
            borderColor: '#F57C00',
            borderWidth: 2,
          },
          label: {
            color: '#FAFAFA',
            fontWeight: 600,
          },
        },
        levels: [
          {}, // Root level (empty)
          { // Level 1 - Asset Classes (brightest, most prominent)
            r0: '15%',
            r: '40%',
            itemStyle: {
              borderWidth: 3,
              borderColor: '#171717',
              shadowBlur: 15,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
            label: {
              rotate: 'tangential',
              color: '#F5F5F5',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            },
          },
          { // Level 2 - Categories (medium prominence)
            r0: '40%',
            r: '68%',
            itemStyle: {
              borderWidth: 2,
              borderColor: '#171717',
            },
            label: {
              rotate: 'tangential',
              color: '#D4D4D4',
              fontSize: 10,
              fontWeight: 500,
            },
          },
          { // Level 3 - Sectors (subtle, background)
            r0: '68%',
            r: '92%',
            itemStyle: {
              borderWidth: 1,
              borderColor: '#1a1a1a',
            },
            label: {
              position: 'outside',
              color: '#737373',
              fontSize: 9,
              padding: 4,
              silent: false,
            },
          },
        ],
        label: {
          show: true,
          formatter: (params: { name: string }) => {
            const name = params.name;
            return name.length > 12 ? name.substring(0, 10) + '..' : name;
          },
        },
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0a0a0a',
          borderWidth: 2,
          shadowBlur: 12,
          shadowColor: 'rgba(0, 0, 0, 0.4)',
          shadowOffsetY: 2,
        },
      }],
    };
  }, [sunburstData, metric]);

  const onEvents = useMemo(() => ({
    click: handleChartClick,
  }), [handleChartClick]);

  // Check if there's an active filter
  const hasFilter = selectedFilter && (selectedFilter.level1 || selectedFilter.level2 || selectedFilter.level3);

  // Build breadcrumb from selected filter
  const filterPath: string[] = [];
  if (selectedFilter?.level1) filterPath.push(selectedFilter.level1);
  if (selectedFilter?.level2) filterPath.push(selectedFilter.level2);
  if (selectedFilter?.level3) filterPath.push(selectedFilter.level3);

  const handleClearFilter = useCallback(() => {
    onSegmentClick?.({});
  }, [onSegmentClick]);

  return (
    <div className="sunburst-chart-container">
      <div className="sunburst-chart-header">
        <div className="sunburst-chart-title">
          <h3>Asset Class Breakdown</h3>
          <span className="sunburst-chart-total">
            {metric === 'volume' ? formatVolume(totalValue) : `${totalValue.toLocaleString()} trades`}
          </span>
        </div>
        <div className="sunburst-controls">
          {hasFilter && (
            <button className="drill-up-btn" onClick={handleClearFilter}>
              Clear
            </button>
          )}
          <div className="metric-toggle">
            <button
              className={`metric-btn ${metric === 'volume' ? 'active' : ''}`}
              onClick={() => setMetric('volume')}
            >
              Volume
            </button>
            <button
              className={`metric-btn ${metric === 'count' ? 'active' : ''}`}
              onClick={() => setMetric('count')}
            >
              Count
            </button>
          </div>
        </div>
      </div>

      {hasFilter && (
        <div className="drill-breadcrumb">
          <span className="breadcrumb-item" onClick={handleClearFilter}>
            All
          </span>
          {filterPath.map((part, idx) => (
            <span key={idx}>
              <span className="breadcrumb-separator"> &gt; </span>
              <span className="breadcrumb-item-current">
                {part}
              </span>
            </span>
          ))}
        </div>
      )}

      <ReactECharts
        option={option}
        style={{ height: 'calc(100% - 40px)', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onEvents}
      />
    </div>
  );
}
