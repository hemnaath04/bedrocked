import Tooltip from "./Tooltip";

const PRIORITIES = [
  { key: "high",   label: "High",   color: "var(--red)",   dim: "var(--red-dim)",   border: "rgba(239,68,68,0.25)" },
  { key: "medium", label: "Medium", color: "var(--amber)", dim: "var(--amber-dim)", border: "rgba(245,158,11,0.25)" },
  { key: "low",    label: "Low",    color: "var(--green)", dim: "var(--green-dim)", border: "rgba(34,197,94,0.25)" },
];

const LAYERS = [
  { key: "pipes",       label: "Sewer pipes",    icon: "━", info: "2,404 combined sewer segments colored by separation readiness score (0–100). Red = high priority, amber = medium, green = low." },
  { key: "heatmap",    label: "Heat map",         icon: "◈", info: "Density heatmap weighted by readiness score — bright red zones have high concentrations of urgent pipes. Best used with sewer pipes off to see city-wide hotspots." },
  { key: "waterMains", label: "Water pipes",      icon: "━", info: "8,028 water distribution pipes across Somerville shown in blue. Where water pipes overlap sewer pipes, one trench can fix both." },
  { key: "waterRisk",  label: "Water pipe risk",  icon: "━", info: "2,061 water pipes colored by city risk model. Red = Failing, orange = High Risk, amber = Needs monitoring, green = Low Risk. Red overlap with red sewer = top dig-once target." },
  { key: "roads",       label: "Road condition",  icon: "━", info: "5,080 road segments scanned by Cyvl, colored by pavement score. Red = failing, amber = fair, green = good. Bad road over a high-priority sewer = dig now." },
  { key: "catchments",  label: "Catchments",      icon: "▣", info: "The 7 sewer drainage areas in Somerville. Each must be fully separated before CSO discharges to that waterway can stop." },
  { key: "stormInlets", label: "Storm drains",    icon: "◉", info: "3,659 catch basins and storm drains. Dense clusters = high runoff areas, good candidates for bundled separation work." },
];

export default function FilterPanel({ filters, onFiltersChange, layers, onLayersChange }) {
  const toggle = (key) =>
    onFiltersChange({ ...filters, priorities: { ...filters.priorities, [key]: !filters.priorities[key] } });

  const setScore = (val) =>
    onFiltersChange({ ...filters, minScore: Number(val) });

  const setAge = (val) =>
    onFiltersChange({ ...filters, minAge: Number(val) });

  const toggleLayer = (key) =>
    onLayersChange({ ...layers, [key]: !layers[key] });

  return (
    <div className="filter-panel">

      {/* priority toggles */}
      <div className="fp-section">
        <div className="fp-label">
          Priority
          <Tooltip text="Filter pipes by readiness tier. High ≥50, Medium 35–50, Low <35. Based on the weighted 5-factor score." />
        </div>
        <div className="fp-pills">
          {PRIORITIES.map(p => {
            const active = filters.priorities[p.key];
            return (
              <button
                key={p.key}
                className="fp-pill"
                onClick={() => toggle(p.key)}
                style={{
                  background:  active ? p.dim : "transparent",
                  color:       active ? p.color : "var(--text-3)",
                  borderColor: active ? p.border : "var(--border)",
                }}
              >
                <span className="fp-dot" style={{ background: active ? p.color : "var(--text-3)" }} />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* score range */}
      <div className="fp-section">
        <div className="fp-label-row">
          <span className="fp-label">
            Min score
            <Tooltip text="Only show pipes with a readiness score above this value. Score range in this dataset is 13–63." />
          </span>
          <span className="fp-val">{filters.minScore}</span>
        </div>
        <input
          type="range" className="fp-slider"
          min={0} max={60} step={1}
          value={filters.minScore}
          onChange={e => setScore(e.target.value)}
        />
        <div className="fp-slider-labels"><span>0</span><span>60</span></div>
      </div>

      {/* pipe age */}
      <div className="fp-section">
        <div className="fp-label-row">
          <span className="fp-label">
            Min pipe age
            <Tooltip text="Filter to pipes older than this age. The oldest pipe in Somerville's network is 158 years old (installed ~1868)." />
          </span>
          <span className="fp-val">{filters.minAge > 0 ? `${filters.minAge} yrs` : "any"}</span>
        </div>
        <input
          type="range" className="fp-slider"
          min={0} max={160} step={10}
          value={filters.minAge}
          onChange={e => setAge(e.target.value)}
        />
        <div className="fp-slider-labels"><span>any</span><span>160 yrs</span></div>
      </div>

      {/* layer toggles */}
      <div className="fp-section fp-section-last">
        <div className="fp-label">Layers</div>
        {LAYERS.map(l => (
          <button
            key={l.key}
            className="fp-layer-row"
            onClick={() => toggleLayer(l.key)}
          >
            <span className="fp-layer-icon">{l.icon}</span>
            <span className="fp-layer-label">{l.label}</span>
            <Tooltip text={l.info} />
            <span className={`fp-switch ${layers[l.key] ? "on" : ""}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
