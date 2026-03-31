import { useState, useCallback, useMemo, ReactNode } from 'react';
import { useEffect } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';
import { SavedViewsDropdown } from './SavedViewsDropdown';
import { BClassFilter } from './BClassSunburstChart';

// Helper to format date as MM/DD/YY
function formatShortDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

// Helper to get last trading day (skip weekends)
function getLastTradingDay(): Date {
  const today = new Date();
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() - 1);
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
}

// Helper to get trading day N days back
function getTradingDaysBack(daysBack: number): Date {
  const date = getLastTradingDay();
  let count = 0;
  while (count < daysBack - 1) {
    date.setDate(date.getDate() - 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      count++;
    }
  }
  return date;
}

interface ChartSelection {
  date: string;
  product: string;
}

interface ControlBarProps {
  onQuickFilterChange: (text: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onReset: () => void;
  panelsButton?: ReactNode;
  columnsButton?: ReactNode;
  selectedPoint: ChartSelection | null;
  bclassFilter: BClassFilter | null;
  onClearSelection: () => void;
}

export function ControlBar({
  onQuickFilterChange,
  onRefresh,
  onExport,
  onReset,
  panelsButton,
  columnsButton,
  selectedPoint,
  bclassFilter,
  onClearSelection,
}: ControlBarProps) {
  const { quickFilterText, setQuickFilterText, dateRange, setDateRange, chartDateFilter } = useBlotterStore();
  const [selectedRange, setSelectedRange] = useState(dateRange.preset);
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    setSelectedRange(dateRange.preset);
  }, [dateRange.preset]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextKey = new Date().toDateString();
      setTodayKey((current) => (current === nextKey ? current : nextKey));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Calculate date labels for dropdown
  const dateLabels = useMemo(() => {
    const yesterday = getLastTradingDay();
    const last7Start = getTradingDaysBack(7);
    const last30Start = getTradingDaysBack(30);
    const mtdStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);

    return {
      yesterday: formatShortDate(yesterday),
      last7: `${formatShortDate(last7Start)} - ${formatShortDate(yesterday)}`,
      last30: `${formatShortDate(last30Start)} - ${formatShortDate(yesterday)}`,
      mtd: `${formatShortDate(mtdStart)} - ${formatShortDate(yesterday)}`,
    };
  }, [todayKey]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuickFilterText(value);
    onQuickFilterChange(value);
  }, [onQuickFilterChange, setQuickFilterText]);

  const handleClearFilter = useCallback(() => {
    setQuickFilterText('');
    onQuickFilterChange('');
  }, [onQuickFilterChange, setQuickFilterText]);

  const handleRangeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value as typeof dateRange.preset;
    setSelectedRange(preset);
    setDateRange({ preset });
  }, [setDateRange]);

  return (
    <div className="control-bar">
      <div className="control-bar-left">
        <div className="logo">
          <span className="logo-text">Trade Data</span>
        </div>

        <div className="date-picker">
          <select
            value={selectedRange}
            onChange={handleRangeChange}
            className="date-select"
          >
            <option value="yesterday">{dateLabels.yesterday}</option>
            <option value="last7">{dateLabels.last7}</option>
            <option value="last30">{dateLabels.last30}</option>
            <option value="mtd">MTD ({dateLabels.mtd})</option>
            <option value="custom">Custom Range...</option>
          </select>
        </div>

        <div className="omnibar">
          <input
            type="text"
            placeholder="Search trades... (Ctrl+F)"
            value={quickFilterText}
            onChange={handleFilterChange}
            className="omnibar-input"
          />
          {quickFilterText && (
            <button className="omnibar-clear" onClick={handleClearFilter}>
              ✕
            </button>
          )}
        </div>

        {chartDateFilter?.active && (
          <div className="active-filter-badge">
            Chart Filter: {chartDateFilter.date}
          </div>
        )}

        {(selectedPoint || bclassFilter) && (
          <div className="inline-filter-indicator">
            <span className="inline-filter-label">
              {selectedPoint && (
                <>
                  <strong>{selectedPoint.product}</strong>
                  {' · '}
                  {new Date(selectedPoint.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </>
              )}
              {selectedPoint && bclassFilter && ' + '}
              {bclassFilter && (
                <strong>
                  {[bclassFilter.level1, bclassFilter.level2, bclassFilter.level3]
                    .filter(Boolean)
                    .join(' > ')}
                </strong>
              )}
            </span>
            <button className="inline-filter-clear" onClick={onClearSelection}>
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="control-bar-right">
        <SavedViewsDropdown />
        {columnsButton}
        {panelsButton}
        <button className="control-btn" onClick={onRefresh} title="Refresh data">
          Refresh
        </button>
        <button className="control-btn" onClick={onExport} title="Export to Excel">
          Export
        </button>
        <button className="control-btn" onClick={onReset} title="Reset filters">
          Reset
        </button>
      </div>
    </div>
  );
}
