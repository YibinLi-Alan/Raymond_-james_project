import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ControlBar } from './components/ControlBar';
import { DockviewLayout, DockviewLayoutHandle } from './components/DockviewLayout';
import { PanelsDropdown } from './components/PanelsDropdown';
import { ColumnsButton } from './components/ColumnsButton';
import { BClassFilter } from './components/BClassSunburstChart';
import { mockDatabase } from './data/relationalMockData';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { fetchTrades, fetchAnomalies } from './api/client';
import { getIntradayDataForTrade } from './data/evalPriceGenerator';
import { Trade, IntradayData } from './types/trade';
import { useBlotterStore } from './store/useBlotterStore';
import { exportToExcel, exportAIDataToExcel } from './utils/excelExport';

// Chart interaction state
interface ChartSelection {
  date: string;
  product: string;
}

function App() {
  // Store must be destructured first — dependency arrays in useEffects below
  // reference these values synchronously during render (temporal dead zone fix).
  const {
    quickFilterText,
    setQuickFilterText,
    resetToDefaults,
    selectedTradeId: storeSelectedTradeId,
    setSelectedTradeId,
    aiQueryResult,
    setAnomalyState,
    setAnomalyLoading,
  } = useBlotterStore();

  // Clear saved layout on first load to ensure 2x2 grid is applied
  useEffect(() => {
    localStorage.removeItem('dockview-layout');
  }, []);

  // Trades: from SQLite API when available, otherwise mock (fallback)
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [dataSource, setDataSource] = useState<'sqlite' | 'mock'>('mock');

  useEffect(() => {
    fetchTrades()
      .then((data) => {
        setTrades(data);
        setDataSource('sqlite');
        // Fetch anomalies in parallel — a failure must not affect the dashboard
        setAnomalyLoading(true);
        fetchAnomalies()
          .then((result) => {
            setAnomalyState({
              sizeAnomalyIds: result.sizeAnomalies.map((a) => a.tradeId),
              sizeAnomalyDetails: result.sizeAnomalies,
              frequencyAnomalies: result.frequencyAnomalies,
              dayPercentile: result.dayPercentile,
              lastComputedAt: result.computedAt,
            });
          })
          .catch((err) => {
            console.warn('[Anomaly] fetch failed, continuing without anomaly data:', err);
          })
          .finally(() => {
            setAnomalyLoading(false);
          });
      })
      .catch(() => {
        setTrades(mockDatabase.getAllTradesJoined());
        setDataSource('mock');
      });
  }, [setAnomalyLoading, setAnomalyState]);

  // Trade source for context: API-backed list or in-memory db
  const db = useMemo(() => {
    if (dataSource === 'sqlite' && trades !== null) {
      return { getAllTradesJoined: (): Trade[] => trades };
    }
    return mockDatabase;
  }, [dataSource, trades]);

  const allTrades = useMemo(() => db.getAllTradesJoined(), [db]);

  const [layoutHandle, setLayoutHandle] = useState<DockviewLayoutHandle | null>(null);

  // Hover state for chart sync
  const [hoverContext, setHoverContext] = useState<ChartSelection | null>(null);

  // Click state for grid filtering
  const [selectedPoint, setSelectedPoint] = useState<ChartSelection | null>(null);

  // BCLASS filter (from sunburst chart)
  const [bclassFilter, setBclassFilter] = useState<BClassFilter | null>(null);

  // Intraday chart data (derived from selected trade in store)
  const [intradayData, setIntradayData] = useState<IntradayData | null>(null);

  // Filter trades based on selected chart point and BCLASS filter
  const filteredTrades = useMemo(() => {
    let result = allTrades;

    // Apply chart point filter (product + date)
    if (selectedPoint) {
      result = result.filter(
        trade => trade.tradeDate === selectedPoint.date && trade.product === selectedPoint.product
      );
    }

    // Apply BCLASS filter from sunburst chart
    if (bclassFilter) {
      if (bclassFilter.level1) {
        result = result.filter(trade => trade.bclassLevel1 === bclassFilter.level1);
      }
      if (bclassFilter.level2) {
        result = result.filter(trade => trade.bclassLevel2 === bclassFilter.level2);
      }
      if (bclassFilter.level3) {
        result = result.filter(trade => trade.bclassLevel3 === bclassFilter.level3);
      }
    }

    return result;
  }, [allTrades, selectedPoint, bclassFilter]);

  // When AI returns trade-like data, all panels use it (including empty []); otherwise use filteredTrades
  const displayTrades = useMemo(() => {
    if (aiQueryResult?.trades != null && Array.isArray(aiQueryResult.trades)) {
      return aiQueryResult.trades as Trade[];
    }
    return Array.isArray(filteredTrades) ? filteredTrades : [];
  }, [aiQueryResult?.trades, filteredTrades]);

  // Summary stats and counts from the data actually shown across all panels
  const { tradeCount, totalNotional } = useMemo(() => {
    const trades = Array.isArray(displayTrades) ? displayTrades : [];
    return {
      tradeCount: trades.length,
      totalNotional: trades.reduce((sum, trade) => sum + (trade?.notionalUsd ?? 0), 0),
    };
  }, [displayTrades]);

  // Handlers
  const handleQuickFilterChange = useCallback((text: string) => {
    setQuickFilterText(text);
  }, [setQuickFilterText]);

  const handleRefresh = useCallback(() => {
    if (dataSource === 'sqlite') {
      fetchTrades()
        .then(setTrades)
        .catch(() => {
          setTrades(mockDatabase.getAllTradesJoined());
          setDataSource('mock');
        });
    } else {
      window.location.reload();
    }
  }, [dataSource]);

  const handleExport = useCallback(async () => {
    try {
      const hasAIData = aiQueryResult?.data != null && Array.isArray(aiQueryResult.data) && aiQueryResult.data.length > 0;
      if (hasAIData) {
        await exportAIDataToExcel(aiQueryResult.data as Record<string, unknown>[]);
      } else {
        await exportToExcel(allTrades);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [aiQueryResult?.data, allTrades]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    setSelectedPoint(null);
    setHoverContext(null);
    setBclassFilter(null);
    setIntradayData(null);
    setSelectedTradeId(null);
  }, [resetToDefaults, setSelectedTradeId]);

  // Chart interaction handlers
  const handleChartHover = useCallback((data: ChartSelection | null) => {
    setHoverContext(data);
  }, []);

  const handleChartClick = useCallback((data: ChartSelection) => {
    // Toggle selection: if same point clicked, deselect
    if (selectedPoint?.date === data.date && selectedPoint?.product === data.product) {
      setSelectedPoint(null);
    } else {
      setSelectedPoint(data);
    }
  }, [selectedPoint]);

  // BCLASS click handler from sunburst chart
  const handleBclassClick = useCallback((filter: BClassFilter) => {
    // Check if filter is empty (clear) or toggle if same filter clicked
    const isEmpty = !filter.level1 && !filter.level2 && !filter.level3;
    if (isEmpty) {
      setBclassFilter(null);
    } else {
      // Check if same filter - toggle off
      const isSame = bclassFilter &&
        bclassFilter.level1 === filter.level1 &&
        bclassFilter.level2 === filter.level2 &&
        bclassFilter.level3 === filter.level3;

      if (isSame) {
        setBclassFilter(null);
      } else {
        setBclassFilter(filter);
      }
    }
  }, [bclassFilter]);

  // Clear selection handler
  const handleClearSelection = useCallback(() => {
    setSelectedPoint(null);
    setBclassFilter(null);
  }, []);

  // Trade double-click handler for intraday chart (fallback, main path is via Zustand)
  const handleTradeDoubleClick = useCallback((trade: Trade) => {
    setSelectedTradeId(trade.internalTradeId);
  }, [setSelectedTradeId]);

  // React to store selectedTradeId: compute intraday data for charts
  useEffect(() => {
    if (storeSelectedTradeId) {
      const trade =
        allTrades.find((t: Trade) => t.internalTradeId === storeSelectedTradeId) ??
        displayTrades.find((t: Trade) => t.internalTradeId === storeSelectedTradeId);
      if (trade) {
        setIntradayData(getIntradayDataForTrade(trade, allTrades));
      } else {
        setIntradayData(null);
      }
    } else {
      setIntradayData(null);
    }
  }, [storeSelectedTradeId, displayTrades, allTrades]);

  // Auto-select first trade once on initial load (use length to avoid array-ref dependency loop)
  const hasAutoSelected = useRef(false);
  const displayCount = displayTrades.length;
  useEffect(() => {
    if (hasAutoSelected.current || displayCount === 0 || storeSelectedTradeId) return;
    hasAutoSelected.current = true;
    setSelectedTradeId(displayTrades[0].internalTradeId);
  }, [displayCount, storeSelectedTradeId, setSelectedTradeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const omnibar = document.querySelector('.omnibar-input') as HTMLInputElement;
        omnibar?.focus();
      }
      if (e.key === 'Escape') {
        setQuickFilterText('');
        setSelectedPoint(null);
        setBclassFilter(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setQuickFilterText]);

  return (
    <DatabaseProvider db={db}>
      <div className="app">
        <ControlBar
        onQuickFilterChange={handleQuickFilterChange}
        onRefresh={handleRefresh}
        onExport={handleExport}
        onReset={handleReset}
        panelsButton={<PanelsDropdown layoutHandle={layoutHandle} />}
        columnsButton={<ColumnsButton />}
        selectedPoint={selectedPoint}
        bclassFilter={bclassFilter}
        onClearSelection={handleClearSelection}
      />

      {/* Dockview Layout: displayTrades drives all panels when AI returns data */}
      <DockviewLayout
        trades={allTrades}
        filteredTrades={filteredTrades}
        displayTrades={displayTrades}
        isAIResult={aiQueryResult?.trades != null}
        quickFilterText={quickFilterText}
        tradeCount={tradeCount}
        totalNotional={totalNotional}
        hoverContext={hoverContext}
        selectedPoint={selectedPoint}
        bclassFilter={bclassFilter}
        intradayData={intradayData}
        selectedTradeId={storeSelectedTradeId ?? null}
        onChartHover={handleChartHover}
        onChartClick={handleChartClick}
        onBclassClick={handleBclassClick}
        onTradeDoubleClick={handleTradeDoubleClick}
        onApiReady={setLayoutHandle}
      />
      </div>
    </DatabaseProvider>
  );
}

export default App;
