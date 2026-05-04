import React, { useEffect, useState } from "react";

type FiltersProps = {
  icNames: string[];
  activityCodes: string[];
  states: string[];
  selectedIC: string;
  selectedActivity: string;
  selectedState: string;
  fyMin: string;
  fyMax: string;
  costMin: string;
  costMax: string;
  onApply: (filters: {
    ic: string;
    activity: string;
    state: string;
    fyMin: string;
    fyMax: string;
    costMin: string;
    costMax: string;
  }) => void;
  onClear: () => void;
};

const Filters: React.FC<FiltersProps> = ({
  icNames,
  activityCodes,
  states,
  selectedIC,
  selectedActivity,
  selectedState,
  fyMin,
  fyMax,
  costMin,
  costMax,
  onApply,
  onClear,
}) => {
  const [localIC, setLocalIC] = useState(selectedIC);
  const [localActivity, setLocalActivity] = useState(selectedActivity);
  const [localState, setLocalState] = useState(selectedState);
  const [localFyMin, setLocalFyMin] = useState(fyMin);
  const [localFyMax, setLocalFyMax] = useState(fyMax);
  const [localCostMin, setLocalCostMin] = useState(costMin);
  const [localCostMax, setLocalCostMax] = useState(costMax);

  useEffect(() => {
    setLocalIC(selectedIC);
    setLocalActivity(selectedActivity);
    setLocalState(selectedState);
    setLocalFyMin(fyMin);
    setLocalFyMax(fyMax);
    setLocalCostMin(costMin);
    setLocalCostMax(costMax);
  }, [selectedIC, selectedActivity, selectedState, fyMin, fyMax, costMin, costMax]);

  const hasFilters = localIC || localActivity || localState || localFyMin || localFyMax || localCostMin || localCostMax;

  const handleApply = () => {
    onApply({
      ic: localIC,
      activity: localActivity,
      state: localState,
      fyMin: localFyMin,
      fyMax: localFyMax,
      costMin: localCostMin,
      costMax: localCostMax,
    });
  };

  const handleClear = () => {
    setLocalIC("");
    setLocalActivity("");
    setLocalState("");
    setLocalFyMin("");
    setLocalFyMax("");
    setLocalCostMin("");
    setLocalCostMax("");
    onClear();
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">NIH Institute / Center</div>
        <select
          className="sidebar-select"
          value={localIC}
          onChange={(e) => setLocalIC(e.target.value)}
        >
          <option value="">All Institutes</option>
          {icNames.map((ic) => (
            <option key={ic} value={ic}>{ic}</option>
          ))}
        </select>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Activity Code</div>
        <select
          className="sidebar-select"
          value={localActivity}
          onChange={(e) => setLocalActivity(e.target.value)}
        >
          <option value="">All Codes</option>
          {activityCodes.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">State</div>
        <select
          className="sidebar-select"
          value={localState}
          onChange={(e) => setLocalState(e.target.value)}
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-label">Fiscal Year</div>
        <div className="sidebar-range-row">
          <input
            type="number"
            placeholder="From"
            value={localFyMin}
            onChange={(e) => setLocalFyMin(e.target.value)}
            min="1990"
            max="2030"
          />
          <input
            type="number"
            placeholder="To"
            value={localFyMax}
            onChange={(e) => setLocalFyMax(e.target.value)}
            min="1990"
            max="2030"
          />
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Total Cost (USD)</div>
        <div className="sidebar-range-row">
          <input
            type="number"
            placeholder="Min"
            value={localCostMin}
            onChange={(e) => setLocalCostMin(e.target.value)}
            min="0"
          />
          <input
            type="number"
            placeholder="Max"
            value={localCostMax}
            onChange={(e) => setLocalCostMax(e.target.value)}
            min="0"
          />
        </div>
      </div>

      <button className="btn-apply" onClick={handleApply}>
        Apply Filters
      </button>

      {hasFilters && (
        <button className="btn-clear" onClick={handleClear}>
          Clear All
        </button>
      )}
    </aside>
  );
};

export default Filters;
