import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { Trade } from '../types/trade';

interface CounterpartyDonutChartProps {
  trades: Trade[];
  filterContext: { date: string; product: string } | null;
  onCounterpartyClick?: (counterparty: string) => void;
  selectedCounterparty?: string | null;
}

// Counterparty colors - Bloomberg-style blues and grays
const COUNTERPARTY_COLORS = [
  '#2E75B6', // Dark blue
  '#5B9BD5', // Primary blue
  '#8FAADC', // Light blue
  '#BDD7EE', // Pale blue
  '#A6A6A6', // Medium gray
  '#7C8A96', // Blue-gray
  '#4472C4', // Accent blue
  '#9DC3E6', // Sky blue
  '#BFBFBF', // Light gray
  '#5A6A7A', // Slate
  '#6B8CAE', // Steel blue
  '#D0D0D0', // Lighter gray
];

interface CounterpartyVolume {
  name: string;
  value: number;
  tradeCount: number;
}

// Calculate volumes by counterparty
function calculateCounterpartyVolumes(
  trades: Trade[],
  filter: { date: string; product: string } | null
): CounterpartyVolume[] {
  // Filter trades if context is provided
  let filteredTrades = trades;
  if (filter) {
    filteredTrades = trades.filter(
      t => t.tradeDate === filter.date && t.product === filter.product
    );
  }

  // Group by counterparty
  const volumeByCounterparty = new Map<string, { volume: number; count: number }>();

  filteredTrades.forEach(trade => {
    const cp = trade.counterpartyName;
    const existing = volumeByCounterparty.get(cp) || { volume: 0, count: 0 };
    volumeByCounterparty.set(cp, {
      volume: existing.volume + trade.notionalUsd,
      count: existing.count + 1,
    });
  });

  // Convert to array and sort by volume
  const result = Array.from(volumeByCounterparty.entries())
    .map(([name, data]) => ({
      name,
      value: data.volume,
      tradeCount: data.count,
    }))
    .sort((a, b) => b.value - a.value);

  // Limit to top 10, group rest as "Other"
  if (result.length > 10) {
    const top10 = result.slice(0, 10);
    const others = result.slice(10);
    const otherVolume = others.reduce((sum, item) => sum + item.value, 0);
    const otherCount = others.reduce((sum, item) => sum + item.tradeCount, 0);
    top10.push({
      name: `Other (${others.length})`,
      value: otherVolume,
      tradeCount: otherCount,
    });
    return top10;
  }

  return result;
}

// Format large numbers for display
function formatVolume(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function CounterpartyDonutChart({
  trades,
  filterContext,
  onCounterpartyClick,
  selectedCounterparty,
}: CounterpartyDonutChartProps) {
  const counterpartyVolumes = useMemo(
    () => calculateCounterpartyVolumes(trades, filterContext),
    [trades, filterContext]
  );

  const totalVolume = useMemo(
    () => counterpartyVolumes.reduce((sum, item) => sum + item.value, 0),
    [counterpartyVolumes]
  );

  const handleChartEvents = useCallback(() => ({
    click: (params: { name?: string }) => {
      if (params.name && onCounterpartyClick && !params.name.startsWith('Other (')) {
        onCounterpartyClick(params.name);
      }
    },
  }), [onCounterpartyClick]);

  const onEvents = useMemo(() => handleChartEvents(), [handleChartEvents]);

  const option = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#2d2d2d',
        borderColor: '#3d3d3d',
        textStyle: {
          color: '#e0e0e0',
          fontSize: 12,
        },
        formatter: (params: { name?: string; value?: number; percent?: number; data?: { tradeCount?: number } }) => {
          if (!params.name || params.value === undefined) return '';
          const tradeCount = params.data?.tradeCount || 0;
          const isOther = params.name.startsWith('Other (');
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div>Volume: <span style="color: #4dabf7; font-weight: 600;">${formatVolume(params.value)}</span></div>
            <div>Share: <span style="font-weight: 600;">${params.percent?.toFixed(1)}%</span></div>
            <div>Trades: <span style="font-weight: 600;">${tradeCount}</span></div>
            ${!isOther ? '<div style="font-size: 11px; color: #a0a0a0; margin-top: 4px;">Click to filter trades</div>' : ''}
          `;
        },
      },
      legend: {
        show: false, // Hide legend to save space
      },
      series: [
        {
          name: 'Counterparty',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#1e1e1e',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'outside',
            color: '#a0a0a0',
            fontSize: 10,
            formatter: (params: { name?: string; percent?: number }) => {
              if (!params.name || !params.percent) return '';
              // Only show label for segments > 5%
              if (params.percent < 5) return '';
              // Truncate long names
              const name = params.name.length > 12
                ? params.name.substring(0, 10) + '...'
                : params.name;
              return `${name}\n${params.percent.toFixed(0)}%`;
            },
          },
          labelLine: {
            show: true,
            length: 10,
            length2: 8,
            lineStyle: {
              color: '#3d3d3d',
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold',
            },
          },
          data: counterpartyVolumes.map((item, index) => {
            const isSelected = selectedCounterparty === item.name;
            const baseColor = COUNTERPARTY_COLORS[index % COUNTERPARTY_COLORS.length];
            return {
              name: item.name,
              value: item.value,
              tradeCount: item.tradeCount,
              itemStyle: {
                color: baseColor,
                borderColor: isSelected ? '#fff' : '#1e1e1e',
                borderWidth: isSelected ? 3 : 2,
                shadowBlur: isSelected ? 10 : 0,
                shadowColor: isSelected ? baseColor : 'transparent',
              },
            };
          }),
        },
      ],
    };
  }, [counterpartyVolumes, selectedCounterparty]);

  // Build title based on context
  const title = filterContext
    ? `${filterContext.product} - ${new Date(filterContext.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'All Trades';

  const subtitle = filterContext
    ? 'By Counterparty'
    : 'Volume by Counterparty';

  if (counterpartyVolumes.length === 0) {
    return (
      <div className="donut-chart-container">
        <div className="donut-chart-header">
          <h3 className="donut-chart-title">{title}</h3>
          <span className="donut-chart-subtitle">{subtitle}</span>
        </div>
        <div className="chart-empty">
          <div className="empty-message">No data for selection</div>
        </div>
      </div>
    );
  }

  return (
    <div className="donut-chart-container">
      <div className="donut-chart-header">
        <h3 className="donut-chart-title">{title}</h3>
        <span className="donut-chart-subtitle">{subtitle}</span>
        <span className="donut-chart-total">
          Total: {formatVolume(totalVolume)}
        </span>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 'calc(100% - 60px)', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onEvents}
      />
    </div>
  );
}
