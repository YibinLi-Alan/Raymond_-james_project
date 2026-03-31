import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import ReactECharts from 'echarts-for-react';
import { useBlotterStore } from '../store/useBlotterStore';
import { enhanceChartOption } from '../utils/chartEnhancement';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

function formatCellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }
  return String(value);
}

function orderColumns(columns: string[]): string[] {
  const priority = [
    'trade_count',
    'total_notional_usd',
    'total_volume',
    'ticker',
    'issuer_name',
    'product',
    'sector',
    'trader_name',
    'counterparty_name',
    'trade_date',
  ];
  const prioritySet = new Set(priority);
  const prioritized = priority.filter((field) => columns.includes(field));
  const remaining = columns.filter((field) => !prioritySet.has(field));
  return [...prioritized, ...remaining];
}

/**
 * AI Data Table: shows raw query result (any columns) from AI Data Query.
 * Use for aggregate/summary results (e.g. average price by trader, total notional by product).
 * Trade Blotter continues to show trade-shaped results; this panel shows the rest.
 */
export function AIDataTablePanel() {
  const aiQueryResult = useBlotterStore((s) => s.aiQueryResult);
  const aiChartOption = useBlotterStore((s) => s.aiChartOption);
  const [showVisualization, setShowVisualization] = useState(true);

  const { rowData, columnDefs, highlightCards, chartOption } = useMemo(() => {
    const data = aiQueryResult?.data ?? [];
    const enhancedChartOption =
      aiChartOption && typeof aiChartOption === 'object'
        ? enhanceChartOption(aiChartOption as Record<string, unknown>)
        : null;
    if (!Array.isArray(data) || data.length === 0) {
      return {
        rowData: [],
        columnDefs: [] as ColDef[],
        highlightCards: [] as Array<{ label: string; value: string }>,
        chartOption: enhancedChartOption,
      };
    }
    const keys = new Set<string>();
    data.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));
    const columns = orderColumns(Array.from(keys));
    const numericColumns = columns.filter((field) => typeof data[0]?.[field] === 'number');
    const columnDefs: ColDef[] = columns.map((field) => ({
      field,
      headerName: field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      flex: 1,
      minWidth: 100,
      sortable: true,
      resizable: true,
      valueFormatter: (params) => formatCellValue(params.value),
      cellStyle: { textAlign: 'center' },
      headerClass: 'ai-data-table-header-cell',
      cellClass: typeof data[0]?.[field] === 'number' ? 'ai-data-table-cell-numeric' : undefined,
    }));
    const firstRow = data[0] as Record<string, unknown>;
    const topMetric = numericColumns[0];
    const topDriverValue =
      firstRow.trader_name ??
      firstRow.trader_id ??
      firstRow.counterparty_name ??
      firstRow.ticker ??
      firstRow.issuer_name ??
      columns.find((field) => typeof firstRow?.[field] !== 'number')
        ?.toString();
    const highlightCards = [
      topDriverValue ? { label: 'Top Driver', value: `${topDriverValue}` } : null,
      typeof firstRow.total_notional_usd !== 'undefined'
        ? { label: 'Total Notional USD', value: formatCellValue(firstRow.total_notional_usd) }
        : null,
      topMetric && typeof firstRow.total_notional_usd === 'undefined'
        ? { label: topMetric.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: formatCellValue(firstRow[topMetric]) }
        : null,
      { label: 'Total Trades', value: String(data.length) },
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    return {
      rowData: data as Record<string, unknown>[],
      columnDefs,
      highlightCards,
      chartOption: enhancedChartOption,
    };
  }, [aiQueryResult?.data, aiChartOption]);

  useEffect(() => {
    setShowVisualization(Boolean(chartOption));
  }, [chartOption, aiQueryResult?.sql]);

  if (!aiQueryResult) {
    return (
      <div className="ai-data-table-panel ai-data-table-empty">
        <p>Run a Data Query in AI Assistant to see results here.</p>
        <p className="ai-data-table-hint">
          Summary or aggregate questions (e.g. &quot;average price by trader&quot;, &quot;total notional by product&quot;) show in this table. Trade-listing questions still drive the Trade Blotter.
        </p>
      </div>
    );
  }

  if (rowData.length === 0 && !aiQueryResult.error) {
    return (
      <div className="ai-data-table-panel ai-data-table-empty">
        <p>No rows returned.</p>
        {aiQueryResult.sql && (
          <pre className="ai-data-table-sql">{aiQueryResult.sql}</pre>
        )}
      </div>
    );
  }

  if (aiQueryResult.error) {
    return (
      <div className="ai-data-table-panel ai-data-table-empty">
        <p className="ai-data-table-error">Query failed: {aiQueryResult.error}</p>
        {aiQueryResult.sql && (
          <pre className="ai-data-table-sql">{aiQueryResult.sql}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="ai-data-table-panel">
      <div className="ai-data-table-header">
        <span className="ai-data-table-title">
          AI Data Table (Total Trades: {rowData.length})
        </span>
        {chartOption ? (
          <button
            type="button"
            className="ai-data-table-scroll-btn"
            onClick={() => setShowVisualization((prev) => !prev)}
          >
            {showVisualization ? 'View Table' : 'View Graph'}
          </button>
        ) : null}
      </div>
      {(!chartOption || !showVisualization) && highlightCards.length > 0 && (
        <div className="ai-data-table-highlights">
          {highlightCards.map((card) => (
            <div key={card.label} className="ai-data-table-highlight-card">
              <span className="ai-data-table-highlight-label">{card.label}</span>
              <span className="ai-data-table-highlight-value">{card.value}</span>
            </div>
          ))}
        </div>
      )}
      {chartOption && showVisualization ? (
        <div className="ai-data-table-chart-card">
          <div className="ai-data-table-chart-header">
            <span className="ai-data-table-chart-title">Visualization</span>
          </div>
          <div className="ai-data-table-chart-body">
            <ReactECharts
              className="ai-data-table-chart-instance"
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              autoResize
              lazyUpdate={false}
              notMerge
            />
          </div>
        </div>
      ) : null}
      {(!chartOption || !showVisualization) ? (
        <div className="ag-theme-alpine-dark ai-data-table-grid">
          <AgGridReact<Record<string, unknown>>
            rowData={rowData}
            columnDefs={columnDefs}
            getRowId={(params) => `ai-row-${JSON.stringify(params.data)}`}
            getRowClass={(params) => {
              const rowIndex = params.node.rowIndex ?? -1;
              if (rowIndex === 0) return 'ai-data-table-row-top';
              if (rowIndex > 0 && rowIndex < 3) return 'ai-data-table-row-secondary';
              return '';
            }}
            domLayout="normal"
            rowHeight={32}
            headerHeight={36}
            animateRows
            suppressRowClickSelection
            suppressHorizontalScroll={false}
            defaultColDef={{ headerClass: 'ai-data-table-header-cell' }}
          />
        </div>
      ) : null}
    </div>
  );
}
