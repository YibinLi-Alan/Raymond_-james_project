import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { DockviewLayoutHandle } from './DockviewLayout';
import { useBlotterStore } from '../store/useBlotterStore';

interface PanelsDropdownProps {
  layoutHandle: DockviewLayoutHandle | null;
}

/** Panels that are actually visible on screen (not hidden by chart overlay). */
function getDisplayedPanelIds(
  visiblePanelIds: string[],
  activeChartPanel: string | null
): Set<string> {
  const displayed = new Set<string>();
  displayed.add('aiAssistant'); // Always visible in left slot

  const hasChartOverlay = activeChartPanel && visiblePanelIds.includes(activeChartPanel);
  if (hasChartOverlay) {
    displayed.add(activeChartPanel);
    return displayed;
  }

  // Base layout: middle (grid/aiDataTable) + right (insights)
  for (const id of visiblePanelIds) {
    displayed.add(id);
  }
  return displayed;
}

export function PanelsDropdown({ layoutHandle }: PanelsDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const visiblePanelIds = useBlotterStore((s) => s.visiblePanelIds);
  const activeChartPanel = useBlotterStore((s) => s.activeChartPanel);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayedPanelIds = useMemo(
    () => getDisplayedPanelIds(visiblePanelIds, activeChartPanel),
    [visiblePanelIds, activeChartPanel]
  );

  // Panel states: checkmark only when panel is actually visible (not hidden by overlay)
  const panelStates = layoutHandle
    ? layoutHandle.getPanelDefinitions().map((def) => ({
        id: def.id,
        title: def.title,
        isOpen: displayedPanelIds.has(def.id),
        isInLayout: visiblePanelIds.includes(def.id), // in visiblePanelIds (open slot, may be hidden)
      }))
    : [];

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
    (panelId: string, isOpen: boolean, isInLayout: boolean) => {
      if (isOpen) {
        handleClosePanel(panelId);
      } else {
        // Only block if we'd add a new panel and we're at max
        if (isInLayout || !layoutHandle || layoutHandle.canOpenMore()) {
          handleRestorePanel(panelId);
        }
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
          {panelStates.map((panel) => {
            const wouldAddPanel = !panel.isInLayout;
            const cannotAdd = wouldAddPanel && layoutHandle && !layoutHandle.canOpenMore();
            return (
            <button
              key={panel.id}
              className={`restore-panel-item ${panel.isOpen ? 'active' : ''} ${cannotAdd ? 'disabled' : ''}`}
              onClick={() => handleTogglePanel(panel.id, panel.isOpen, panel.isInLayout)}
              disabled={cannotAdd}
              title={cannotAdd ? 'Close one panel first' : undefined}
            >
              <span className="panel-toggle-icon">{panel.isOpen ? '✓' : ''}</span>
              {panel.title}
            </button>
          );})}
          <div className="restore-panel-divider" />
          <button className="restore-panel-item reset" onClick={handleResetLayout}>
            Reset Layout
          </button>
        </div>
      )}
    </div>
  );
}
