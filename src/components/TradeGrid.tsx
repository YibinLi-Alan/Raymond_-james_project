import { useMemo, useCallback, useRef, useState, useEffect, memo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ValueFormatterParams,
  GridReadyEvent,
  GridApi,
  CellKeyDownEvent,
  RowClassParams,
  IFilterComp,
  IFilterParams,
  IDoesFilterPassParams,
  RowDoubleClickedEvent,
  ITooltipParams,
} from 'ag-grid-community';
import { Trade } from '../types/trade';
import { ColumnToolPanel } from './ColumnToolPanel';
import { useBlotterStore } from '../store/useBlotterStore';
import type { SizeAnomaly } from '../api/client';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface TradeGridProps {
  trades: Trade[];
  quickFilterText?: string;
  selectedTradeId?: string | null;
  onRowDoubleClick?: (trade: Trade) => void;
}

// Format currency with appropriate precision
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Format price as percentage
function formatPrice(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  return value.toFixed(4);
}

// Format yield as percentage
function formatYield(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  return `${value.toFixed(3)}%`;
}

// Format date for display
function formatDate(value: string | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format timestamp for display
function formatTimestamp(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Custom Set Filter Component for AG Grid
class CustomSetFilter implements IFilterComp {
  private params!: IFilterParams;
  private gui!: HTMLDivElement;
  private selectedValues: Set<string> = new Set();
  private allValues: string[] = [];
  private filterActive = false;

  init(params: IFilterParams): void {
    this.params = params;
    this.gui = document.createElement('div');
    this.gui.className = 'custom-set-filter';

    // Get unique values
    this.allValues = [];
    params.api.forEachNode((node) => {
      if (node.data && params.colDef.field) {
        const value = node.data[params.colDef.field as keyof typeof node.data];
        if (value !== undefined && value !== null) {
          const strValue = String(value);
          if (!this.allValues.includes(strValue)) {
            this.allValues.push(strValue);
          }
        }
      }
    });
    this.allValues.sort();

    // Initially select all
    this.selectedValues = new Set(this.allValues);

    this.renderGui();
  }

  private renderGui(): void {
    this.gui.innerHTML = `
      <div class="set-filter">
        <div class="set-filter-header">
          <input type="text" class="set-filter-search" placeholder="Search...">
        </div>
        <div class="set-filter-actions">
          <button class="set-filter-btn select-all">Select All</button>
          <button class="set-filter-btn clear-all">Clear</button>
        </div>
        <div class="set-filter-list">
          ${this.allValues.map(value => `
            <label class="set-filter-item">
              <input type="checkbox" value="${value}" ${this.selectedValues.has(value) ? 'checked' : ''}>
              <span class="set-filter-label">${value}</span>
            </label>
          `).join('')}
        </div>
        <div class="set-filter-footer">
          <button class="set-filter-btn set-filter-apply">Apply</button>
        </div>
      </div>
    `;

    // Add event listeners
    const searchInput = this.gui.querySelector('.set-filter-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const search = (e.target as HTMLInputElement).value.toLowerCase();
      const items = this.gui.querySelectorAll('.set-filter-item');
      items.forEach((item) => {
        const label = item.querySelector('.set-filter-label')?.textContent?.toLowerCase() || '';
        (item as HTMLElement).style.display = label.includes(search) ? 'flex' : 'none';
      });
    });

    this.gui.querySelector('.select-all')?.addEventListener('click', () => {
      this.selectedValues = new Set(this.allValues);
      this.gui.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        (cb as HTMLInputElement).checked = true;
      });
    });

    this.gui.querySelector('.clear-all')?.addEventListener('click', () => {
      this.selectedValues.clear();
      this.gui.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        (cb as HTMLInputElement).checked = false;
      });
    });

    this.gui.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const checkbox = e.target as HTMLInputElement;
        if (checkbox.checked) {
          this.selectedValues.add(checkbox.value);
        } else {
          this.selectedValues.delete(checkbox.value);
        }
      });
    });

    this.gui.querySelector('.set-filter-apply')?.addEventListener('click', () => {
      this.filterActive = this.selectedValues.size < this.allValues.length;
      this.params.filterChangedCallback();
    });
  }

  getGui(): HTMLElement {
    return this.gui;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.filterActive) return true;
    const field = this.params.colDef.field;
    if (!field) return true;
    const value = String(params.data[field as keyof typeof params.data] ?? '');
    return this.selectedValues.has(value);
  }

  isFilterActive(): boolean {
    return this.filterActive;
  }

  getModel(): string[] | null {
    if (!this.filterActive) return null;
    return Array.from(this.selectedValues);
  }

  setModel(model: string[] | null): void {
    if (model === null) {
      this.selectedValues = new Set(this.allValues);
      this.filterActive = false;
    } else {
      this.selectedValues = new Set(model);
      this.filterActive = true;
    }
    this.renderGui();
  }

  destroy(): void {
    // Cleanup if needed
  }
}

