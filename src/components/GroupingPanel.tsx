import { useCallback } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';

const GROUPABLE_FIELDS = [
  { field: 'product', label: 'Product' },
  { field: 'tenor', label: 'Tenor' },
  { field: 'counterpartyName', label: 'Counterparty' },
  { field: 'deskId', label: 'Desk' },
  { field: 'side', label: 'Side' },
  { field: 'tradeCurrency', label: 'Currency' },
  { field: 'tradeDate', label: 'Trade Date' },
];

export function GroupingPanel() {
  const { groupState, setGroupState } = useBlotterStore();
  const { groupBy, aggregationMode } = groupState;

  const handleAddGroup = useCallback((field: string) => {
    if (!groupBy.includes(field)) {
      setGroupState({
        ...groupState,
        groupBy: [...groupBy, field],
      });
    }
  }, [groupBy, groupState, setGroupState]);

  const handleRemoveGroup = useCallback((field: string) => {
    setGroupState({
      ...groupState,
      groupBy: groupBy.filter(f => f !== field),
    });
  }, [groupBy, groupState, setGroupState]);

  const handleAggregationChange = useCallback((mode: 'SUM' | 'AVG') => {
    setGroupState({
      ...groupState,
      aggregationMode: mode,
    });
  }, [groupState, setGroupState]);

  const availableFields = GROUPABLE_FIELDS.filter(f => !groupBy.includes(f.field));

  return (
    <div className="grouping-panel">
      <span className="grouping-label">Group By:</span>

      <div className="grouping-chips">
        {groupBy.map(field => {
          const fieldInfo = GROUPABLE_FIELDS.find(f => f.field === field);
          return (
            <span key={field} className="grouping-chip">
              {fieldInfo?.label || field}
              <button
                className="grouping-chip-remove"
                onClick={() => handleRemoveGroup(field)}
                title="Remove grouping"
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>

      {availableFields.length > 0 && (
        <select
          className="grouping-select"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              handleAddGroup(e.target.value);
            }
          }}
        >
          <option value="">+ Add grouping...</option>
          {availableFields.map(field => (
            <option key={field.field} value={field.field}>
              {field.label}
            </option>
          ))}
        </select>
      )}

      {groupBy.length > 0 && (
        <div className="aggregation-toggle">
          <button
            className={`aggregation-btn ${aggregationMode === 'SUM' ? 'active' : ''}`}
            onClick={() => handleAggregationChange('SUM')}
          >
            Sum
          </button>
          <button
            className={`aggregation-btn ${aggregationMode === 'AVG' ? 'active' : ''}`}
            onClick={() => handleAggregationChange('AVG')}
          >
            Avg
          </button>
        </div>
      )}
    </div>
  );
}
