# Technical Specification: Trade Analytics Platform

## 1. Executive Summary

This specification defines a front-end architecture for Fixed Income Sales & Trading professionals to review daily trade activity.

**Primary Capabilities:**
- High-performance data grid with grouping, pivoting, and complex filtering
- Historical volume analysis with configurable ADV (Average Daily Volume) comparison
- Multi-currency trade visualization with USD as base currency
- Flexible layout system with multi-monitor pop-out support
- Excel interoperability for downstream analysis

**Technology Approach:** Start with open-source stack (AG Grid Community + Apache ECharts), with documented upgrade path to commercial licenses (AG Grid Enterprise) when budget permits.

---

## 2. Scope Definition

### 2.1 In Scope (MVP)

| Category | Features |
|----------|----------|
| **Data Model** | Identity/Lineage fields + Core Economic fields (see Section 3) |
| **Grid** | Grouping, filtering, sorting, column management, keyboard navigation |
| **Aggregations** | Sum or Average (user-selected) for Notional and Trade Count |
| **Charts** | ADV combo chart (daily volume bars + moving average line) |
| **Layout** | Full drag-and-drop customization (Dockview), multi-panel pop-out |
| **Persistence** | Saved views (50 max), filter persistence, backend-synced preferences |
| **Export** | Excel export (filtered rows, aggregates for grouped views) |
| **Auth** | OAuth integration |
| **Admin** | Holiday calendar management UI (SIFMA) |

### 2.2 Out of Scope (MVP)

| Item | Rationale |
|------|-----------|
| Data freshness alerts | Deferred |
| Secondary charts (Donut, Yield Curve) | Deferred |
| MBS/ABS Factor logic | Schema limited to Identity + Core Economics |
| Repo leg management | Schema limited |
| TIPS inflation adjustments | Schema limited |
| EM/FX product complexity | Schema limited |
| WCAG AA compliance | Not required |
| Screen reader support | Not required |

---

## 3. Data Model

### 3.1 Trade Object Schema

The trade object encompasses two sections: **Identity/Lineage** and **Core Economics**.

#### 3.1.1 Identity & Lineage Fields

```typescript
interface TradeIdentity {
  // Primary Identifiers
  internalTradeId: string;          // Required - Primary key, immutable
  venueExecutionId?: string;        // Conditional - Required for electronic executions
  regulatoryReportId?: string;      // Conditional - Required after regulatory submission

  // Block/Allocation Linkage
  parentTradeId?: string;           // Conditional - Links allocation to block
  allocationId?: string;            // Conditional - Unique allocation identifier

  // Temporal Attributes
  tradeDate: string;                // Required - ISO 8601 date (business date)
  executionTimestamp: string;       // Required - ISO 8601 UTC timestamp
  originalEntryTime: string;        // System-generated - For audit trail
  settlementDate: string;           // Required - Contractual settlement date
}
```

#### 3.1.2 Core Economic Fields

```typescript
interface TradeEconomics {
  // Quantity
  notional: number;                 // Required - Par/face value (max 10,000,000,000)
  quantityTypeCode: 'PAR';          // Required - Fixed to PAR for MVP scope

  // Pricing (all decimals, 6 decimal precision)
  cleanPrice: number;               // Required - Price as % of par, excluding accrued
  priceType: 'PERCENTAGE' | 'YIELD' | 'SPREAD' | 'DISCOUNT';
  yield?: number;                   // Conditional - YTM/YTW if negotiated in yield
  yieldType?: 'YTM' | 'YTC' | 'YTP' | 'YTW';
  accruedInterestAmount: number;    // Required - Calculated accrued interest
  grossTradeAmount: number;         // Required - (Clean Price * Notional) + Accrued
  netMoney: number;                 // Required - Final settlement amount

  // Party Information
  counterpartyId: string;           // Required - LEI or internal identifier
  counterpartyName: string;         // Required - Display name
  executingBrokerId?: string;       // Conditional - For voice/intermediated trades
  traderId: string;                 // Required - Internal trader identifier
  deskId: string;                   // Required - Maps to P&L book

  // Instrument Attributes
  product: string;                  // Required - Asset class (Treasury, Corporate, Muni)
  tenor: string;                    // Required - Maturity bucket (2Y, 5Y, 10Y, 30Y)
  side: 'BUY' | 'SELL';            // Required - Direction

  // Currency
  tradeCurrency: string;            // Required - ISO currency code
  settlementCurrency: string;       // Required - Typically USD
  fxRate?: number;                  // Conditional - Point-in-time rate if cross-currency
  notionalUsd: number;              // Required - USD equivalent for aggregation
}
```

