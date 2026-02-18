import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Trade } from '../types/trade';
import { useBlotterStore } from '../store/useBlotterStore';

interface ADVChartProps {
  trades: Trade[];
  onDateClick?: (date: string) => void;
}

interface DailyVolume {
  date: string;
  displayDate: string;
  volume: number;
  tradeCount: number;
  avgVolume?: number;
}

// Calculate daily volumes and ADV from trades
function calculateDailyVolumes(trades: Trade[]): DailyVolume[] {
  // Group trades by date
  const volumeByDate = new Map<string, { volume: number; count: number }>();

  trades.forEach(trade => {
    const date = trade.tradeDate;
    const existing = volumeByDate.get(date) || { volume: 0, count: 0 };
    volumeByDate.set(date, {
      volume: existing.volume + trade.notionalUsd,
      count: existing.count + 1,
    });
  });

  // Convert to array and sort by date
  const dailyData: DailyVolume[] = Array.from(volumeByDate.entries())
    .map(([date, data]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      volume: data.volume,
      tradeCount: data.count,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate moving average (ADV)
  const windowSize = Math.min(5, dailyData.length); // 5-day MA or less if not enough data
  dailyData.forEach((day, index) => {
    if (index >= windowSize - 1) {
      let sum = 0;
      for (let i = index - windowSize + 1; i <= index; i++) {
        sum += dailyData[i].volume;
      }
      day.avgVolume = sum / windowSize;
    }
  });

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
  return `$${(value / 1_000).toFixed(0)}K`;
}

export function ADVChart({ trades, onDateClick }: ADVChartProps) {
  const { chartDateFilter, toggleChartDateFilter } = useBlotterStore();

  const dailyVolumes = useMemo(() => calculateDailyVolumes(trades), [trades]);

  // Calculate statistics for display
  const stats = useMemo(() => {
    if (dailyVolumes.length === 0) return null;
    const totalVolume = dailyVolumes.reduce((sum, d) => sum + d.volume, 0);
    const avgDailyVolume = totalVolume / dailyVolumes.length;
    const totalTrades = dailyVolumes.reduce((sum, d) => sum + d.tradeCount, 0);
    return { totalVolume, avgDailyVolume, totalTrades };
  }, [dailyVolumes]);

  const handleChartClick = useCallback((params: { name?: string; dataIndex?: number }) => {
    if (params.dataIndex !== undefined && dailyVolumes[params.dataIndex]) {
      const clickedDate = dailyVolumes[params.dataIndex].date;
      toggleChartDateFilter(clickedDate);
      onDateClick?.(clickedDate);
    }
  }, [dailyVolumes, toggleChartDateFilter, onDateClick]);

  const option = useMemo<EChartsOption>(() => {
    const dates = dailyVolumes.map(d => d.displayDate);
    const volumes = dailyVolumes.map(d => d.volume);
    const avgVolumes = dailyVolumes.map(d => d.avgVolume ?? null);

    // Highlight selected bar
    const selectedIndex = chartDateFilter?.active
      ? dailyVolumes.findIndex(d => d.date === chartDateFilter.date)
      : -1;

    const barColors = dailyVolumes.map((d, index) => {
      if (index === selectedIndex) {
        return '#4dabf7'; // Highlighted
      }
      // Color based on comparison to ADV
      if (d.avgVolume && d.volume > d.avgVolume * 1.5) {
        return '#00897B'; // High volume - teal
      }
      if (d.avgVolume && d.volume < d.avgVolume * 0.5) {
        return '#6b6b6b'; // Low volume - muted
      }
      return '#3d8bfd'; // Normal - blue
    });

    return {
      backgroundColor: 'transparent',
      grid: {
        top: 40,
        right: 60,
        bottom: 40,
        left: 70,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#2d2d2d',
        borderColor: '#3d3d3d',
        textStyle: {
          color: '#e0e0e0',
          fontSize: 12,
        },
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: 'rgba(77, 171, 247, 0.1)',
          },
        },
        formatter: (params: unknown) => {
          const data = params as Array<{ dataIndex: number; value: number; seriesName: string }>;
          if (!data || data.length === 0) return '';
          const dataIndex = data[0].dataIndex;
          const day = dailyVolumes[dataIndex];
          if (!day) return '';

          let html = `<div style="font-weight: 600; margin-bottom: 4px;">${day.date}</div>`;
          html += `<div>Volume: <span style="color: #4dabf7; font-weight: 600;">${formatVolume(day.volume)}</span></div>`;
          html += `<div>Trades: <span style="font-weight: 600;">${day.tradeCount}</span></div>`;
          if (day.avgVolume) {
            const pctDiff = ((day.volume - day.avgVolume) / day.avgVolume * 100).toFixed(0);
            const sign = Number(pctDiff) >= 0 ? '+' : '';
            const color = Number(pctDiff) >= 0 ? '#00897B' : '#F57C00';
            html += `<div>vs ADV: <span style="color: ${color}; font-weight: 600;">${sign}${pctDiff}%</span></div>`;
          }
          return html;
        },
      },
      legend: {
        show: true,
        top: 5,
        right: 10,
        textStyle: {
          color: '#a0a0a0',
          fontSize: 11,
        },
        itemWidth: 12,
        itemHeight: 8,
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
        name: 'Volume',
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
      series: [
        {
          name: 'Daily Volume',
          type: 'bar',
          data: volumes,
          barWidth: '60%',
          itemStyle: {
            color: (params: { dataIndex: number }) => barColors[params.dataIndex],
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: '#4dabf7',
            },
          },
        },
        {
          name: 'ADV (5-day)',
          type: 'line',
          data: avgVolumes,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#F57C00',
            width: 2,
            type: 'dashed',
          },
        },
      ],
    };
  }, [dailyVolumes, chartDateFilter]);

  const onEvents = useMemo(() => ({
    click: handleChartClick,
  }), [handleChartClick]);

  if (dailyVolumes.length === 0) {
    return (
      <div className="adv-chart-container adv-chart-empty">
        <div className="empty-message">No trade data available for chart</div>
      </div>
    );
  }

  return (
    <div className="adv-chart-container">
      <div className="chart-header">
        <h3 className="chart-title">Daily Volume vs ADV</h3>
        {stats && (
          <div className="chart-stats">
            <span className="chart-stat">
              Total: <strong>{formatVolume(stats.totalVolume)}</strong>
            </span>
            <span className="chart-stat">
              ADV: <strong>{formatVolume(stats.avgDailyVolume)}</strong>
            </span>
            <span className="chart-stat">
              Trades: <strong>{stats.totalTrades.toLocaleString()}</strong>
            </span>
          </div>
        )}
      </div>
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
      {chartDateFilter?.active && (
        <div className="chart-filter-indicator">
          Filtering: {chartDateFilter.date}
          <button
            className="chart-filter-clear"
            onClick={() => toggleChartDateFilter(chartDateFilter.date)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
