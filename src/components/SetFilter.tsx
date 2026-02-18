import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { IFilterParams, IDoesFilterPassParams } from 'ag-grid-community';

interface SetFilterProps extends IFilterParams {
  colDef: {
    field?: string;
    headerName?: string;
  };
}

export interface SetFilterRef {
  isFilterActive(): boolean;
  doesFilterPass(params: IDoesFilterPassParams): boolean;
  getModel(): string[] | null;
  setModel(model: string[] | null): void;
}

export const SetFilter = forwardRef<SetFilterRef, SetFilterProps>((props, ref) => {
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [isAllSelected, setIsAllSelected] = useState(true);

  // Get unique values from the column
  const uniqueValues = useMemo(() => {
    const values = new Set<string>();
    props.api.forEachNode((node) => {
      if (node.data && props.colDef.field) {
        const value = node.data[props.colDef.field];
        if (value !== undefined && value !== null) {
          values.add(String(value));
        }
      }
    });
    return Array.from(values).sort();
  }, [props.api, props.colDef.field]);

  // Filter values based on search
  const filteredValues = useMemo(() => {
    if (!searchText) return uniqueValues;
    const lowerSearch = searchText.toLowerCase();
    return uniqueValues.filter((v) => v.toLowerCase().includes(lowerSearch));
  }, [uniqueValues, searchText]);

  // Initialize with all values selected
  useEffect(() => {
    if (uniqueValues.length > 0 && selectedValues.size === 0 && isAllSelected) {
      setSelectedValues(new Set(uniqueValues));
    }
  }, [uniqueValues, selectedValues.size, isAllSelected]);

  // Expose filter methods to AG Grid
  useImperativeHandle(ref, () => ({
    isFilterActive() {
      return selectedValues.size > 0 && selectedValues.size < uniqueValues.length;
    },

    doesFilterPass(params: IDoesFilterPassParams) {
      if (!props.colDef.field) return true;
      const value = String(params.data[props.colDef.field] ?? '');
      return selectedValues.has(value);
    },

    getModel() {
      if (selectedValues.size === uniqueValues.length) return null;
      return Array.from(selectedValues);
    },

    setModel(model: string[] | null) {
      if (model === null) {
        setSelectedValues(new Set(uniqueValues));
        setIsAllSelected(true);
      } else {
        setSelectedValues(new Set(model));
        setIsAllSelected(false);
      }
    },
  }));

  const handleToggleValue = useCallback((value: string) => {
    setSelectedValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      setIsAllSelected(next.size === uniqueValues.length);
      return next;
    });
  }, [uniqueValues.length]);

  const handleSelectAll = useCallback(() => {
    setSelectedValues(new Set(uniqueValues));
    setIsAllSelected(true);
  }, [uniqueValues]);

  const handleClearAll = useCallback(() => {
    setSelectedValues(new Set());
    setIsAllSelected(false);
  }, []);

  const handleApply = useCallback(() => {
    props.filterChangedCallback();
  }, [props]);

  const handleReset = useCallback(() => {
    setSelectedValues(new Set(uniqueValues));
    setIsAllSelected(true);
    setSearchText('');
    props.filterChangedCallback();
  }, [uniqueValues, props]);

  return (
    <div className="set-filter">
      <div className="set-filter-header">
        <input
          type="text"
          className="set-filter-search"
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className="set-filter-actions">
        <button className="set-filter-btn" onClick={handleSelectAll}>
          Select All
        </button>
        <button className="set-filter-btn" onClick={handleClearAll}>
          Clear
        </button>
      </div>

      <div className="set-filter-list">
        {filteredValues.map((value) => (
          <label key={value} className="set-filter-item">
            <input
              type="checkbox"
              checked={selectedValues.has(value)}
              onChange={() => handleToggleValue(value)}
            />
            <span className="set-filter-label">{value}</span>
          </label>
        ))}
        {filteredValues.length === 0 && (
          <div className="set-filter-empty">No matches</div>
        )}
      </div>

      <div className="set-filter-footer">
        <button className="set-filter-btn set-filter-reset" onClick={handleReset}>
          Reset
        </button>
        <button className="set-filter-btn set-filter-apply" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
});

SetFilter.displayName = 'SetFilter';
