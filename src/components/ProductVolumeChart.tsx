import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { Trade } from '../types/trade';

interface ProductVolumeChartProps {
  trades: Trade[];
  onHover: (data: { date: string; product: string } | null) => void;
  onClick: (data: { date: string; product: string }) => void;
  selectedPoint: { date: string; product: string } | null;
  tradeCount: number;
  totalNotional: number;
}

// Product colors - Bloomberg-style blues and grays
const PRODUCT_COLORS: Record<string, string> = {
  'US Treasury': '#5B9BD5',           // Primary blue
  'Investment Grade Corp': '#2E75B6', // Darker blue
  'High Yield Corp': '#8FAADC',       // Light blue
  'Municipal': '#A6A6A6',             // Medium gray
  'Agency MBS': '#7C8A96',            // Blue-gray
};

const PRODUCTS = [
  'US Treasury',
  'Investment Grade Corp',
  'High Yield Corp',
  'Municipal',
  'Agency MBS',
];

interface DailyProductVolume {
  date: string;
  displayDate: string;
  volumes: Record<string, number>;
}

// Calculate daily volumes by product
function calculateDailyProductVolumes(trades: Trade[]): DailyProductVolume[] {
  const volumeByDateProduct = new Map<string, Record<string, number>>();

  // Initialize all dates with all products at 0
  trades.forEach(trade => {
    const date = trade.tradeDate;
    if (!volumeByDateProduct.has(date)) {
      volumeByDateProduct.set(date, {
        'US Treasury': 0,
        'Investment Grade Corp': 0,
        'High Yield Corp': 0,
        'Municipal': 0,
        'Agency MBS': 0,
      });
    }
    const dateVolumes = volumeByDateProduct.get(date)!;
    dateVolumes[trade.product] = (dateVolumes[trade.product] || 0) + trade.notionalUsd;
  });

  // Convert to array and sort by date
  const dailyData: DailyProductVolume[] = Array.from(volumeByDateProduct.entries())
    .map(([date, volumes]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      volumes,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return dailyData;
}

// Format large numbers for display
function formatVolume(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// Format large numbers for stats display
function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return `$${value.toLocaleString()}`;
}

export function ProductVolumeChart({
  trades,
  onHover,
  onClick,
  selectedPoint,
  tradeCount,
  totalNotional,
}: ProductVolumeChartProps) {
  const dailyVolumes = useMemo(() => calculateDailyProductVolumes(trades), [trades]);

  const handleChartEvents = useCallback(() => ({
    mouseover: (params: { seriesName?: string; name?: string; dataIndex?: number }) => {
      if (params.seriesName && params.dataIndex !== undefined) {
        const date = dailyVolumes[params.dataIndex]?.date;
        if (date) {
          onHover({ date, product: params.seriesName });
        }
      }
    },
    mouseout: () => {
      onHover(null);
    },
    click: (params: { seriesName?: string; dataIndex?: number }) => {
      if (params.seriesName && params.dataIndex !== undefined) {
        const date = dailyVolumes[params.dataIndex]?.date;
        if (date) {
          onClick({ date, product: params.seriesName });
        }
      }
    },
  }), [dailyVolumes, onHover, onClick]);

  const option = useMemo(() => {
    const dates = dailyVolumes.map(d => d.displayDate);

    // Create series for each product
    const series = PRODUCTS.map(product => ({
      name: product,
      type: 'line' as const,
      data: dailyVolumes.map(d => d.volumes[product] || 0),
      smooth: true,
      symbol: 'circle',
      symbolSize: (_value: number, params: { dataIndex: number }) => {
        // Highlight selected point
        const date = dailyVolumes[params.dataIndex]?.date;
        if (selectedPoint?.date === date && selectedPoint?.product === product) {
          return 12;
        }
        return 6;
      },
      lineStyle: {
        width: 2,
        color: PRODUCT_COLORS[product],
      },
      itemStyle: {
        color: PRODUCT_COLORS[product],
        borderWidth: (params: { dataIndex: number }) => {
          const date = dailyVolumes[params.dataIndex]?.date;
          if (selectedPoint?.date === date && selectedPoint?.product === product) {
            return 3;
          }
          return 0;
        },
        borderColor: '#fff',
      },
      emphasis: {
        scale: true,
        focus: 'series',
        itemStyle: {
          borderWidth: 2,
          borderColor: '#fff',
        },
      },
    }));

    return {
      backgroundColor: 'transparent',
      grid: {
        top: 20,
        right: 30,
        bottom: 90,
        left: 70,
        containLabel: false,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#2d2d2d',
        borderColor: '#3d3d3d',
        textStyle: {
          color: '#e0e0e0',
          fontSize: 12,
        },
        formatter: (params: { seriesName?: string; value?: number; dataIndex?: number }) => {
          if (!params.seriesName || params.value === undefined || params.dataIndex === undefined) {
            return '';
          }
          const day = dailyVolumes[params.dataIndex];
          if (!day) return '';

          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${day.date}</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: ${PRODUCT_COLORS[params.seriesName]}; border-radius: 50%;"></span>
              <span>${params.seriesName}</span>
            </div>
            <div style="font-size: 14px; font-weight: 600; color: ${PRODUCT_COLORS[params.seriesName]}; margin-top: 4px;">
              ${formatVolume(params.value)}
            </div>
            <div style="font-size: 11px; color: #a0a0a0; margin-top: 4px;">
              Click to filter trades
            </div>
          `;
        },
      },
      legend: {
        show: true,
        orient: 'horizontal',
        bottom: 5,
        left: 70,
        textStyle: {
          color: '#a0a0a0',
          fontSize: 10,
        },
        itemWidth: 14,
        itemHeight: 3,
        itemGap: 12,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: {
          lineStyle: {
            color: '#3d3d3d',
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Volume (USD)',
        nameTextStyle: {
          color: '#6b6b6b',
          fontSize: 11,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 11,
          formatter: (value: number) => formatVolume(value),
        },
        splitLine: {
          lineStyle: {
            color: '#2d2d2d',
            type: 'dashed',
          },
        },
      },
      series,
    };
  }, [dailyVolumes, selectedPoint]);

  const onEvents = useMemo(() => handleChartEvents(), [handleChartEvents]);

  if (dailyVolumes.length === 0) {
    return (
      <div className="product-chart-container chart-empty">
        <div className="empty-message">No trade data available</div>
      </div>
    );
  }

  return (
    <div className="product-chart-container">
      <div className="chart-stats-header">
        <div className="chart-stat">
          <span className="chart-stat-value">{tradeCount.toLocaleString()}</span>
          <span className="chart-stat-label">Trades</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-value">{formatLargeNumber(totalNotional)}</span>
          <span className="chart-stat-label">Total Volume</span>
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 'calc(100% - 32px)', width: '100%' }}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
