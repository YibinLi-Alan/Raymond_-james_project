import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { useBlotterStore } from '../store/useBlotterStore';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

/**
 * AI Data Table: shows raw query result (any columns) from AI Data Query.
 * Use for aggregate/summary results (e.g. average price by trader, total notional by product).
 * Trade Blotter continues to show trade-shaped results; this panel shows the rest.
 */
export function AIDataTablePanel() {
  const aiQueryResult = useBlotterStore((s) => s.aiQueryResult);

  const { rowData, columnDefs } = useMemo(() => {
    const data = aiQueryResult?.data ?? [];
    if (!Array.isArray(data) || data.length === 0) {
      return { rowData: [], columnDefs: [] as ColDef[] };
    }
    const keys = new Set<string>();
    data.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));
    const columns = Array.from(keys);
    const columnDefs: ColDef[] = columns.map((field) => ({
      field,
      headerName: field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      flex: 1,
      minWidth: 100,
      sortable: true,
      resizable: true,
      valueFormatter: (params) => {
        const v = params.value;
        if (v == null) return '';
        if (typeof v === 'number') {
          if (Number.isInteger(v)) return String(v);
          return v.toFixed(4);
        }
        return String(v);
      },
    }));
    return { rowData: data as Record<string, unknown>[], columnDefs };
  }, [aiQueryResult?.data]);

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
          AI Data Table ({rowData.length} row{rowData.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="ag-theme-alpine-dark ai-data-table-grid">
        <AgGridReact<Record<string, unknown>>
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(params) => `ai-row-${params.rowIndex}`}
          domLayout="normal"
          rowHeight={32}
          headerHeight={36}
          animateRows
          suppressRowClickSelection
        />
      </div>
    </div>
  );
}
