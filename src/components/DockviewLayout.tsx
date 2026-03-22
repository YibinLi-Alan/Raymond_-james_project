import { useCallback, useRef, useEffect, useState } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';
import { Trade, IntradayData } from '../types/trade';
import { InsightsPanel } from './InsightsPanel';
import { BClassSunburstChart, BClassFilter } from './BClassSunburstChart';
import { BClassTreemapChart } from './BClassTreemapChart';
import { TradeGrid } from './TradeGrid';
import { IntradayPriceChart } from './IntradayPriceChart';
import { YieldCurveScatterPanel } from './YieldCurveScatterPanel';
import { AIAssistant } from './AIAssistant';
import { AIDataTablePanel } from './AIDataTablePanel';
import { AIGraphPanel } from './AIGraphPanel';

const ALL_PANEL_IDS = [
  'insights',
  'sunburstChart',
  'treemapChart',
  'grid',
  'intradayChart',
  'yieldCurve',
  'aiAssistant',
  'aiDataTable',
  'aiGraphPanel',
] as const;
type PanelId = (typeof ALL_PANEL_IDS)[number];

interface PanelDefinition {
  id: string;
  title: string;
  component: string;
}

export interface DockviewLayoutHandle {
  getPanelDefinitions: () => PanelDefinition[];
  getClosedPanels: () => string[];
  isPanelOpen: (panelId: string) => boolean;
  restorePanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  resetLayout: () => void;
  canOpenMore: () => boolean;
}

const PANEL_DEFINITIONS: PanelDefinition[] = [
  { id: 'insights', title: 'Daily Insights', component: 'insights' },
  { id: 'sunburstChart', title: 'Asset Class Breakdown', component: 'sunburstChart' },
  { id: 'treemapChart', title: 'Asset Class Treemap', component: 'treemapChart' },
  { id: 'grid', title: 'Trade Blotter', component: 'grid' },
  { id: 'intradayChart', title: 'Intraday Price', component: 'intradayChart' },
  { id: 'yieldCurve', title: 'Yield Curve', component: 'yieldCurve' },
  { id: 'aiAssistant', title: 'AI Assistant', component: 'aiAssistant' },
  { id: 'aiDataTable', title: 'AI Data Table', component: 'aiDataTable' },
  { id: 'aiGraphPanel', title: 'AI Graph', component: 'aiGraphPanel' },
];

interface DockviewLayoutProps {
  trades: Trade[];
  filteredTrades: Trade[];
  displayTrades: Trade[];
  isAIResult?: boolean;
  quickFilterText: string;
  tradeCount: number;
  totalNotional: number;
  hoverContext: { date: string; product: string } | null;
  selectedPoint: { date: string; product: string } | null;
  bclassFilter: BClassFilter | null;
  intradayData: IntradayData | null;
  selectedTradeId: string | null;
  onChartHover: (data: { date: string; product: string } | null) => void;
  onChartClick: (data: { date: string; product: string }) => void;
  onBclassClick: (filter: BClassFilter) => void;
  onTradeDoubleClick: (trade: Trade) => void;
  onApiReady?: (handle: DockviewLayoutHandle) => void;
}

