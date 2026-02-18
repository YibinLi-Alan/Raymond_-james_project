import { useState, useCallback, useRef, useEffect } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';

export function SavedViewsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { savedViews, activeViewId, saveView, loadView, deleteView } = useBlotterStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveView = useCallback(() => {
    if (newViewName.trim()) {
      saveView(newViewName.trim());
      setNewViewName('');
      setShowSaveModal(false);
      setIsOpen(false);
    }
  }, [newViewName, saveView]);

  const handleLoadView = useCallback((viewId: string) => {
    loadView(viewId);
    setIsOpen(false);
  }, [loadView]);

  const handleDeleteView = useCallback((e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    deleteView(viewId);
  }, [deleteView]);

  const activeView = savedViews.find(v => v.id === activeViewId);

  return (
    <>
      <div className="views-dropdown" ref={dropdownRef}>
        <button
          className="views-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          {activeView?.name || 'Views'}
          <span style={{ marginLeft: '4px', fontSize: '10px' }}>▼</span>
        </button>

        {isOpen && (
          <div className="views-menu">
            <button
              className="views-menu-item"
              onClick={() => {
                setShowSaveModal(true);
                setIsOpen(false);
              }}
            >
              Save Current View
            </button>

            {savedViews.length > 0 && (
              <>
                <div className="views-menu-divider" />
                {savedViews.map(view => (
                  <button
                    key={view.id}
                    className={`views-menu-item ${view.id === activeViewId ? 'active' : ''}`}
                    onClick={() => handleLoadView(view.id)}
                  >
                    <span>{view.name}</span>
                    <button
                      className="views-menu-delete"
                      onClick={(e) => handleDeleteView(e, view.id)}
                      title="Delete view"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '12px',
                      }}
                    >
                      ✕
                    </button>
                  </button>
                ))}
              </>
            )}

            {savedViews.length === 0 && (
              <>
                <div className="views-menu-divider" />
                <div
                  style={{
                    padding: '8px 16px',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                  }}
                >
                  No saved views yet
                </div>
              </>
            )}

            <div className="views-menu-divider" />
            <div
              style={{
                padding: '4px 16px',
                color: 'var(--text-muted)',
                fontSize: '11px',
              }}
            >
              {savedViews.length}/50 views
            </div>
          </div>
        )}
      </div>

      {/* Save View Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Save View</h3>
              <button
                className="modal-close"
                onClick={() => setShowSaveModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="modal-input"
                placeholder="Enter view name..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveView();
                }}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveView}
                disabled={!newViewName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
