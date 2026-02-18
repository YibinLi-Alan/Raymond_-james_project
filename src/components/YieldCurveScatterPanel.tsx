import { useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Trade } from '../types/trade';

interface YieldCurveScatterPanelProps {
  trades: Trade[];
}

// Color palette for asset classes
const ASSET_CLASS_COLORS: Record<string, string> = {
  'Rates': '#4dabf7',
  'Credit': '#69db7c',
  'Securitized': '#ffd43b',
  'Municipal': '#da77f2',
  'Emerging Markets': '#ff8787',
};

const DEFAULT_COLOR = '#868e96';

export function YieldCurveScatterPanel({ trades }: YieldCurveScatterPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Prepare scatter data grouped by asset class
  const scatterData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Group trades by asset class
    const grouped: Record<string, { x: number; y: number; trade: Trade }[]> = {};

    trades.forEach((trade) => {
      if (trade.timeToMaturityYears && trade.yield) {
        const assetClass = trade.bclassLevel1 || 'Other';
        if (!grouped[assetClass]) {
          grouped[assetClass] = [];
        }
        grouped[assetClass].push({
          x: trade.timeToMaturityYears,
          y: trade.yield,
          trade,
        });
      }
    });

    return Object.entries(grouped).map(([assetClass, points]) => ({
      name: assetClass,
      type: 'scatter' as const,
      data: points.map((p) => ({
        value: [p.x, p.y],
        trade: p.trade,
      })),
      symbolSize: 8,
      itemStyle: {
        color: ASSET_CLASS_COLORS[assetClass] || DEFAULT_COLOR,
        opacity: 0.7,
      },
      emphasis: {
        itemStyle: {
          opacity: 1,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    }));
  }, [trades]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { data: { value: number[]; trade: Trade } };
          const trade = p.data?.trade;
          if (!trade) return '';
          return `
            <div style="font-size: 12px;">
              <strong>${trade.ticker}</strong> (${trade.cusip})<br/>
              <span style="color: ${trade.side === 'BUY' ? '#69db7c' : '#ff8787'}">
                ${trade.side}
              </span> ${trade.bclassLevel1}<br/>
              Yield: <strong>${trade.yield?.toFixed(3) ?? 'N/A'}%</strong><br/>
              Time to Maturity: <strong>${trade.timeToMaturityYears.toFixed(1)} yrs</strong><br/>
              Notional: $${(trade.notionalUsd / 1_000_000).toFixed(1)}M
            </div>
          `;
        },
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        textStyle: { color: '#e0e0e0' },
      },
      legend: {
        show: true,
        bottom: 10,
        left: 'center',
        textStyle: { color: '#a0a0a0', fontSize: 11 },
        itemGap: 15,
      },
      grid: {
        left: 60,
        right: 20,
        top: 40,
        bottom: 60,
      },
      xAxis: {
        type: 'value',
        name: 'Time to Maturity (Years)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: '#a0a0a0',
          fontSize: 12,
        },
        min: 0,
        max: 35,
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 11,
          formatter: '{value}Y',
        },
        axisLine: { lineStyle: { color: '#444' } },
        splitLine: {
          lineStyle: { color: '#2d2d2d', type: 'dashed' },
        },
      },
      yAxis: {
        type: 'value',
        name: 'Yield (%)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          color: '#a0a0a0',
          fontSize: 12,
        },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 11,
          formatter: '{value}%',
        },
        axisLine: { lineStyle: { color: '#444' } },
        splitLine: {
          lineStyle: { color: '#2d2d2d', type: 'dashed' },
        },
      },
      series: scatterData,
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [scatterData]);

  // Handle container resize
  useEffect(() => {
    const timer = setTimeout(() => {
      chartInstance.current?.resize();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!trades || trades.length === 0) {
    return (
      <div className="yield-curve-container">
        <div className="yield-curve-empty">
          <div className="yield-curve-empty-icon">📈</div>
          <div className="yield-curve-empty-text">No trade data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="yield-curve-container">
      <div className="yield-curve-header">
        <h3>Yield Curve Distribution</h3>
        <span className="yield-curve-subtitle">
          {trades.length.toLocaleString()} trades plotted
        </span>
      </div>
      <div ref={chartRef} className="yield-curve-chart" />
    </div>
  );
}
