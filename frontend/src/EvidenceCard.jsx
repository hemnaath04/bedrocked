import { scoreClass, scoreLabel } from "./utils";
import Tooltip from "./Tooltip";

const FACTOR_COLORS = {
  f1: "#14a0c8",
  f2: "#8b5cf6",
  f3: "#f59e0b",
  f4: "#22c55e",
  f5: "#ec4899",
  f6: "#ef4444",
};

const FACTOR_INFO = {
  f1: { title: "Pavement urgency (30%)", body: "Average PCI score of road segments within 50m. Low PCI = failing pavement = high urgency to dig now and repave in the same trench." },
  f2: { title: "Pipe age (25%)",         body: "Age of the pipe from install date. Older pipes are more likely to fail and are higher priority for separation. Max scale = 150 years." },
  f3: { title: "Dig cost (20%)",         body: "Estimated excavation depth from invert elevations. Shallower pipes cost less to dig, making separation more economical." },
  f4: { title: "Bundling value (15%)",   body: "Count of ADA ramps, catch basins, manholes, and sidewalks within 50m. More assets = more value from one open trench." },
  f5: { title: "Network leverage (8%)",  body: "Whether this pipe's upstream or downstream manhole connects to an already-separated pipe. Completing connected runs finishes catchments faster." },
  f6: { title: "Water co-risk (12%)",    body: "Risk rating of the nearest water main from Somerville's water pipe risk model. A failing water main alongside a combined sewer is a prime dig-once opportunity — the city will need to excavate anyway." },
};

const META_INFO = {
  "Installed":     "Year the pipe was originally installed, from Somerville's sewer GIS.",
  "Age":           "How old the pipe is in 2026. Pipes over 100 years are well past their design life.",
  "PCI Score":     "Pavement Condition Index (0–100) from Cyvl's street scan. Below 40 = poor, above 70 = good.",
  "Diameter":      "Internal pipe diameter in inches. Larger pipes handle more flow but cost more to replace.",
  "Material":      "Pipe construction material. Older clay and brick pipes are more prone to infiltration and collapse.",
  "Assets nearby":  "Number of bundlable infrastructure assets (ADA ramps, catch basins, sidewalks) within 50m of this pipe.",
  "Water risk":     "Risk quadrant of the nearest water main per Somerville DPW's pipe risk model. Failing = high likelihood AND high consequence of failure.",
};

const SCORE_INFO = "Weighted readiness score 0–100. Higher = more urgent and cost-effective to separate now. Combines pavement condition, pipe age, dig cost, bundling potential, network position, and water main co-risk.";

const WATER_RISK_COLOR = {
  "Failing":                  "#ef4444",
  "High Risk":                "#f97316",
  "Maintenance & Monitoring": "#f59e0b",
  "Low Risk":                 "#22c55e",
  "None":                     "#6b7280",
};

function FactorRow({ label, weight, value, colorKey }) {
  const info = FACTOR_INFO[colorKey];
  return (
    <div className="factor-row">
      <span className="factor-label">
        {label}
        <Tooltip text={<><strong>{info.title}</strong>{info.body}</>} />
      </span>
      <span className="factor-weight">{weight}</span>
      <div className="factor-track">
        <div className="factor-fill" style={{ width: `${value}%`, background: FACTOR_COLORS[colorKey] }} />
      </div>
      <span className="factor-val">{value.toFixed(0)}</span>
    </div>
  );
}

function MetaItem({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="meta-item">
      <div className="m-label">
        {label}
        {META_INFO[label] && <Tooltip text={META_INFO[label]} />}
      </div>
      <div className="m-val">{value}</div>
    </div>
  );
}

export default function EvidenceCard({ feature, onClose }) {
  if (!feature) return null;
  const p = feature.properties;
  const sc = scoreClass(p.score);

  return (
    <div className="evidence-card">
      <div className="card-img-wrap">
        <div className={`card-accent ${sc}`} />
        {p.image_url ? (
          <img className="card-img" src={p.image_url} alt="Street view" />
        ) : (
          <div className="card-img-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            <span>No imagery</span>
          </div>
        )}
        <button className="card-close" onClick={onClose}>✕</button>
      </div>

      <div className="card-body">
        <div className="card-header">
          <div className="card-street">{p.street_name || "Unnamed Segment"}</div>
          <div className="card-pipe-id">{p.id}</div>
        </div>

        <div className="card-score-block">
          <div className="score-left">
            <span className={`score-num ${sc}`}>{p.score}</span>
            <span className="score-denom">/100</span>
            <Tooltip text={SCORE_INFO} />
          </div>
          <span className={`score-badge ${sc}`}>{scoreLabel(p.score)}</span>
        </div>

        <div className="card-section-title">Readiness Breakdown</div>
        <div className="factors-list">
          <FactorRow label="Pavement urgency" weight="30%" value={p.f1_pavement} colorKey="f1" />
          <FactorRow label="Pipe age"         weight="25%" value={p.f2_age}      colorKey="f2" />
          <FactorRow label="Dig cost"         weight="20%" value={p.f3_depth}    colorKey="f3" />
          <FactorRow label="Bundling value"   weight="12%" value={p.f4_bundling}   colorKey="f4" />
          <FactorRow label="Network leverage" weight="8%"  value={p.f5_network}   colorKey="f5" />
          <FactorRow label="Water co-risk"    weight="12%" value={p.f6_water_risk ?? 0} colorKey="f6" />
        </div>

        <div className="card-section-title">Pipe Details</div>
        <div className="card-meta-grid">
          <MetaItem label="Installed"      value={p.install_year} />
          <MetaItem label="Age"            value={p.pipe_age ? `${p.pipe_age} yrs` : "Unknown"} />
          <MetaItem label="PCI Score"      value={p.pci} />
          <MetaItem label="Diameter"       value={p.diameter_in > 0 ? `${p.diameter_in}"` : "—"} />
          <MetaItem label="Material"       value={p.material || "—"} />
          <MetaItem label="Assets nearby"  value={p.asset_count} />
          {p.water_risk_quad && p.water_risk_quad !== "None" && (
            <div className="meta-item">
              <div className="m-label">
                Water risk
                <Tooltip text={META_INFO["Water risk"]} />
              </div>
              <div className="m-val" style={{ color: WATER_RISK_COLOR[p.water_risk_quad] ?? "#fff", fontWeight: 600 }}>
                {p.water_risk_quad}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
