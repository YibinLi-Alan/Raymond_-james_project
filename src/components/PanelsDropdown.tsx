import { useState, useCallback, useEffect, useRef } from 'react';
import { DockviewLayoutHandle } from './DockviewLayout';

interface PanelsDropdownProps {
  layoutHandle: DockviewLayoutHandle | null;
}

export function PanelsDropdown({ layoutHandle }: PanelsDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [panelStates, setPanelStates] = useState<{ id: string; title: string; isOpen: boolean }[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync panel states from layout whenever menu is open or layoutHandle changes (single source of truth)
  useEffect(() => {
    if (!layoutHandle) return;
    const definitions = layoutHandle.getPanelDefinitions();
    const states = definitions.map((def) => ({
      id: def.id,
      title: def.title,
      isOpen: layoutHandle.isPanelOpen(def.id),
    }));
    setPanelStates(states);
  }, [showMenu, layoutHandle]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleRestorePanel = useCallback((panelId: string) => {
    if (layoutHandle) layoutHandle.restorePanel(panelId);
  }, [layoutHandle]);

  const handleClosePanel = useCallback((panelId: string) => {
    if (layoutHandle) layoutHandle.closePanel(panelId);
  }, [layoutHandle]);

  const handleTogglePanel = useCallback(
    (panelId: string, isOpen: boolean) => {
      if (isOpen) {
        handleClosePanel(panelId);
      } else {
        if (layoutHandle && !layoutHandle.canOpenMore()) {
          return; // will show hint below
        }
        handleRestorePanel(panelId);
      }
    },
    [handleClosePanel, handleRestorePanel, layoutHandle]
  );

  const handleResetLayout = useCallback(() => {
    if (layoutHandle) {
      layoutHandle.resetLayout();
      setShowMenu(false);
    }
  }, [layoutHandle]);

  if (!layoutHandle) {
    return (
      <button className="control-btn" disabled title="Panels">
        Panels
      </button>
    );
  }

  return (
    <div className="restore-panel-container" ref={menuRef}>
      <button
        className="control-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Manage Panels"
      >
        Panels
      </button>
      {showMenu && (
        <div className="restore-panel-menu">
          {layoutHandle && !layoutHandle.canOpenMore() && (
            <div className="restore-panel-max-hint">Max 4 panels. Close one to open another.</div>
          )}
          {panelStates.map((panel) => (
            <button
              key={panel.id}
              className={`restore-panel-item ${panel.isOpen ? 'active' : ''} ${!panel.isOpen && layoutHandle && !layoutHandle.canOpenMore() ? 'disabled' : ''}`}
              onClick={() => handleTogglePanel(panel.id, panel.isOpen)}
              disabled={!panel.isOpen && layoutHandle !== null && !layoutHandle.canOpenMore()}
              title={!panel.isOpen && layoutHandle && !layoutHandle.canOpenMore() ? 'Close one panel first' : undefined}
            >
              <span className="panel-toggle-icon">{panel.isOpen ? '✓' : ''}</span>
              {panel.title}
            </button>
          ))}
          <div className="restore-panel-divider" />
          <button className="restore-panel-item reset" onClick={handleResetLayout}>
            Reset Layout
          </button>
        </div>
      )}
    </div>
  );
}
