import { useState, useCallback, useEffect } from 'react';
import { GridApi, Column } from 'ag-grid-community';

interface ColumnToolPanelProps {
  gridApi: GridApi | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ColumnInfo {
  colId: string;
  headerName: string;
  visible: boolean;
  pinned: 'left' | 'right' | boolean | null | undefined;
}

export function ColumnToolPanel({ gridApi, isOpen, onClose }: ColumnToolPanelProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [searchText, setSearchText] = useState('');

  // Get column info from grid
  const refreshColumns = useCallback(() => {
    if (!gridApi) return;

    const allColumns = gridApi.getColumns() || [];
    const columnInfo: ColumnInfo[] = allColumns.map((col: Column) => ({
      colId: col.getColId(),
      headerName: col.getColDef().headerName || col.getColId(),
      visible: col.isVisible(),
      pinned: col.getPinned(),
    }));

    setColumns(columnInfo);
  }, [gridApi]);

  useEffect(() => {
    if (isOpen) {
      refreshColumns();
    }
  }, [isOpen, refreshColumns]);

  const handleToggleColumn = useCallback((colId: string) => {
    if (!gridApi) return;

    const column = gridApi.getColumn(colId);
    if (column) {
      const isVisible = column.isVisible();
      gridApi.setColumnsVisible([colId], !isVisible);
      refreshColumns();
    }
  }, [gridApi, refreshColumns]);

  const handleShowAll = useCallback(() => {
    if (!gridApi) return;
    const allColIds = columns.map((c) => c.colId);
    gridApi.setColumnsVisible(allColIds, true);
    refreshColumns();
  }, [gridApi, columns, refreshColumns]);

  const handleHideAll = useCallback(() => {
    if (!gridApi) return;
    // Keep at least the first column visible
    const colIdsToHide = columns.slice(1).map((c) => c.colId);
    gridApi.setColumnsVisible(colIdsToHide, false);
    refreshColumns();
  }, [gridApi, columns, refreshColumns]);

  const handleResetColumns = useCallback(() => {
    if (!gridApi) return;
    gridApi.resetColumnState();
    refreshColumns();
  }, [gridApi, refreshColumns]);

  const filteredColumns = columns.filter((col) =>
    col.headerName.toLowerCase().includes(searchText.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="column-tool-panel-overlay" onClick={onClose}>
      <div className="column-tool-panel" onClick={(e) => e.stopPropagation()}>
        <div className="column-tool-panel-header">
          <h3>Columns</h3>
          <button className="column-tool-panel-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="column-tool-panel-search">
          <input
            type="text"
            placeholder="Search columns..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="column-tool-panel-actions">
          <button onClick={handleShowAll}>Show All</button>
          <button onClick={handleHideAll}>Hide All</button>
          <button onClick={handleResetColumns}>Reset</button>
        </div>

        <div className="column-tool-panel-list">
          {filteredColumns.map((col) => (
            <label key={col.colId} className="column-tool-panel-item">
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => handleToggleColumn(col.colId)}
              />
              <span className="column-tool-panel-label">
                {col.headerName}
                {col.pinned && (
                  <span className="column-tool-panel-pinned">
                    ({col.pinned})
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
