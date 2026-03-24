import { useCallback } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';

export function ColumnsButton() {
  const visiblePanelIds = useBlotterStore((s) => s.visiblePanelIds);
  const openPanel = useBlotterStore((s) => s.openPanel);

  const handleClick = useCallback(() => {
    const isGridVisible = visiblePanelIds.includes('grid');
    if (!isGridVisible) {
      openPanel('grid');
      // TradeGrid mounts on next render; defer event so its listener is attached
      setTimeout(() => window.dispatchEvent(new CustomEvent('open-column-panel')), 0);
    } else {
      window.dispatchEvent(new CustomEvent('open-column-panel'));
    }
  }, [visiblePanelIds, openPanel]);

  return (
    <button
      className="control-btn"
      onClick={handleClick}
      title="Manage Columns (Ctrl+Shift+C)"
    >
      Columns
    </button>
  );
}
