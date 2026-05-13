import React, { useEffect, useState } from "react";

type FiltersProps = {
  icNames: string[];
  activityCodes: string[];
  states: string[];
  selectedPI: string;
  selectedIC: string;
  selectedActivity: string;
  selectedState: string;
  fyMin: string;
  fyMax: string;
  onApply: (filters: {
    pi: string;
    ic: string;
    activity: string;
    state: string;
    fyMin: string;
    fyMax: string;
  }) => void;
  onClear: () => void;
};

const formatDropdownLabel = (value: string): string => {
  const titleCase = value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (titleCase.startsWith("National Institute Of")) {
    return titleCase.replace("National Institute Of", "Nat. Inst. of");
  }

  if (titleCase.startsWith("National Institute")) {
    return titleCase.replace("National Institute", "Nat. Inst.");
  }

  if (titleCase.startsWith("National")) {
    return titleCase.replace("National", "Nat.");
  }

  return titleCase;
};

const formatAllCapsLabel = (value: string): string => value.trim().toUpperCase();

const Filters: React.FC<FiltersProps> = ({
  icNames,
  activityCodes,
  states,
  selectedPI,
  selectedIC,
  selectedActivity,
  selectedState,
  fyMin,
  fyMax,
  onApply,
  onClear,
}) => {
  const [localPI, setLocalPI] = useState(selectedPI);
  const [localIC, setLocalIC] = useState(selectedIC);
  const [localActivity, setLocalActivity] = useState(selectedActivity);
  const [localState, setLocalState] = useState(selectedState);
  const [localFyMin, setLocalFyMin] = useState(fyMin);
  const [localFyMax, setLocalFyMax] = useState(fyMax);

  useEffect(() => {
    setLocalPI(selectedPI);
    setLocalIC(selectedIC);
    setLocalActivity(selectedActivity);
    setLocalState(selectedState);
    setLocalFyMin(fyMin);
    setLocalFyMax(fyMax);
  }, [selectedPI, selectedIC, selectedActivity, selectedState, fyMin, fyMax]);

  const hasFilters = localPI || localIC || localActivity || localState || localFyMin || localFyMax;

  const handleApply = () => {
    onApply({
      pi: localPI,
      ic: localIC,
      activity: localActivity,
      state: localState,
      fyMin: localFyMin,
      fyMax: localFyMax,
    });
  };

  const handleClear = () => {
    setLocalPI("");
    setLocalIC("");
    setLocalActivity("");
    setLocalState("");
    setLocalFyMin("");
    setLocalFyMax("");
    onClear();
  };

  return (
    <section className="app-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">Principal Investigator</div>
        <input
          className="sidebar-text-input"
          type="text"
          placeholder="Type PI name"
          value={localPI}
          onChange={(e) => setLocalPI(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">NIH Institute / Center</div>
        <select
          className="sidebar-select"
          value={localIC}
          onChange={(e) => setLocalIC(e.target.value)}
        >
          <option value="">All Institutes</option>
          {icNames.map((ic) => (
            <option key={ic} value={ic}>{formatDropdownLabel(ic)}</option>
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
            <option key={code} value={code}>{formatAllCapsLabel(code)}</option>
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
            <option key={s} value={s}>{formatAllCapsLabel(s)}</option>
          ))}
        </select>
      </div>

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

      <div className="filters-actions">
        <button className="btn-apply" onClick={handleApply}>
          Apply Filters
        </button>

        {hasFilters && (
          <button className="btn-clear" onClick={handleClear}>
            Clear All
          </button>
        )}
      </div>
    </section>
  );
};

export default Filters;