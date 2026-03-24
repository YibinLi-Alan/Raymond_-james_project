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

export type PanelId =
  | 'insights'
  | 'sunburstChart'
  | 'treemapChart'
  | 'grid'
  | 'intradayChart'
  | 'yieldCurve'
  | 'aiAssistant'
  | 'aiDataTable'
  | 'aiGraphPanel';

export interface PanelParams {
  trades?: Trade[];
  tradeCount?: number;
  totalNotional?: number;
  selectedFilter?: BClassFilter | null;
  onSegmentClick?: (f: BClassFilter) => void;
  quickFilterText?: string;
  selectedTradeId?: string | null;
  onRowDoubleClick?: (t: Trade) => void;
  intradayData?: IntradayData | null;
  aiChartOption?: Record<string, unknown> | null;
}

interface PanelContentProps {
  panelId: PanelId;
  params: PanelParams;
}

/** Renders panel content by id - flat mapping, no nested switch. */
export function PanelContent({ panelId, params }: PanelContentProps) {
  const trades = Array.isArray(params.trades) ? params.trades : [];
  switch (panelId) {
    case 'insights':
      return (
        <InsightsPanel
          trades={trades}
          tradeCount={Number(params.tradeCount) || 0}
          totalNotional={Number(params.totalNotional) || 0}
        />
      );
    case 'sunburstChart':
      return (
        <BClassSunburstChart
          trades={trades}
          selectedFilter={params.selectedFilter ?? null}
          onSegmentClick={params.onSegmentClick ?? (() => {})}
        />
      );
    case 'treemapChart':
      return (
        <BClassTreemapChart
          trades={trades}
          selectedFilter={params.selectedFilter ?? null}
          onSegmentClick={params.onSegmentClick ?? (() => {})}
        />
      );
    case 'grid':
      return (
        <TradeGrid
          trades={trades}
          quickFilterText={params.quickFilterText ?? ''}
          selectedTradeId={params.selectedTradeId ?? null}
          onRowDoubleClick={params.onRowDoubleClick}
        />
      );
    case 'intradayChart':
      return (
        <IntradayPriceChart
          intradayData={params.intradayData ?? null}
          selectedTradeId={params.selectedTradeId ?? null}
          aiChartOption={params.aiChartOption ?? null}
        />
      );
    case 'yieldCurve':
      return <YieldCurveScatterPanel trades={trades} />;
    case 'aiAssistant':
      return <AIAssistant />;
    case 'aiDataTable':
      return <AIDataTablePanel />;
    case 'aiGraphPanel':
      return <AIGraphPanel />;
    default:
      return null;
  }
}