const EMPTY_STRING_ARRAY: readonly string[] = [];

function TradeGridInner({ trades, quickFilterText, selectedTradeId, onRowDoubleClick }: TradeGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const tradesRef = useRef<Trade[]>([]);
  tradesRef.current = trades;

  const setSelectedTradeId = useBlotterStore((state) => state.setSelectedTradeId);
  const openPanel = useBlotterStore((state) => state.openPanel);
  const anomalyTradeIds = useBlotterStore((s) => s.aiQueryResult?.anomalyTradeIds) ?? EMPTY_STRING_ARRAY;

  const handleRowDoubleClick = useCallback((event: RowDoubleClickedEvent<Trade>) => {
    if (event.data) {
      setSelectedTradeId(event.data.internalTradeId);
      openPanel('intradayChart');
      onRowDoubleClick?.(event.data);
    }
  }, [setSelectedTradeId, openPanel, onRowDoubleClick]);

  const sizeAnomalyIds = useBlotterStore((s) => s.sizeAnomalyIds);
  const sizeAnomalyDetails = useBlotterStore((s) => s.sizeAnomalyDetails);
  // Set for O(1) row-class checks; Map for tooltip lookups — both keyed by tradeId
  const sizeAnomalyIdSet = useMemo(() => new Set(sizeAnomalyIds), [sizeAnomalyIds]);
  const sizeAnomalyMap = useMemo(
    () => new Map<string, SizeAnomaly>(sizeAnomalyDetails.map((a) => [a.tradeId, a])),
    [sizeAnomalyDetails]
  );

  // Row class rules: selected row | AI anomaly (red) | size anomaly (amber)
  const rowClassRules = useMemo(
    () => ({
      'selected-trade-row': (params: RowClassParams<Trade>) =>
        params.data?.internalTradeId === selectedTradeId,
      'anomaly-trade-row': (params: RowClassParams<Trade>) =>
        !!params.data?.internalTradeId && anomalyTradeIds.includes(params.data.internalTradeId),
      'size-anomaly-row': (params: RowClassParams<Trade>) =>
        !!params.data?.internalTradeId && sizeAnomalyIdSet.has(params.data.internalTradeId),
    }),
    [selectedTradeId, anomalyTradeIds, sizeAnomalyIdSet]
  );

  // Default visible columns: Trade Id, Side, Cusip, Ticker, Notional, Price, Yield, Counterparty
  const columnDefs = useMemo<ColDef<Trade>[]>(() => [
    // Visible by default (in order)
    {
      field: 'internalTradeId',
      headerName: 'Trade ID',
      width: 160,
      pinned: 'left',
      filter: CustomSetFilter,
    },
    {
      field: 'side',
      headerName: 'Side',
      width: 80,
      cellClass: (params) => params.value === 'BUY' ? 'cell-buy' : 'cell-sell',
      filter: CustomSetFilter,
    },
    {
      field: 'cusip',
      headerName: 'CUSIP',
      width: 100,
      filter: CustomSetFilter,
    },
    {
      field: 'ticker',
      headerName: 'Ticker',
      width: 80,
      filter: CustomSetFilter,
    },
    {
      field: 'notionalUsd',
      headerName: 'Notional',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value),
      filter: 'agNumberColumnFilter',
    },
    {
      field: 'cleanPrice',
      headerName: 'Price',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => formatPrice(params.value),
    },
    {
      field: 'yield',
      headerName: 'Yield',
      width: 90,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => formatYield(params.value),
    },
    {
      field: 'counterpartyName',
      headerName: 'Counterparty',
      width: 180,
      filter: CustomSetFilter,
    },
    // Hidden by default
    {
      field: 'tradeDate',
      headerName: 'Trade Date',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => formatDate(params.value),
      filter: 'agDateColumnFilter',
      hide: true,
    },
    {
      field: 'executionTimestamp',
      headerName: 'Time',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => formatTimestamp(params.value),
      hide: true,
    },
    {
      field: 'product',
      headerName: 'Product',
      width: 150,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'tenor',
      headerName: 'Tenor',
      width: 80,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'coupon',
      headerName: 'Coupon',
      width: 80,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.value === undefined || params.value === null) return '';
        return `${params.value.toFixed(3)}%`;
      },
      hide: true,
    },
    {
      field: 'sector',
      headerName: 'Sector',
      width: 140,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'bclassLevel1',
      headerName: 'Asset Class',
      width: 110,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'bclassLevel2',
      headerName: 'Asset Group',
      width: 130,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'bclassLevel3',
      headerName: 'Asset Sector',
      width: 140,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'bclassLevel4',
      headerName: 'Asset Sub-Sector',
      width: 150,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'deskId',
      headerName: 'Desk',
      width: 140,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'traderId',
      headerName: 'Trader',
      width: 100,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'settlementDate',
      headerName: 'Settle Date',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => formatDate(params.value),
      hide: true,
    },
    {
      field: 'tradeCurrency',
      headerName: 'Currency',
      width: 90,
      filter: CustomSetFilter,
      hide: true,
    },
    {
      field: 'venueExecutionId',
      headerName: 'Venue ID',
      width: 140,
      hide: true,
    },
    {
      field: 'accruedInterestAmount',
      headerName: 'Accrued Interest',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value),
      hide: true,
    },
    {
      field: 'grossTradeAmount',
      headerName: 'Gross Amount',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value),
      hide: true,
    },
    {
      field: 'netMoney',
      headerName: 'Net Money',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value),
      hide: true,
    },
  ], []);

  const defaultColDef = useMemo<ColDef<Trade>>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: false,
    suppressHeaderMenuButton: true,
    tooltipValueGetter: (params: ITooltipParams<Trade>) => {
      const tradeId = params.data?.internalTradeId;
      if (!tradeId) return undefined;
      const anomaly = sizeAnomalyMap.get(tradeId);
      if (!anomaly) return undefined;
      const notional = formatCurrency(anomaly.notionalUsd);
      const mean = formatCurrency(anomaly.cpMeanNotionalUsd);
      const z = Math.abs(anomaly.zScore).toFixed(1);
      const dir = anomaly.direction === 'HIGH' ? 'above' : 'below';
      return `⚠ Size anomaly: ${notional} is ${z}σ ${dir} ${anomaly.counterpartyName}'s mean (${mean})`;
    },
  }), [sizeAnomalyMap]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    const data = Array.isArray(tradesRef.current) ? tradesRef.current : [];
    params.api.setGridOption('rowData', data);
  }, []);

  // Keep grid in sync when trades prop changes (e.g. AI query result → displayTrades)
  useEffect(() => {
    const api = gridRef.current?.api ?? gridApiRef.current;
    if (api) {
      try {
        const data = Array.isArray(trades) ? trades : [];
        api.setGridOption('rowData', data);
      } catch (_) {
        // Guard against grid not ready or API transition
      }
    }
  }, [trades]);

  // Handle keyboard shortcuts on cells
  const onCellKeyDown = useCallback((event: CellKeyDownEvent) => {
    const keyEvent = event.event as KeyboardEvent;

    // Ctrl+C to copy cell value
    if (keyEvent.ctrlKey && keyEvent.key === 'c') {
      const cellValue = event.value;
      if (cellValue !== undefined && cellValue !== null) {
        const textValue = String(cellValue);
        navigator.clipboard.writeText(textValue).then(() => {
          setCopiedText(textValue);
        });
      }
    }
  }, []);

  // Listen for external column panel toggle event
  useEffect(() => {
    const handleOpenColumnPanel = () => {
      setIsColumnPanelOpen(true);
    };
    window.addEventListener('open-column-panel', handleOpenColumnPanel);
    return () => window.removeEventListener('open-column-panel', handleOpenColumnPanel);
  }, []);

  // Handle keyboard shortcuts at the grid level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + C to open column panel
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setIsColumnPanelOpen((prev) => !prev);
      }

      // Ctrl + Shift + L to open filter for focused column
      if (e.ctrlKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (gridApiRef.current) {
          // Get the focused cell
          const focusedCell = gridApiRef.current.getFocusedCell();
          if (focusedCell) {
            const colId = focusedCell.column.getColId();
            // Use AG Grid's API to show column menu/filter
            // In AG Grid v30+, showColumnMenu is available
            const api = gridApiRef.current as GridApi & {
              showColumnMenu?: (colKey: string) => void;
              showColumnMenuAfterButtonClick?: (colKey: string, button: HTMLElement) => void;
            };

            if (typeof api.showColumnMenu === 'function') {
              api.showColumnMenu(colId);
            } else {
              // Fallback: find the header cell and trigger a double-click to show floating filter
              // or right-click for context menu
              const headerCell = document.querySelector(
                `.ag-header-cell[col-id="${colId}"]`
              ) as HTMLElement;
              if (headerCell) {
                // Create a fake button element at the header position
                const rect = headerCell.getBoundingClientRect();
                const fakeButton = document.createElement('div');
                fakeButton.style.position = 'fixed';
                fakeButton.style.left = `${rect.left}px`;
                fakeButton.style.top = `${rect.bottom}px`;
                document.body.appendChild(fakeButton);

                if (typeof api.showColumnMenuAfterButtonClick === 'function') {
                  api.showColumnMenuAfterButtonClick(colId, fakeButton);
                }

                document.body.removeChild(fakeButton);
              }
            }
          }
        }
      }

      // Ctrl + V to paste into search bar
      if (e.ctrlKey && e.key === 'v') {
        const activeElement = document.activeElement;
        const isInSearchBar = activeElement?.classList.contains('omnibar-input');

        // If not already in search bar and we have copied text, focus and paste
        if (!isInSearchBar && copiedText) {
          const searchBar = document.querySelector('.omnibar-input') as HTMLInputElement;
          if (searchBar) {
            e.preventDefault();
            searchBar.focus();
            // Paste will happen naturally from clipboard
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copiedText]);

  const handleColumnPanelClose = useCallback(() => {
    setIsColumnPanelOpen(false);
  }, []);

  return (
    <div className="trade-grid-wrapper">
      {sizeAnomalyIds.length > 0 && (
        <div className="insights-anomaly-legend">
          🟡 Amber rows indicate statistical size anomalies (trades more than 2σ from counterparty mean)
        </div>
      )}
      <div className="trade-grid-container ag-theme-alpine-dark">
        <AgGridReact<Trade>
          ref={gridRef}
          rowData={trades}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onCellKeyDown={onCellKeyDown}
          onRowDoubleClicked={handleRowDoubleClick}
          quickFilterText={quickFilterText}
          animateRows={true}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          enableCellTextSelection={true}
          pagination={false}
          domLayout="normal"
          rowHeight={32}
          headerHeight={36}
          getRowId={(params) => params.data?.internalTradeId ?? 'row-missing-id'}
          rowClassRules={rowClassRules}
          tooltipShowDelay={0}
          tooltipHideDelay={5000}
        />
      </div>

      <ColumnToolPanel
        gridApi={gridApiRef.current}
        isOpen={isColumnPanelOpen}
        onClose={handleColumnPanelClose}
      />
    </div>
  );
}

export const TradeGrid = memo(TradeGridInner);
