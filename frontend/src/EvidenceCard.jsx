import { scoreClass, scoreLabel } from "./utils";

const FACTOR_COLORS = {
  f1: "#14a0c8",
  f2: "#8b5cf6",
  f3: "#f59e0b",
  f4: "#22c55e",
  f5: "#ec4899",
};

function FactorRow({ label, weight, value, colorKey }) {
  return (
    <div className="factor-row">
      <span className="factor-label">{label}</span>
      <span className="factor-weight">{weight}</span>
      <div className="factor-track">
        <div
          className="factor-fill"
          style={{ width: `${value}%`, background: FACTOR_COLORS[colorKey] }}
        />
      </div>
      <span className="factor-val">{value.toFixed(0)}</span>
    </div>
  );
}

function MetaItem({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="meta-item">
      <div className="m-label">{label}</div>
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
      {/* image */}
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
        {/* header */}
        <div className="card-header">
          <div className="card-street">{p.street_name || "Unnamed Segment"}</div>
          <div className="card-pipe-id">{p.id}</div>
        </div>

        {/* score block */}
        <div className="card-score-block">
          <div className="score-left">
            <span className={`score-num ${sc}`}>{p.score}</span>
            <span className="score-denom">/100</span>
          </div>
          <span className={`score-badge ${sc}`}>{scoreLabel(p.score)}</span>
        </div>

        {/* factor breakdown */}
        <div className="card-section-title">Readiness Breakdown</div>
        <div className="factors-list">
          <FactorRow label="Pavement urgency" weight="30%" value={p.f1_pavement} colorKey="f1" />
          <FactorRow label="Pipe age"         weight="25%" value={p.f2_age}      colorKey="f2" />
          <FactorRow label="Dig cost"         weight="20%" value={p.f3_depth}    colorKey="f3" />
          <FactorRow label="Bundling value"   weight="15%" value={p.f4_bundling} colorKey="f4" />
          <FactorRow label="Network leverage" weight="10%" value={p.f5_network}  colorKey="f5" />
        </div>

        {/* pipe metadata */}
        <div className="card-section-title">Pipe Details</div>
        <div className="card-meta-grid">
          <MetaItem label="Installed"   value={p.install_year} />
          <MetaItem label="Age"         value={p.pipe_age ? `${p.pipe_age} yrs` : "Unknown"} />
          <MetaItem label="PCI Score"   value={p.pci} />
          <MetaItem label="Diameter"    value={p.diameter_in > 0 ? `${p.diameter_in}"` : "—"} />
          <MetaItem label="Material"    value={p.material || "—"} />
          <MetaItem label="Assets nearby" value={p.asset_count} />
        </div>
      </div>
    </div>
  );
}
