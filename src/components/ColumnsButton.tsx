import { useCallback } from 'react';

export function ColumnsButton() {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-column-panel'));
  }, []);

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
