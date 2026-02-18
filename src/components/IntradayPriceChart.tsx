import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { IntradayData } from '../types/trade';

interface IntradayPriceChartProps {
  intradayData: IntradayData | null;
  selectedTradeId: string | null;
  /** When set (e.g. from AI Data Query), this chart replaces the intraday view in the top-right panel */
  aiChartOption?: Record<string, unknown> | null;
}

// Format price for display
function formatPrice(value: number): string {
  return value.toFixed(4);
}

// Format time for axis labels
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Format date for header
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function IntradayPriceChart({
  intradayData,
  selectedTradeId,
  aiChartOption,
}: IntradayPriceChartProps) {
  console.log('[IntradayPriceChart] Rendering with:', {
    hasData: !!intradayData,
    cusip: intradayData?.cusip,
    selectedTradeId
  });

  const option = useMemo(() => {
    if (!intradayData || intradayData.evalPrices.length === 0) {
      return null;
    }

    const { evalPrices, trades } = intradayData;

    // Extract time labels and price values
    const timeLabels = evalPrices.map(ep => formatTime(ep.timestamp));
    const priceData = evalPrices.map(ep => ep.price);

    // Calculate Y-axis range with some padding
    const minPrice = Math.min(...priceData);
    const maxPrice = Math.max(...priceData);
    const priceRange = maxPrice - minPrice;
    const yAxisMin = minPrice - priceRange * 0.1;
    const yAxisMax = maxPrice + priceRange * 0.1;

    // Helper to find the closest eval price index for a given trade time
    const findClosestEvalIndex = (tradeTimestamp: string): number => {
      const tradeTime = new Date(tradeTimestamp).getTime();
      let closestIdx = 0;
      let closestDiff = Infinity;

      evalPrices.forEach((ep, idx) => {
        const evalTime = new Date(ep.timestamp).getTime();
        const diff = Math.abs(evalTime - tradeTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = idx;
        }
      });

      return closestIdx;
    };

    // Filter trades to only include those with valid data
    const validTrades = trades.filter(trade =>
      trade.executionTimestamp &&
      trade.executionPrice != null &&
      !isNaN(trade.executionPrice)
    );

    // Build mark lines for trade executions (L-shaped: vertical to price, then horizontal left)
    // Using array-of-two-coords format: [[{coord: [x1,y1]}, {coord: [x2,y2]}], ...]
    const markLines: Array<[object, object]> = [];
    validTrades.forEach(trade => {
      const closestIdx = findClosestEvalIndex(trade.executionTimestamp);
      if (closestIdx < 0 || closestIdx >= evalPrices.length) return; // Skip invalid indices

      const isSelected = trade.tradeId === selectedTradeId;
      // Use --accent-buy green for selected, muted for others
      const color = isSelected ? '#00897B' : '#6b6b6b';
      const lineStyle = {
        color,
        type: 'dashed' as const,
        width: isSelected ? 2 : 1,
      };

      // Vertical line from top to execution price
      markLines.push([
        { coord: [closestIdx, yAxisMax] },
        {
          coord: [closestIdx, trade.executionPrice],
          lineStyle,
          label: {
            show: true,
            formatter: `${trade.side} @ ${formatPrice(trade.executionPrice)}`,
            position: 'start' as const,
            color,
            fontSize: 10,
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            padding: [2, 4],
            borderRadius: 2,
          },
        },
      ]);

      // Horizontal line from execution price to left edge
      markLines.push([
        { coord: [closestIdx, trade.executionPrice], lineStyle },
        { coord: [0, trade.executionPrice] },
      ]);
    });

    // Build mark points for trade execution prices (diamond markers)
    const markPoints = validTrades
      .map(trade => {
        const closestIdx = findClosestEvalIndex(trade.executionTimestamp);
        if (closestIdx < 0 || closestIdx >= evalPrices.length) return null; // Skip invalid indices

        const isSelected = trade.tradeId === selectedTradeId;
        // Use --accent-buy green for selected, muted for others
        const color = isSelected ? '#00897B' : '#6b6b6b';

        return {
          coord: [closestIdx, trade.executionPrice],
          symbol: 'diamond',
          symbolSize: isSelected ? 16 : 10,
          itemStyle: {
            color,
            borderColor: '#fff',
            borderWidth: isSelected ? 2 : 1,
          },
          label: {
            show: false, // Price shown in markLine label
          },
        };
      })
      .filter(Boolean);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#2d2d2d',
        borderColor: '#3d3d3d',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        formatter: (params: { dataIndex: number; value: number }[]) => {
          if (!params || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const evalPrice = evalPrices[idx];
          const time = formatTime(evalPrice.timestamp);
          const price = formatPrice(evalPrice.price);

          // Check if any trades executed at this time (within 15 min window)
          const evalTime = new Date(evalPrice.timestamp).getTime();
          const tradesAtTime = validTrades.filter(t => {
            const tradeTime = new Date(t.executionTimestamp).getTime();
            return !isNaN(tradeTime) && Math.abs(tradeTime - evalTime) < 15 * 60 * 1000;
          });

          let html = `<div style="font-weight: 600;">${time}</div>`;
          html += `<div>Eval Price: <span style="color: #5B9BD5; font-weight: 600;">${price}</span></div>`;

          if (tradesAtTime.length > 0) {
            html += '<div style="margin-top: 4px; border-top: 1px solid #3d3d3d; padding-top: 4px;">';
            tradesAtTime.forEach(t => {
              const isSelected = t.tradeId === selectedTradeId;
              const color = isSelected ? '#4dabf7' : '#a0a0a0';
              html += `<div style="color: ${color};">${t.side} @ ${formatPrice(t.executionPrice)}</div>`;
            });
            html += '</div>';
          }

          return html;
        },
      },
      grid: {
        top: 30,
        right: 50,
        bottom: 40,
        left: 60,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: timeLabels,
        axisLine: { lineStyle: { color: '#3d3d3d' } },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 10,
          interval: 3, // Show every hour (4 intervals = 1 hour)
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: yAxisMin,
        max: yAxisMax,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#2d2d2d', type: 'dashed' } },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 10,
          formatter: (value: number) => formatPrice(value),
        },
      },
      series: [
        {
          type: 'line',
          data: priceData,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#5B9BD5',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(91, 155, 213, 0.3)' },
                { offset: 1, color: 'rgba(91, 155, 213, 0)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: markLines,
          },
          markPoint: {
            data: markPoints,
          },
        },
      ],
    };
  }, [intradayData, selectedTradeId]);

  // AI-suggested chart overlay (replaces intraday when set)
  if (aiChartOption && Object.keys(aiChartOption).length > 0) {
    return (
      <div className="intraday-chart-container ai-chart-overlay">
        <div className="intraday-chart-header">
          <div className="intraday-chart-title">
            <h3>AI Query Result</h3>
            <div className="intraday-chart-subtitle">Chart from Data Query</div>
          </div>
        </div>
        <ReactECharts
          option={aiChartOption as import('echarts').EChartsOption}
          style={{ height: 'calc(100% - 50px)', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    );
  }

  // Empty state
  if (!intradayData) {
    return (
      <div className="intraday-chart-container">
        <div className="intraday-chart-empty">
          <div className="intraday-chart-empty-icon">📈</div>
          <div className="intraday-chart-empty-text">
            Double-click a trade row to view intraday pricing
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="intraday-chart-container">
      <div className="intraday-chart-header">
        <div className="intraday-chart-title">
          <h3>Intraday Eval Prices</h3>
          <div className="intraday-chart-subtitle">
            {intradayData.cusip} • {intradayData.ticker} • {formatDate(intradayData.tradeDate)}
          </div>
        </div>
        <div className="intraday-chart-stats">
          <span className="intraday-trade-count">
            {intradayData.trades.length} trade{intradayData.trades.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {option && (
        <ReactECharts
          option={option}
          style={{ height: 'calc(100% - 50px)', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      )}
    </div>
  );
}
