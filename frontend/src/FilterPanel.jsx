import { useState } from "react";
import Tooltip from "./Tooltip";

const LAYERS = [
  { key: "pipes",       label: "Criticality",     icon: "━", info: "2,404 combined-sewer segments scored 0–100 by construction criticality. Red = most critical, green = least." },
  { key: "roads",       label: "Road condition",  icon: "━", info: "5,080 Cyvl-scanned road segments by pavement score. Red = failing, green = good." },
  { key: "sewerNet",    label: "Sewer network",   icon: "━", info: "Raw sewer network in one color for spatial reference." },
  { key: "heatmap",     label: "Heat map",        icon: "◈", info: "Density heatmap weighted by criticality — bright zones = clusters of urgent pipes." },
  { key: "waterMains",  label: "Water pipes",     icon: "━", info: "8,028 water distribution pipes. Overlap with sewer = one trench fixes both." },
  { key: "waterRisk",   label: "Water risk",      icon: "━", info: "2,061 water pipes by city risk model. Red Failing → green Low Risk." },
  { key: "stormInlets", label: "Storm drains",    icon: "◉", info: "3,659 catch basins / storm drains." },
  { key: "catchments",  label: "Catchments",      icon: "▣", info: "The 7 sewer drainage areas; each must be fully separated to stop its CSO." },
];

const FACTORS = [
  ["f1", "PAVEMENT"], ["f2", "PIPE AGE"], ["f3", "DIG COST"],
  ["f4", "BUNDLING"], ["f5", "NETWORK"], ["f6", "WATER RISK"],
];

const TIERS = [
  { key: "high",   label: "CRIT", cls: "red" },
  { key: "medium", label: "MOD",  cls: "amber" },
  { key: "low",    label: "LOW",  cls: "green" },
];

function Range({ label, unit, min, max, step, lo, hi, onLo, onHi, info }) {
  return (
    <div className="fp-sec">
      <div className="fp-sec-title">{label}{info && <Tooltip text={info} />}<span className="fp-readout">{lo}{unit}–{hi}{unit}</span></div>
      <input type="range" className="fp-slider lo" min={min} max={max} step={step} value={lo} onChange={e => onLo(Math.min(Number(e.target.value), hi))} />
      <input type="range" className="fp-slider hi" min={min} max={max} step={step} value={hi} onChange={e => onHi(Math.max(Number(e.target.value), lo))} />
    </div>
  );
}

export default function FilterPanel({ filters, onFiltersChange, layers, onLayersChange, options, defaults, visibleCount, total }) {
  const [showFactors, setShowFactors] = useState(false);
  const set = (patch) => onFiltersChange({ ...filters, ...patch });
  const toggleTier = (k) => set({ priorities: { ...filters.priorities, [k]: !filters.priorities[k] } });
  const setFactor = (k, v) => set({ factorMins: { ...filters.factorMins, [k]: Number(v) } });
  const toggleLayer = (k) => onLayersChange({ ...layers, [k]: !layers[k] });
  const dirty = JSON.stringify(filters) !== JSON.stringify(defaults);

  return (
    <div className="fp-panel">
      <div className="fp-head">
        <span>FILTERS</span>
        <span className="fp-count">{visibleCount.toLocaleString()}/{total.toLocaleString()}</span>
        {dirty && <button className="fp-reset" onClick={() => onFiltersChange(defaults)}>RESET</button>}
      </div>

      <div className="fp-body">
        {/* priority tiers */}
        <div className="fp-sec">
          <div className="fp-sec-title">PRIORITY</div>
          <div className="fp-pills">
            {TIERS.map(t => (
              <button key={t.key} className={`fp-pill ${t.cls} ${filters.priorities[t.key] ? "on" : ""}`} onClick={() => toggleTier(t.key)}>{t.label}</button>
            ))}
          </div>
        </div>

        <Range label="SCORE" unit="" min={0} max={100} step={1} lo={filters.minScore} hi={filters.maxScore}
          onLo={v => set({ minScore: v })} onHi={v => set({ maxScore: v })}
          info="Construction-criticality score. Dataset range is ~13–63." />

        <Range label="PIPE AGE" unit="y" min={0} max={160} step={5} lo={filters.minAge} hi={filters.maxAge}
          onLo={v => set({ minAge: v })} onHi={v => set({ maxAge: v })}
          info="Oldest pipe in the network is 158 years (installed ~1868)." />

        <Range label="PAVEMENT (PCI)" unit="" min={0} max={100} step={1} lo={filters.minPci} hi={filters.maxPci}
          onLo={v => set({ minPci: v })} onHi={v => set({ maxPci: v })}
          info="Cyvl pavement condition index. <40 poor, >70 good." />

        {/* categorical selects */}
        <div className="fp-sec fp-selects">
          <label className="fp-select-row"><span>CATCHMENT</span>
            <select value={filters.catchment} onChange={e => set({ catchment: e.target.value })}>
              <option value="">all</option>
              {options.catchments.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="fp-select-row"><span>MATERIAL</span>
            <select value={filters.material} onChange={e => set({ material: e.target.value })}>
              <option value="">all</option>
              {options.materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="fp-select-row"><span>WATER RISK</span>
            <select value={filters.waterRisk} onChange={e => set({ waterRisk: e.target.value })}>
              <option value="">all</option>
              {options.waterRisks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
        </div>

        {/* flagged basins toggle */}
        <button className={`fp-toggle ${filters.flaggedOnly ? "on" : ""}`} onClick={() => set({ flaggedOnly: !filters.flaggedOnly })}>
          <span className="fp-switch" /> ⚠ FLAGGED CATCH BASIN ONLY
        </button>

        {/* per-factor minimums */}
        <div className="fp-sec">
          <button className={`fp-factors-head ${showFactors ? "open" : ""}`} onClick={() => setShowFactors(s => !s)}>
            <span className="chev">▸</span> FACTOR MINIMUMS
          </button>
          {showFactors && (
            <div className="fp-factors">
              {FACTORS.map(([k, lbl]) => (
                <div className="fp-factor" key={k}>
                  <span className="fp-factor-lbl">{lbl}</span>
                  <input type="range" className="fp-slider" min={0} max={100} step={5} value={filters.factorMins[k]} onChange={e => setFactor(k, e.target.value)} />
                  <span className="fp-factor-val">{filters.factorMins[k]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* layers */}
        <div className="fp-sec fp-layers">
          <div className="fp-sec-title">LAYERS</div>
          {LAYERS.map(l => (
            <button key={l.key} className={`fp-layer-row ${layers[l.key] ? "on" : ""}`} onClick={() => toggleLayer(l.key)}>
              <span className="fp-layer-icon">{l.icon}</span>
              <span className="fp-layer-label">{l.label}</span>
              <Tooltip text={l.info} />
              <span className={`fp-switch ${layers[l.key] ? "on" : ""}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
