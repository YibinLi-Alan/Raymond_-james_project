import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SizeAnomaly, FrequencyAnomaly } from '../api/client';

// Filter model type
export interface FilterModel {
  [field: string]: {
    filterType: string;
    type?: string;
    filter?: string | number;
    values?: string[];
  };
}

// Sort model type
export interface SortModel {
  colId: string;
  sort: 'asc' | 'desc';
}

// Group state type
export interface GroupState {
  groupBy: string[];
  aggregationMode: 'SUM' | 'AVG';
}

// Column state type
export interface ColumnState {
  colId: string;
  width?: number;
  hide?: boolean;
  pinned?: 'left' | 'right' | null;
  sort?: 'asc' | 'desc' | null;
  sortIndex?: number;
}

// Saved view type
export interface SavedView {
  id: string;
  name: string;
  columnState: ColumnState[];
  filterModel: FilterModel;
  groupState: GroupState;
  sortModel: SortModel[];
  dateRange: DateRange;
  createdAt: string;
  updatedAt: string;
}

// Date range type
export type DateRangePreset = 'yesterday' | 'last7' | 'last30' | 'mtd' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate?: string;
  endDate?: string;
}

// Chart filter (from clicking chart bars)
export interface ChartDateFilter {
  date: string;
  active: boolean;
}

// AI Assistant: result from Text-to-SQL (Mode 1)
export interface AIQueryResult {
  data: Record<string, unknown>[];
  trades?: Record<string, unknown>[]; // Trade-like rows for grid when query returns v_trades_full-style data
  sql?: string;
  chartOption?: Record<string, unknown> | null;
  aiSummary?: string | null;
  anomalyTradeIds?: string[]; // TradeIDs to highlight in red (outliers)
  error?: string | null;
}

// Snapshot of last Data Query result for General Chat context injection
export interface LastAiQueryResult {
  data: Record<string, unknown>[];
  sql?: string;
}

// ECharts option type (for AI-suggested chart)
export type AIChartOption = Record<string, unknown> | null;

// Main store state
interface BlotterState {
  // UI State
  quickFilterText: string;
  dateRange: DateRange;
  chartDateFilter: ChartDateFilter | null;

  // Intraday Chart State (bypasses dockview for reliable double-click)
  selectedTradeId: string | null;

  // Grid State
  columnState: ColumnState[];
  filterModel: FilterModel;
  sortModel: SortModel[];
  groupState: GroupState;

  // Saved Views
  savedViews: SavedView[];
  activeViewId: string | null;

  // Layout State
  layoutConfig: Record<string, unknown>;
  /** Panel IDs that are currently visible. AI Assistant always rendered in left slot. Max 4 total. */
  visiblePanelIds: string[];
  /** When a chart is open, this is the active chart ID overlay in the right 3/4 area. */
  activeChartPanel: string | null;

  // AI Assistant State
  aiQueryResult: AIQueryResult | null;
  lastAiQueryResult: LastAiQueryResult | null; // Persisted for General Chat context injection
  isAILoading: boolean;
  aiChartOption: AIChartOption;

  // Actions
  setQuickFilterText: (text: string) => void;
  setDateRange: (range: DateRange) => void;
  setChartDateFilter: (filter: ChartDateFilter | null) => void;
  toggleChartDateFilter: (date: string) => void;
  setSelectedTradeId: (tradeId: string | null) => void;

  setColumnState: (state: ColumnState[]) => void;
  setFilterModel: (model: FilterModel) => void;
  setSortModel: (model: SortModel[]) => void;
  setGroupState: (state: GroupState) => void;

  saveView: (name: string) => void;
  loadView: (viewId: string) => void;
  deleteView: (viewId: string) => void;
  renameView: (viewId: string, newName: string) => void;

  resetFilters: () => void;
  resetToDefaults: () => void;

  // Layout panel actions (for 4-column dashboard)
  setVisiblePanelIds: (ids: string[]) => void;
  openPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  setActiveChartPanel: (panelId: string | null) => void;
  resetLayout: () => void;

  // AI Assistant actions
  setAIQueryResult: (result: AIQueryResult | null) => void;
  setLastAiQueryResult: (result: LastAiQueryResult | null) => void;
  setAILoading: (loading: boolean) => void;
  setAIChartOption: (option: AIChartOption) => void;
  clearAIResult: () => void;
  getGridFilterContext: () => { quickFilterText: string; filterModel: FilterModel; dateRange: DateRange };