export function DockviewLayout({
  trades: _trades,
  filteredTrades: _filteredTrades,
  displayTrades,
  isAIResult = false,
  quickFilterText,
  tradeCount,
  totalNotional,
  hoverContext: _hoverContext,
  selectedPoint: _selectedPoint,
  bclassFilter,
  intradayData,
  selectedTradeId,
  onChartHover: _onChartHover,
  onChartClick: _onChartClick,
  onBclassClick,
  onTradeDoubleClick,
  onApiReady,
}: DockviewLayoutProps) {
  const apiRef = useRef<DockviewLayoutHandle | null>(null);
  const aiChartOption = useBlotterStore((s) => s.aiChartOption);
  const visiblePanelIds = useBlotterStore((s) => s.visiblePanelIds);
  const activeChartPanel = useBlotterStore((s) => s.activeChartPanel);
  const openPanel = useBlotterStore((s) => s.openPanel);
  const closePanel = useBlotterStore((s) => s.closePanel);
  const resetLayout = useBlotterStore((s) => s.resetLayout);

  const getPanelParams = useCallback(
    (panelId: string) => {
      switch (panelId) {
        case 'insights':
          return { trades: displayTrades, tradeCount, totalNotional };
        case 'sunburstChart':
        case 'treemapChart':
          return { trades: displayTrades, selectedFilter: bclassFilter, onSegmentClick: onBclassClick };
        case 'grid':
          return {
            trades: displayTrades,
            quickFilterText,
            selectedTradeId,
            onRowDoubleClick: onTradeDoubleClick,
          };
        case 'intradayChart':
          return { intradayData, selectedTradeId, aiChartOption: aiChartOption ?? null };
        case 'yieldCurve':
          return { trades: displayTrades };
        case 'aiAssistant':
          return {};
        default:
          return {};
      }
    },
    [
      displayTrades,
      quickFilterText,
      tradeCount,
      totalNotional,
      bclassFilter,
      intradayData,
      selectedTradeId,
      onBclassClick,
      onTradeDoubleClick,
      aiChartOption,
    ]
  );

  const handleRestorePanel = useCallback(
    (panelId: string) => openPanel(panelId),
    [openPanel]
  );
  const handleClosePanel = useCallback(
    (panelId: string) => closePanel(panelId),
    [closePanel]
  );
  const handleResetLayout = useCallback(() => resetLayout(), [resetLayout]);

  const isPanelOpen = useCallback(
    (panelId: string) => visiblePanelIds.includes(panelId),
    [visiblePanelIds]
  );

  const getClosedPanels = useCallback(() => {
    return PANEL_DEFINITIONS.filter((def) => !visiblePanelIds.includes(def.id)).map(
      (d) => d.id
    );
  }, [visiblePanelIds]);

  const canOpenMore = useCallback(
    () => visiblePanelIds.length < 4,
    [visiblePanelIds]
  );

  apiRef.current = {
    getPanelDefinitions: () => PANEL_DEFINITIONS,
    getClosedPanels,
    isPanelOpen,
    restorePanel: handleRestorePanel,
    closePanel: handleClosePanel,
    resetLayout: handleResetLayout,
    canOpenMore,
  };

  useEffect(() => {
    onApiReady?.(apiRef.current!);
  }, [
    onApiReady,
    visiblePanelIds,
    handleRestorePanel,
    handleClosePanel,
    handleResetLayout,
    getClosedPanels,
    isPanelOpen,
    canOpenMore,
  ]);

  const renderPanelContent = (panelId: PanelId) => {
    const params = getPanelParams(panelId) as Record<string, unknown>;
    switch (panelId) {
      case 'insights':
        return (
          <InsightsPanel
            trades={params.trades as Trade[]}
            tradeCount={params.tradeCount as number}
            totalNotional={params.totalNotional as number}
          />
        );
      case 'sunburstChart':
        return (
          <BClassSunburstChart
            trades={params.trades as Trade[]}
            selectedFilter={params.selectedFilter as BClassFilter | null}
            onSegmentClick={params.onSegmentClick as (f: BClassFilter) => void}
          />
        );
      case 'treemapChart':
        return (
          <BClassTreemapChart
            trades={params.trades as Trade[]}
            selectedFilter={params.selectedFilter as BClassFilter | null}
            onSegmentClick={params.onSegmentClick as (f: BClassFilter) => void}
          />
        );
      case 'grid':
        return (
          <TradeGrid
            trades={params.trades as Trade[]}
            quickFilterText={params.quickFilterText as string}
            selectedTradeId={params.selectedTradeId as string | null}
            onRowDoubleClick={params.onRowDoubleClick as (t: Trade) => void}
          />
        );
      case 'intradayChart':
        return (
          <IntradayPriceChart
            intradayData={params.intradayData as IntradayData | null}
            selectedTradeId={params.selectedTradeId as string | null}
            aiChartOption={params.aiChartOption as Record<string, unknown> | null}
          />
        );
      case 'yieldCurve':
        return <YieldCurveScatterPanel trades={params.trades as Trade[]} />;
      case 'aiAssistant':
        return <AIAssistant />;
      case 'aiDataTable':
        return <AIDataTablePanel />;
      case 'aiGraphPanel':
        return <AIGraphPanel />;
      default:
        return null;
    }
  };

  const showAiDataTable = visiblePanelIds.includes('aiDataTable');
  const showInsights = visiblePanelIds.includes('insights');
  const showGrid = visiblePanelIds.includes('grid');
  const hasChartOverlay = activeChartPanel && visiblePanelIds.includes(activeChartPanel);
  const showMiddleContent = showAiDataTable || showGrid;

  // Resizable left slot width (25% default, user can drag sash)
  const [leftWidthPercent, setLeftWidthPercent] = useState(25);
  const sashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sash = sashRef.current;
    if (!sash) return;
    let startX = 0;
    let startWidth = 0;
    const onMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = leftWidthPercent;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const container = sash.closest('.dockview-wrapper');
      if (!container) return;
      const totalW = container.getBoundingClientRect().width;
      const deltaPercent = (dx / totalW) * 100;
      let next = startWidth + deltaPercent;
      next = Math.max(15, Math.min(45, next));
      setLeftWidthPercent(next);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    sash.addEventListener('mousedown', onMouseDown);
    return () => {
      sash.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [leftWidthPercent]);

  return (
    <div className="dockview-wrapper dashboard-4col-layout">
      {/* Left slot (1/4 default): AI Assistant - fixed, full height, resizable via sash */}
      <div
        className="dashboard-left-slot"
        style={{ width: `${leftWidthPercent}%` }}
      >
        <div className="dockview-panel-content slot-panel">
          <AIAssistant />
        </div>
      </div>
      {/* Resize sash between left and right area */}
      <div className="dashboard-sash" ref={sashRef} title="Drag to resize" />
      {/* Right area (3/4): Data Table, Daily Insight, or Chart overlay */}
      <div className="dashboard-right-area">
        {hasChartOverlay ? (
          /* Chart overlay: replaces middle + right slots */
          <div className="dashboard-chart-overlay">
            <div className="dockview-panel-content slot-panel">
              {renderPanelContent(activeChartPanel as PanelId)}
            </div>
          </div>
        ) : (
          /* Base layout: AI Data Table (2/4) or Trade Blotter (covers Data Table) + Daily Insight (1/4) with reflow */
          <>
            {showMiddleContent && (
              <div
                className="dashboard-middle-slot"
                style={{ flex: showInsights ? 2 : 1 }}
              >
                <div className="dockview-panel-content slot-panel">
                  {showGrid ? (
                    renderPanelContent('grid')
                  ) : showAiDataTable ? (
                    <AIDataTablePanel />
                  ) : null}
                </div>
              </div>
            )}
            {showInsights && (
              <div
                className="dashboard-right-slot"
                style={{ flex: showMiddleContent ? 1 : 1 }}
              >
                <div className="dockview-panel-content slot-panel">
                  <InsightsPanel
                    trades={displayTrades}
                    tradeCount={tradeCount}
                    totalNotional={totalNotional}
                  />
                </div>
              </div>
            )}
            {!showMiddleContent && !showInsights && (
              <div className="dashboard-empty-slot">
                <span>Empty slot</span>
                <span className="slot-empty-hint">Open a panel from Panels menu</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