#### 3.1.3 Complete Trade Interface

```typescript
interface Trade extends TradeIdentity, TradeEconomics {}
```

### 3.2 Default Visible Columns (10)

| # | Field | Display Name |
|---|-------|--------------|
| 1 | internalTradeId | Trade ID |
| 2 | tradeDate | Trade Date |
| 3 | counterpartyName | Counterparty |
| 4 | side | Side |
| 5 | product | Product |
| 6 | tenor | Tenor |
| 7 | notionalUsd | Notional (USD) |
| 8 | cleanPrice | Price |
| 9 | yield | Yield |
| 10 | deskId | Desk |

All other fields available via column chooser.

---

## 4. API Contract Design

### 4.1 Endpoints

#### 4.1.1 Trade Data

```
GET /api/v1/trades
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | ISO date | Yes | Start of date range (inclusive) |
| endDate | ISO date | Yes | End of date range (inclusive) |
| limit | number | No | Max records (default: 10000) |
| offset | number | No | Pagination offset |

**Response:**
```typescript
interface TradesResponse {
  data: Trade[];
  meta: {
    totalCount: number;
    returnedCount: number;
    asOfTimestamp: string;      // When data was generated
    tradingDaysInRange: number; // For ADV calculation
  };
}
```

#### 4.1.2 FX Rates

```
GET /api/v1/fx-rates
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| baseCurrency | string | Yes | Base currency (USD) |
| date | ISO date | Yes | Rate date |

**Response:**
```typescript
interface FxRatesResponse {
  baseCurrency: string;
  asOfDate: string;
  rates: Record<string, number>; // { "EUR": 1.08, "GBP": 1.27, ... }
}
```

#### 4.1.3 User Preferences

```
GET /api/v1/users/{userId}/preferences
PUT /api/v1/users/{userId}/preferences
```

**Payload:**
```typescript
interface UserPreferences {
  columnState: ColumnState[];
  savedViews: SavedView[];       // Max 50
  lastActiveView?: string;
  defaultFilters?: FilterModel;
}

interface SavedView {
  id: string;
  name: string;
  columnState: ColumnState[];
  filterModel: FilterModel;
  groupState: GroupState;
  sortModel: SortModel;
  createdAt: string;
  updatedAt: string;
}
```

#### 4.1.4 Holiday Calendar (Admin)

```
GET /api/v1/admin/holidays
POST /api/v1/admin/holidays
DELETE /api/v1/admin/holidays/{date}
```

**Payload:**
```typescript
interface Holiday {
  date: string;           // ISO date
  name: string;           // "Memorial Day"
  calendar: 'SIFMA';      // Calendar type
}
```

**Anomaly Alert Endpoint:**
```
GET /api/v1/admin/calendar-anomalies
```

Returns dates where:
- Volume occurred on a holiday
- No volume occurred on a trading day

---

## 5. Front-End Architecture

### 5.1 Technology Stack

| Layer | Open Source (MVP) | Commercial (Future) |
|-------|-------------------|---------------------|
| Framework | React 19 + TypeScript | Same |
| State (Server) | TanStack Query | Same |
| State (UI) | Zustand | Same |
| Data Grid | AG Grid Community | AG Grid Enterprise |
| Charts | Apache ECharts | Highcharts Stock (optional) |
| Layout | Dockview | Same |
| Date Handling | date-fns + date-fns-tz | Same |
| Export | SheetJS (xlsx) | AG Grid native (with Enterprise) |

### 5.2 State Management Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
├─────────────────────────────────────────────────────────┤
│  TanStack Query (Server State)  │  Zustand (UI State)   │
│  - Trade data cache             │  - Column visibility  │
│  - FX rates cache               │  - Active filters     │
│  - User preferences             │  - Grouping state     │
│  - Holiday calendar             │  - Sort state         │
│                                 │  - Active view        │
│                                 │  - Layout config      │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Web Worker Pipeline

For datasets approaching 10,000 trades, offload processing to Web Worker:

```
Main Thread                    Web Worker
     │                              │
     │──── Raw JSON ───────────────>│
     │                              │ Parse & validate
     │                              │ Calculate derived fields
     │                              │ Compute ADV aggregates
     │<─── Processed payload ───────│
     │                              │
   Render
```