  // Anomaly Detection State
  sizeAnomalyIds: string[];
  sizeAnomalyDetails: SizeAnomaly[];
  frequencyAnomalies: FrequencyAnomaly[];
  anomalyDayPercentile: number | null;
  anomalyIsLoading: boolean;
  anomalyLastComputedAt: string | null;

  // Anomaly actions
  setAnomalyState: (data: {
    sizeAnomalyIds: string[];
    sizeAnomalyDetails: SizeAnomaly[];
    frequencyAnomalies: FrequencyAnomaly[];
    dayPercentile: number;
    lastComputedAt: string;
  }) => void;
  setAnomalyLoading: (loading: boolean) => void;
  clearAnomalyState: () => void;
}

// Default values
const defaultGroupState: GroupState = {
  groupBy: [],
  aggregationMode: 'SUM',
};

const defaultDateRange: DateRange = {
  preset: 'yesterday',
};

const defaultSortModel: SortModel[] = [
  { colId: 'tradeDate', sort: 'desc' },
];

// Layout: default visible panels (AI Assistant + AI Data Table + Daily Insights)
// Note: Trade Blotter (grid) causes update loop if shown by default; use Panels menu to open it
const DEFAULT_VISIBLE_PANELS = ['aiAssistant', 'aiDataTable', 'insights'];
const MAX_PANELS = 4;
const CHART_PANEL_IDS = ['aiGraphPanel', 'sunburstChart', 'treemapChart', 'intradayChart', 'yieldCurve'];

