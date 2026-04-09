import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';
import { Trade, IntradayData } from '../types/trade';
import { BClassFilter } from './BClassSunburstChart';
import { InsightsPanel } from './InsightsPanel';
import { AIAssistant } from './AIAssistant';
import { AIDataTablePanel } from './AIDataTablePanel';
import { PanelContent, type PanelId, type PanelParams } from './PanelContent';

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
  'anomalies',
] as const;

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
  /** True if this panel can be opened (considers grid/aiDataTable mutual replacement) */
  canOpenPanel: (panelId: string) => boolean;
}

const DEFAULT_PANELS_FALLBACK: readonly string[] = ['aiAssistant', 'aiDataTable', 'insights'];

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
  { id: 'anomalies', title: 'Anomalies', component: 'anomalies' },
];

interface DockviewLayoutProps {
  trades: Trade[];
  filteredTrades: Trade[];
  displayTrades: Trade[];
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
  onApiReady?: (handle: DockviewLayoutHandle | null) => void;
}

export function DockviewLayout({
  trades: allTrades,
  filteredTrades: _filteredTrades,
  displayTrades,
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
  const rawVisiblePanelIds = useBlotterStore((s) => s.visiblePanelIds);
  // Safeguard: use stable fallback to avoid new-array-every-render causing effect loops
  const visiblePanelIds = Array.isArray(rawVisiblePanelIds) && rawVisiblePanelIds.length > 0
    ? rawVisiblePanelIds
    : DEFAULT_PANELS_FALLBACK;
  const activeChartPanel = useBlotterStore((s) => s.activeChartPanel);
  const openPanel = useBlotterStore((s) => s.openPanel);
  const closePanel = useBlotterStore((s) => s.closePanel);
  const resetLayout = useBlotterStore((s) => s.resetLayout);

  const gridParams = useMemo(
    () => ({
      trades: allTrades,
      quickFilterText,
      selectedTradeId,
      onRowDoubleClick: onTradeDoubleClick,
    }),
    [allTrades, quickFilterText, selectedTradeId, onTradeDoubleClick]
  );

  const getPanelParams = useCallback(
    (panelId: string) => {
      switch (panelId) {
        case 'insights':
          return { trades: displayTrades, tradeCount, totalNotional };
        case 'sunburstChart':
        case 'treemapChart':
          return { trades: displayTrades, selectedFilter: bclassFilter, onSegmentClick: onBclassClick };
        case 'grid':
          return gridParams;
        case 'intradayChart':
          return { intradayData, selectedTradeId, aiChartOption: aiChartOption ?? null };
        case 'yieldCurve':
          return { trades: displayTrades };
        case 'aiAssistant':
          return {};
        case 'anomalies':
          return { trades: displayTrades };
        default:
          return {};
      }
    },
    [
      gridParams,
      displayTrades,
      tradeCount,
      totalNotional,
      bclassFilter,
      intradayData,
      onBclassClick,
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

  const canOpenPanel = useCallback(
    (panelId: string) => {
      if (visiblePanelIds.includes(panelId)) return true; // Already open
      if (panelId === 'aiAssistant') return false; // Always "open", can't re-open
      if (visiblePanelIds.length < 4) return true;
      // At max: can open grid/aiDataTable by replacing the other
      if (panelId === 'grid' && visiblePanelIds.includes('aiDataTable')) return true;
      if (panelId === 'aiDataTable' && visiblePanelIds.includes('grid')) return true;
      return false;
    },
    [visiblePanelIds]
  );

  // Mutate in place so parent keeps same reference and always has latest callbacks (avoids setState loop)
  if (!apiRef.current) {
    apiRef.current = {
      getPanelDefinitions: () => PANEL_DEFINITIONS,
      getClosedPanels: () => [],
      isPanelOpen: () => false,
      restorePanel: () => {},
      closePanel: () => {},
      resetLayout: () => {},
      canOpenMore: () => true,
      canOpenPanel: () => true,
    };
  }
  apiRef.current.getPanelDefinitions = () => PANEL_DEFINITIONS;
  apiRef.current.getClosedPanels = getClosedPanels;
  apiRef.current.isPanelOpen = isPanelOpen;
  apiRef.current.restorePanel = handleRestorePanel;
  apiRef.current.closePanel = handleClosePanel;
  apiRef.current.resetLayout = handleResetLayout;
  apiRef.current.canOpenMore = canOpenMore;
  apiRef.current.canOpenPanel = canOpenPanel;

  useEffect(() => {
    onApiReady?.(apiRef.current!);
    return () => onApiReady?.(null);
  }, [onApiReady]);

  const renderPanelContent = useCallback(
    (panelId: PanelId) => {
      const params = getPanelParams(panelId) as PanelParams;
      return <PanelContent panelId={panelId} params={params} />;
    },
    [getPanelParams]
  );

  const showAiDataTable = visiblePanelIds.includes('aiDataTable');
  const showInsights = visiblePanelIds.includes('insights');
  const showGrid = visiblePanelIds.includes('grid');
  const showAnomalies = visiblePanelIds.includes('anomalies');
  const CHART_IDS = ['aiGraphPanel', 'sunburstChart', 'treemapChart', 'intradayChart', 'yieldCurve'];
  // Only show chart overlay when activeChartPanel is valid and still in layout
  const hasChartOverlay = Boolean(
    activeChartPanel &&
    visiblePanelIds.includes(activeChartPanel) &&
    CHART_IDS.includes(activeChartPanel)
  );
  const showMiddleContent = showAiDataTable || showGrid || showAnomalies;

  // Resizable left slot width (25% default, user can drag sash)
  const [leftWidthPercent, setLeftWidthPercent] = useState(25);
  const sashRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(25);
  widthRef.current = leftWidthPercent;

  useEffect(() => {
    const sash = sashRef.current;
    if (!sash) return;
    const onMouseDown = (e: MouseEvent) => {
      const startX = e.clientX;
      const startWidth = widthRef.current;
      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const container = sash.closest('.dockview-wrapper');
        if (!container) return;
        const totalW = container.getBoundingClientRect().width;
        const deltaPercent = (dx / totalW) * 100;
        const next = Math.max(15, Math.min(45, startWidth + deltaPercent));
        setLeftWidthPercent(next);
        widthRef.current = next;
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
    sash.addEventListener('mousedown', onMouseDown);
    return () => sash.removeEventListener('mousedown', onMouseDown);
  }, []);

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
                  ) : showAnomalies ? (
                    renderPanelContent('anomalies')
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
                    trades={Array.isArray(displayTrades) ? displayTrades : []}
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