**Worker Responsibilities:**
- Date parsing (string → Date objects)
- FX conversion (apply point-in-time rates)
- ADV calculation (sum by trading day)
- Grouping aggregations (when using Community edition)

---

## 6. Component Specifications

### 6.1 Data Grid

#### 6.1.1 Features Matrix

| Feature | Community Path | Enterprise Path |
|---------|----------------|-----------------|
| Row virtualization | Native | Native |
| Column virtualization | Native | Native |
| Sorting | Native | Native |
| Basic filtering | Native | Native |
| Set filters (checkboxes) | Custom build | Native |
| Row grouping | Custom build | Native |
| Pivoting | Custom build | Native |
| Column tool panel | Custom build | Native |
| Excel export | SheetJS integration | Native |
| Clipboard | Basic | Advanced |

#### 6.1.2 Custom Implementations (Community Path)

**Grouping Logic:**
```typescript
interface GroupConfig {
  groupBy: string[];              // e.g., ['product', 'tenor']
  aggregationMode: 'SUM' | 'AVG';
  aggregateFields: ['notionalUsd', 'tradeCount'];
}
```

When grouping is active:
1. Web Worker computes grouped aggregates
2. Grid displays hierarchical data with expand/collapse
3. Only Notional (USD) and Trade Count show aggregate values
4. Other columns show blank or group label

**Set Filter Component:**
- Custom React component mimicking Excel-style filter
- Searchable checkbox list
- "Select All" / "Clear All" buttons
- Integrates with grid filter model

#### 6.1.3 Default State

```typescript
const defaultGridState = {
  grouping: [],                    // Flat list
  sorting: [{ field: 'tradeDate', direction: 'desc' }],
  filters: {},
  dateRange: 'LAST_TRADING_DAY',
};
```

### 6.2 ADV Chart (Apache ECharts)

#### 6.2.1 Chart Configuration

```typescript
interface ADVChartConfig {
  type: 'combo';
  series: [
    { type: 'bar', name: 'Daily Volume', field: 'notionalUsd' },
    { type: 'line', name: 'ADV', calculated: true }
  ];
  xAxis: { type: 'time', tradingDaysOnly: true };
  yAxis: { type: 'value', label: 'Volume (USD)' };
}
```

#### 6.2.2 ADV Calculation Logic

```typescript
function calculateADV(trades: Trade[], holidays: string[]): DailyVolume[] {
  // 1. Group trades by tradeDate
  // 2. Sum notionalUsd per day
  // 3. Filter out holidays (SIFMA calendar)
  // 4. Calculate moving average over selected period
  // 5. Return daily volumes with ADV overlay
}
```

**Key Behaviors:**
- ADV recalculates when filters change (filter-aware)
- Only trading days counted (exclude weekends + SIFMA holidays)
- User selects date range via presets or custom picker

#### 6.2.3 Chart-to-Grid Interaction

```typescript
// On bar click
onChartClick(date: string) {
  // Add date filter (additive to existing filters)
  addFilter({ field: 'tradeDate', value: date });
}

// On same bar click again
onChartClick(date: string) {
  // Remove date filter (toggle behavior)
  removeFilter({ field: 'tradeDate', value: date });
}
```

### 6.3 Date Range Picker

**Presets:**
| Label | Logic |
|-------|-------|
| Yesterday | Last trading day before today |
| Last 7 Trading Days | 7 trading days (exclude weekends/holidays) |
| Last 30 Trading Days | 30 trading days |
| Month to Date | First of current month to today |
| Custom Range | User-defined start/end |

**Implementation Note:** "Yesterday" resolves to the last SIFMA trading day, not calendar yesterday.

### 6.4 Layout System (Dockview)

#### 6.4.1 Default Layout

```
┌─────────────────────────────────────────────────────────┐
│  Control Bar (Date Picker, Omnibar, Refresh, Export)    │
├─────────────────────────────────────────────────────────┤
│                    ADV Chart                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    Data Grid                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 6.4.2 Layout Capabilities

- Drag-and-drop panel rearrangement
- Resize panels
- Tab panels together
- Pop-out to separate browser window
- Multiple simultaneous pop-outs
- Pop-outs persist on browser refresh
- Pop-outs stay synced with main window filters

### 6.5 Quick Filter (Omnibar)

**Behavior:**
- Single text input at top of interface
- Searches across ALL text fields simultaneously
- Debounced (300ms) to prevent excessive filtering
- Case-insensitive
- Clears with "X" button or Escape key

---

## 7. User Preferences & Persistence

### 7.1 Persistence Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Browser    │ ───> │   Backend    │ ───> │   Database   │
│  (Zustand)   │ sync │     API      │      │  (per user)  │
└──────────────┘      └──────────────┘      └──────────────┘
```

