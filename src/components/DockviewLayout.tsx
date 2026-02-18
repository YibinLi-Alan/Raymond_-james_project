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

const MAX_PANELS = 4;
const ALL_PANEL_IDS = [
  'insights',
  'sunburstChart',
  'treemapChart',
  'grid',
  'intradayChart',
  'yieldCurve',
  'aiAssistant',
  'aiDataTable',
] as const;
type PanelId = (typeof ALL_PANEL_IDS)[number];

interface ChartSelection {
  date: string;
  product: string;
}

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
];

interface DockviewLayoutProps {
  trades: Trade[];
  filteredTrades: Trade[];
  /** When AI returns data, all panels use this; otherwise same as filteredTrades */
  displayTrades: Trade[];
  /** True when displayTrades is from AI query result (so grid/sunburst/insights follow AI result) */
  isAIResult?: boolean;
  quickFilterText: string;
  tradeCount: number;
  totalNotional: number;
  hoverContext: ChartSelection | null;
  selectedPoint: ChartSelection | null;
  bclassFilter: BClassFilter | null;
  intradayData: IntradayData | null;
  selectedTradeId: string | null;
  onChartHover: (data: ChartSelection | null) => void;
  onChartClick: (data: ChartSelection) => void;
  onBclassClick: (filter: BClassFilter) => void;
  onTradeDoubleClick: (trade: Trade) => void;
  onApiReady?: (handle: DockviewLayoutHandle) => void;
}

const DEFAULT_SLOTS: (PanelId | null)[] = [
  'insights',
  'sunburstChart',
  'grid',
  'intradayChart',
];

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
  const [slots, setSlots] = useState<(PanelId | null)[]>(() => DEFAULT_SLOTS);
  const apiRef = useRef<DockviewLayoutHandle | null>(null);
  const aiChartOption = useBlotterStore((s) => s.aiChartOption);

  // All panels use displayTrades (AI result when set, otherwise filtered) so charts and grid stay in sync
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

  const openCount = slots.filter(Boolean).length;

  const handleRestorePanel = useCallback((panelId: string) => {
    setSlots((prev) => {
      if (prev.some((s) => s === panelId)) return prev;
      if (prev.every(Boolean)) return prev; // max 4, cannot add
      const next = [...prev];
      const idx = next.findIndex((s) => s === null);
      if (idx >= 0) next[idx] = panelId as PanelId;
      return next;
    });
  }, []);

  const handleClosePanel = useCallback((panelId: string) => {
    setSlots((prev) => {
      const idx = prev.indexOf(panelId as PanelId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }, []);

  const handleResetLayout = useCallback(() => {
    setSlots([...DEFAULT_SLOTS]);
  }, []);

  const isPanelOpen = useCallback(
    (panelId: string) => slots.some((s) => s === panelId),
    [slots]
  );

  const getClosedPanels = useCallback(() => {
    return PANEL_DEFINITIONS.filter((def) => !slots.some((s) => s === def.id)).map((d) => d.id);
  }, [slots]);

  const canOpenMore = useCallback(() => openCount < MAX_PANELS, [openCount]);

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
  }, [onApiReady, slots, handleRestorePanel, handleClosePanel, handleResetLayout, getClosedPanels, isPanelOpen, canOpenMore]);

  const renderSlotContent = (panelId: PanelId) => {
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
      default:
        return null;
    }
  };

  return (
    <div className="dockview-wrapper slot-layout">
      <div className="slot-grid-container">
        {slots.map((panelId, index) => (
          <div key={index} className="slot-cell">
            {panelId ? (
              <div className="dockview-panel-content slot-panel">
                {renderSlotContent(panelId)}
              </div>
            ) : (
              <div className="slot-empty">
                <span>Empty slot</span>
                <span className="slot-empty-hint">Open a panel from Panels menu</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