// Generate unique ID
function generateId(): string {
  return `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useBlotterStore = create<BlotterState>()(
  persist(
    (set, get) => ({
      // Initial UI State
      quickFilterText: '',
      dateRange: defaultDateRange,
      chartDateFilter: null,

      // Initial Intraday Chart State
      selectedTradeId: null,

      // Initial Grid State
      columnState: [],
      filterModel: {},
      sortModel: defaultSortModel,
      groupState: defaultGroupState,

      // Initial Saved Views
      savedViews: [],
      activeViewId: null,

      // Initial Layout
      layoutConfig: {},
      visiblePanelIds: DEFAULT_VISIBLE_PANELS,
      activeChartPanel: null,

      // AI Assistant
      aiQueryResult: null,
      lastAiQueryResult: null,
      isAILoading: false,
      aiChartOption: null,

      // Anomaly Detection
      sizeAnomalyIds: [],
      sizeAnomalyDetails: [],
      frequencyAnomalies: [],
      anomalyDayPercentile: null,
      anomalyIsLoading: false,
      anomalyLastComputedAt: null,

      // Actions
      setQuickFilterText: (text) => set({ quickFilterText: text }),

      setDateRange: (range) => set({ dateRange: range }),

      setChartDateFilter: (filter) => set({ chartDateFilter: filter }),

      setSelectedTradeId: (tradeId) => set({ selectedTradeId: tradeId }),

      toggleChartDateFilter: (date) => {
        const current = get().chartDateFilter;
        if (current?.date === date && current.active) {
          // Toggle off
          set({ chartDateFilter: null });
        } else {
          // Toggle on or switch date
          set({ chartDateFilter: { date, active: true } });
        }
      },

      setColumnState: (state) => set({ columnState: state }),

      setFilterModel: (model) => set({ filterModel: model }),

      setSortModel: (model) => set({ sortModel: model }),

      setGroupState: (state) => set({ groupState: state }),

      saveView: (name) => {
        const state = get();
        const newView: SavedView = {
          id: generateId(),
          name,
          columnState: state.columnState,
          filterModel: state.filterModel,
          groupState: state.groupState,
          sortModel: state.sortModel,
          dateRange: state.dateRange,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const currentViews = state.savedViews;
        if (currentViews.length >= 50) {
          console.warn('Maximum 50 saved views reached');
          return;
        }

        set({
          savedViews: [...currentViews, newView],
          activeViewId: newView.id,
        });
      },

      loadView: (viewId) => {
        const view = get().savedViews.find(v => v.id === viewId);
        if (!view) return;

        set({
          columnState: view.columnState,
          filterModel: view.filterModel,
          groupState: view.groupState,
          sortModel: view.sortModel,
          dateRange: view.dateRange,
          activeViewId: viewId,
        });
      },

      deleteView: (viewId) => {
        set((state) => ({
          savedViews: state.savedViews.filter(v => v.id !== viewId),
          activeViewId: state.activeViewId === viewId ? null : state.activeViewId,
        }));
      },

      renameView: (viewId, newName) => {
        set((state) => ({
          savedViews: state.savedViews.map(v =>
            v.id === viewId
              ? { ...v, name: newName, updatedAt: new Date().toISOString() }
              : v
          ),
        }));
      },

      resetFilters: () => {
        set({
          quickFilterText: '',
          filterModel: {},
          chartDateFilter: null,
          dateRange: defaultDateRange,
        });
      },

      resetToDefaults: () => {
        set({
          quickFilterText: '',
          dateRange: defaultDateRange,
          chartDateFilter: null,
          selectedTradeId: null,
          columnState: [],
          filterModel: {},
          sortModel: defaultSortModel,
          groupState: defaultGroupState,
          activeViewId: null,
          aiQueryResult: null,
          lastAiQueryResult: null,
          aiChartOption: null,
          visiblePanelIds: DEFAULT_VISIBLE_PANELS,
          activeChartPanel: null,
        });
      },

      setVisiblePanelIds: (ids) => set({ visiblePanelIds: ids }),
      openPanel: (panelId) => {
        const state = get();
        const isGraph = CHART_PANEL_IDS.includes(panelId);

        if (isGraph) {
          // Opening a graph: keep only AI Assistant + this graph, show chart overlay
          set({
            visiblePanelIds: ['aiAssistant', panelId],
            activeChartPanel: panelId,
          });
          return;
        }

        // Opening a non-graph (insights, grid, aiDataTable): close graph overlay, show base layout
        let next = state.visiblePanelIds.filter((id) => !CHART_PANEL_IDS.includes(id));
        if (state.visiblePanelIds.includes(panelId)) {
          set({ visiblePanelIds: next, activeChartPanel: null });
          return;
        }
        const MIDDLE_SLOT_IDS = ['grid', 'aiDataTable', 'anomalies'];
        if (MIDDLE_SLOT_IDS.includes(panelId)) {
          next = next.filter((id) => !MIDDLE_SLOT_IDS.includes(id) || id === panelId);
        }
        if (next.length >= MAX_PANELS) return;
        set({
          visiblePanelIds: [...next, panelId],
          activeChartPanel: null,
        });
      },
      closePanel: (panelId) => {
        const state = get();
        if (!state.visiblePanelIds.includes(panelId)) return;
        if (panelId === 'aiAssistant') return; // AI Assistant cannot be closed
        const next = state.visiblePanelIds.filter((id) => id !== panelId);
        let nextActive: string | null = state.activeChartPanel;
        if (state.activeChartPanel === panelId) {
          // Closing the active chart: return to base layout (don't auto-switch to another chart)
          nextActive = null;
        }
        set({ visiblePanelIds: next, activeChartPanel: nextActive });
      },
      setActiveChartPanel: (panelId) => set({ activeChartPanel: panelId }),
      resetLayout: () =>
        set({
          visiblePanelIds: DEFAULT_VISIBLE_PANELS,
          activeChartPanel: null,
        }),

      setAIQueryResult: (result) => set({ aiQueryResult: result }),
      setLastAiQueryResult: (result) => set({ lastAiQueryResult: result }),
      setAILoading: (loading) => set({ isAILoading: loading }),
      setAIChartOption: (option) => set({ aiChartOption: option }),
      clearAIResult: () => set({ aiQueryResult: null, lastAiQueryResult: null, aiChartOption: null }),

      setAnomalyState: (data) => set({
        sizeAnomalyIds: data.sizeAnomalyIds,
        sizeAnomalyDetails: data.sizeAnomalyDetails,
        frequencyAnomalies: data.frequencyAnomalies,
        anomalyDayPercentile: data.dayPercentile,
        anomalyLastComputedAt: data.lastComputedAt,
      }),
      setAnomalyLoading: (loading) => set({ anomalyIsLoading: loading }),
      clearAnomalyState: () => set({
        sizeAnomalyIds: [],
        sizeAnomalyDetails: [],
        frequencyAnomalies: [],
        anomalyDayPercentile: null,
        anomalyIsLoading: false,
        anomalyLastComputedAt: null,
      }),

      getGridFilterContext: () => {
        const state = get();
        return {
          quickFilterText: state.quickFilterText,
          filterModel: state.filterModel,
          dateRange: state.dateRange,
        };
      },
    }),
    {
      name: 'morning-blotter-storage',
      partialize: (state) => ({
        // Only persist these fields
        columnState: state.columnState,
        filterModel: state.filterModel,
        sortModel: state.sortModel,
        groupState: state.groupState,
        savedViews: state.savedViews,
        dateRange: state.dateRange,
      }),
    }
  )
);