**Sync Strategy:**
- On preference change: debounced PUT to backend (2 second delay)
- On app load: GET preferences, apply to Zustand
- Cross-device: preferences sync via backend

### 7.2 Saved Views

**Constraints:**
- Maximum 50 views per user
- View names must be unique per user
- Views include: column state, filters, grouping, sorting

**UI:**
- Dropdown selector in control bar
- "Save View" button (prompts for name)
- "Manage Views" modal (rename, delete, reorder)
- Warning when approaching 50-view limit

### 7.3 Filter Persistence

- Filters persist across sessions
- "Reset Filters" button clearly visible
- Reset returns to default state (no filters, yesterday's data)

---

## 8. Export Functionality

### 8.1 Excel Export (SheetJS)

**Behavior:**
- Exports currently filtered/visible rows only
- Grouped views export as aggregates (not expanded)
- Includes column headers
- Proper data types (numbers as numbers, dates as dates)
- File name: `morning_blotter_YYYY-MM-DD.xlsx`

**Implementation:**
```typescript
async function exportToExcel(gridData: GridRow[], columns: Column[]) {
  const worksheet = XLSX.utils.json_to_sheet(gridData, {
    header: columns.map(c => c.field),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Blotter');
  XLSX.writeFile(workbook, `morning_blotter_${today()}.xlsx`);
}
```

### 8.2 Copy to Clipboard

- TSV format (Tab Separated Values) for Excel paste compatibility
- Includes headers
- Respects current selection (if rows selected) or exports all visible

---

## 9. Performance Requirements

### 9.1 SLAs

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Initial load (2,000 trades) | < 500ms | Time to first meaningful render |
| Filter operation | < 200ms | Time from action to grid update |
| ADV recalculation | < 1 second | Time to update chart after filter |
| Excel export (2,000 rows) | < 5 seconds | Time to download file |
| Excel export (10,000 rows) | < 15 seconds | Time to download file |

### 9.2 Data Loading Strategy

**Lazy Loading:**
- Default: Load last trading day only
- On date range expansion: fetch additional data
- Cache previously fetched ranges (TanStack Query)
- Maximum in-memory: ~30 days (~60,000 trades)

**For ranges > 30 days:**
- Warn user of potential performance impact
- Consider server-side aggregation for ADV (future enhancement)

---

## 10. Error Handling

### 10.1 API Failures

| Scenario | Behavior |
|----------|----------|
| Trade fetch fails | Error banner: "Failed to load trades. [Retry]" |
| FX rate fetch fails | Warning banner: "FX rates unavailable. Showing local currency values." |
| Preference save fails | Toast: "Failed to save preferences. Changes may not persist." |
| Partial failure | Load what succeeded, warn about what failed |

### 10.2 User-Initiated Retry

- All error banners include "Retry" button
- Retry uses exponential backoff (1s, 2s, 4s)
- After 3 failures: "Please try again later or contact support"

---

## 11. Browser Support

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 90+ | Primary development target |
| Firefox | 88+ | Full support |
| Edge | 90+ | Chromium-based, full support |
| Safari | 14+ | Test pop-out behavior carefully |

**Not Supported:**
- Internet Explorer (any version)
- Mobile browsers (not optimized for touch)

---

## 12. Accessibility

### 12.1 Requirements

| Requirement | Status |
|-------------|--------|
| WCAG AA compliance | Not required |
| Keyboard navigation | Required |
| Screen reader support | Not required |
| Color contrast | Best effort (follow dark mode guidelines) |

### 12.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between controls |
| Arrow keys | Navigate grid cells |
| Enter | Expand/collapse group, activate button |
| Escape | Close modal, clear omnibar |
| Ctrl+C | Copy selected cells |
| Ctrl+F | Focus omnibar |

---

## 13. Theming & Visual Design

### 13.1 Dark Mode (Default)

| Element | Color |
|---------|-------|
| Background | #121212 (off-black) |
| Surface | #1e1e1e |
| Primary text | #e0e0e0 |
| Secondary text | #a0a0a0 |
| Accent (Buy) | #00897B (Teal) |
| Accent (Sell) | #F57C00 (Orange) |
| Error | #CF6679 |
| Success | #03DAC6 |

### 13.2 Data Density

- Default: Compact spacing (maximize rows visible)
- User toggle: Compact / Standard / Comfortable
- Target: 50+ rows visible without scrolling (Compact mode)

---

## 14. Open Source vs Commercial: Feature Gap Analysis

### 14.1 AG Grid Community Limitations

| Missing Feature | Workaround | Effort |
|-----------------|------------|--------|
| Pivoting | Custom pivot logic in Web Worker | 2-3 weeks |
| Row grouping UI | Custom expandable row component | 1-2 weeks |
| Set filters | Custom filter component | 1 week |
| Column tool panel | Custom sidebar component | 1 week |
| Excel export | SheetJS integration | 3-4 days |
| Tree data | Flatten with indentation | 1 week |

**Total additional effort for Community path: ~6-8 weeks**

### 14.2 Upgrade Path to Enterprise

When AG Grid Enterprise license is acquired:
1. Remove custom pivot/grouping logic
2. Remove custom filter components
3. Remove SheetJS, use native export
4. Enable native column tool panel
5. Enable native tree data for block/allocation hierarchy

**Estimated migration effort: 1-2 weeks**

---

## 15. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
- Project scaffold (Vite + React 19 + TypeScript)
- API client setup (TanStack Query)
- Web Worker pipeline
- Basic data grid (AG Grid Community)
- OAuth integration

### Phase 2: Grid Features (Weeks 4-6)
- Custom grouping logic
- Custom set filters
- Column state management
- Saved views (backend integration)

### Phase 3: Analytics (Weeks 7-8)
- Apache ECharts integration
- ADV calculation logic
- Chart-to-grid interaction
- SIFMA holiday calendar

### Phase 4: Layout & Polish (Weeks 9-10)
- Dockview integration
- Pop-out window support
- Excel export (SheetJS)
- Dark mode theming
- Keyboard navigation

### Phase 5: Testing & Hardening (Weeks 11-12)
- Performance testing (10,000 trades)
- Cross-browser testing
- Error handling
- User acceptance testing

---

## 16. Verification & Testing

### 16.1 Performance Benchmarks

| Test | Dataset | Target |
|------|---------|--------|
| Initial render | 2,000 trades | < 500ms |
| Initial render | 10,000 trades | < 2 seconds |
| Filter (text) | 10,000 trades | < 200ms |
| Filter (set) | 10,000 trades | < 300ms |
| Group by Product | 10,000 trades | < 500ms |
| ADV recalc | 30 days data | < 1 second |
| Excel export | 10,000 rows | < 15 seconds |

### 16.2 Functional Test Cases

1. **Default Load:** App loads with flat list, yesterday's trades, sorted by date desc
2. **Grouping:** Group by Product shows aggregated Notional and Trade Count
3. **Filter Persistence:** Apply filter, refresh page, filter still active
4. **Saved View:** Save view, switch away, switch back, state restored
5. **Chart Click:** Click bar, grid filters to that day, click again, filter removed
6. **Cross-Device:** Save preferences on desktop, load on laptop, preferences applied
7. **Pop-out:** Pop out chart, change filter in main window, chart updates
8. **Export:** Export grouped view, Excel contains aggregates not individual rows
9. **Refresh:** Click refresh, filters preserved, scroll position preserved
10. **Reset:** Click reset filters, returns to default state

### 16.3 Cross-Browser Verification

Test all functional cases on:
- Chrome (Windows, Mac)
- Firefox (Windows, Mac)
- Edge (Windows)
- Safari (Mac)

Special attention to Safari:
- Pop-out window behavior
- Clipboard operations

---

## 17. Open Questions (Resolved)

All questions from Phase 2 interview have been resolved. No open items remain.

---

## 18. Appendix: SIFMA Holiday Calendar (2025-2026)

Reference holidays for ADV calculation:

| Date | Holiday |
|------|---------|
| 2025-01-01 | New Year's Day |
| 2025-01-20 | Martin Luther King Jr. Day |
| 2025-02-17 | Presidents Day |
| 2025-04-18 | Good Friday |
| 2025-05-26 | Memorial Day |
| 2025-06-19 | Juneteenth |
| 2025-07-04 | Independence Day |
| 2025-09-01 | Labor Day |
| 2025-10-13 | Columbus Day |
| 2025-11-11 | Veterans Day |
| 2025-11-27 | Thanksgiving |
| 2025-12-25 | Christmas |

*Note: Calendar maintained via Admin UI. App manager can add/remove holidays.*
