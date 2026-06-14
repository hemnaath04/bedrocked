import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import EvidenceCard from "./EvidenceCard";
import FilterPanel from "./FilterPanel";
import SearchBox from "./SearchBox";
import Tooltip from "./Tooltip";
import DataPage from "./DataPage";
import { scoreColor, scoreClass, scoreLabel } from "./utils";

const API = import.meta.env.DEV ? "http://localhost:8000" : "";
const MAP_STYLES = {
  dark:  "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

const CATCHMENT_COLORS = ["#14a0c8","#8b5cf6","#f59e0b","#22c55e","#ec4899","#f97316","#06b6d4"];

const DEFAULT_FILTERS = {
  priorities: { high: true, medium: true, low: true },
  minScore: 0, maxScore: 100,
  minAge: 0, maxAge: 160,
  minPci: 0, maxPci: 100,
  material: "", waterRisk: "", catchment: "",
  flaggedOnly: false,
  factorMins: { f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0 },
  street: "",
};
const DEFAULT_LAYERS = { pipes: true, sewerNet: false, roads: false, catchments: false, stormInlets: false, heatmap: false, waterMains: false, waterRisk: false };

// factor key -> the property name on each segment
const FACTOR_PROP = { f1: "f1_pavement", f2: "f2_age", f3: "f3_depth", f4: "f4_bundling", f5: "f5_network", f6: "f6_water_risk" };
const catchOf = (p) => (p.from_mh || p.id || "").toString().split("-")[0].toUpperCase();

function scoreToClass(s) {
  if (s >= 50) return "high";
  if (s >= 35) return "medium";
  return "low";
}

const HIST_COLORS = ["#2f9e54","#2f9e54","#2f9e54","#e08a16","#e08a16","#d8362a","#d8362a"];
const HIST_LABELS = ["0","10","20","30","40","50","60+"];

function ScoreHistogram({ dist }) {
  if (!dist.length) return null;
  const max = Math.max(...dist, 1);
  const BAR_W = 18, GAP = 3, H = 38;
  const W = dist.length * (BAR_W + GAP) - GAP;
  return (
    <div className="legend-hist">
      <div className="legend-hist-title">SCORE DISTRIBUTION</div>
      <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
        {dist.map((count, i) => {
          const h = Math.max(3, (count / max) * (H - 6));
          const x = i * (BAR_W + GAP);
          return (
            <g key={i}>
              <rect x={x} y={H - h} width={BAR_W} height={h} fill={HIST_COLORS[i]} opacity={0.8} />
              <text x={x + BAR_W / 2} y={H + 11} textAnchor="middle" fontSize="8" fill="var(--text-3)">{HIST_LABELS[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function App() {
  const [geojson, setGeojson]         = useState(null);
  const [filteredGeo, setFilteredGeo] = useState(null);
  const [stats, setStats]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [tooltip, setTooltip]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [theme, setTheme]             = useState("light");
  const [filters, setFilters]         = useState(DEFAULT_FILTERS);
  const [layers, setLayers]           = useState(DEFAULT_LAYERS);
  const [flyTarget, setFlyTarget]     = useState(null);
  const [page, setPage]               = useState("map");
  const mapRef = useRef(null);
  const [catchmentGeo, setCatchmentGeo]   = useState(null);
  const [inletsGeo, setInletsGeo]         = useState(null);
  const [roadsGeo, setRoadsGeo]           = useState(null);
  const [waterMainsGeo, setWaterMainsGeo] = useState(null);
  const [waterRiskGeo, setWaterRiskGeo]   = useState(null);
  const [scoreDist, setScoreDist]     = useState([]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  // load main data
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/segments`).then(r => r.json()),
      fetch(`${API}/api/stats`).then(r => r.json()),
    ]).then(([fc, s]) => {
      const features = fc.features.map(f => {
        const [r, g, b] = scoreColor(f.properties.score);
        return { ...f, properties: { ...f.properties, _r: r, _g: g, _b: b } };
      });
      const geo = { ...fc, features };
      setGeojson(geo);
      setFilteredGeo(geo);
      setStats(s);
      setLoading(false);
      const bins = Array(7).fill(0);
      features.forEach(f => { bins[Math.min(Math.floor(f.properties.score / 10), 6)]++; });
      setScoreDist(bins);
    });
  }, []);

  // data-driven filter option lists, derived from the actual segments
  const options = useMemo(() => {
    if (!geojson) return { materials: [], catchments: [], waterRisks: [] };
    const mat = new Set(), cat = new Set(), wr = new Set();
    for (const f of geojson.features) {
      const p = f.properties;
      if (p.material) mat.add(p.material);
      const c = catchOf(p); if (c) cat.add(c);
      if (p.water_risk_quad) wr.add(p.water_risk_quad);
    }
    return {
      materials: [...mat].sort(),
      catchments: [...cat].sort(),
      waterRisks: [...wr].sort((a, b) => ["Failing","High Risk","Maintenance & Monitoring","Low Risk","None"].indexOf(a) - ["Failing","High Risk","Maintenance & Monitoring","Low Risk","None"].indexOf(b)),
    };
  }, [geojson]);

  // lazy layer data
  useEffect(() => {
    if (layers.roads && !roadsGeo) fetch("/roads.geojson").then(r => r.json()).then(setRoadsGeo);
    if (layers.catchments && !catchmentGeo) fetch("/catchments.geojson").then(r => r.json()).then(fc => {
      setCatchmentGeo({ ...fc, features: fc.features.map((f, i) => ({ ...f, properties: { ...f.properties, _color: CATCHMENT_COLORS[i % CATCHMENT_COLORS.length] } })) });
    });
    if (layers.stormInlets && !inletsGeo) fetch("/storm_inlets.geojson").then(r => r.json()).then(setInletsGeo);
    if (layers.waterMains && !waterMainsGeo) fetch("/water_mains.geojson").then(r => r.json()).then(setWaterMainsGeo);
    if (layers.waterRisk && !waterRiskGeo) fetch("/water_pipe_risk.geojson").then(r => r.json()).then(setWaterRiskGeo);
  }, [layers, catchmentGeo, inletsGeo, roadsGeo, waterMainsGeo, waterRiskGeo]);

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: flyTarget.zoom ?? 15, duration: 1200 });
    setFlyTarget(null);
  }, [flyTarget]);

  // apply the full filter set
  useEffect(() => {
    if (!geojson) return;
    const fl = filters;
    const streetLower = (fl.street || "").toLowerCase();
    const features = geojson.features.filter(f => {
      const p = f.properties;
      if (!fl.priorities[scoreToClass(p.score)]) return false;
      if (p.score < fl.minScore || p.score > fl.maxScore) return false;
      const age = p.pipe_age || 0;
      if (fl.minAge > 0 && age < fl.minAge) return false;
      if (fl.maxAge < 160 && age > fl.maxAge) return false;
      const pci = p.pci ?? 100;
      if (pci < fl.minPci || pci > fl.maxPci) return false;
      if (fl.material && p.material !== fl.material) return false;
      if (fl.waterRisk && p.water_risk_quad !== fl.waterRisk) return false;
      if (fl.catchment && catchOf(p) !== fl.catchment) return false;
      if (fl.flaggedOnly && !p.flagged_basin_nearby) return false;
      for (const k in FACTOR_PROP) if ((p[FACTOR_PROP[k]] ?? 0) < (fl.factorMins[k] || 0)) return false;
      if (streetLower && !(p.street_name ?? "").toLowerCase().includes(streetLower)) return false;
      return true;
    });
    setFilteredGeo({ ...geojson, features });
  }, [filters, geojson]);

  const onSearchResult = useCallback((result) => {
    if (!result) { setFilters(DEFAULT_FILTERS); return; }
    if (result.filters) {
      setFilters(prev => ({
        ...prev,
        priorities: { ...prev.priorities, ...result.filters.priorities },
        minScore: result.filters.minScore ?? prev.minScore,
        maxScore: result.filters.maxScore ?? prev.maxScore,
        minAge:   result.filters.minAge   ?? prev.minAge,
        maxAge:   result.filters.maxAge   ?? prev.maxAge,
        minPci:   result.filters.minPci   ?? prev.minPci,
        maxPci:   result.filters.maxPci   ?? prev.maxPci,
        street:   result.filters.street   ?? "",
      }));
    }
    if (result.flyTo) setFlyTarget(result.flyTo);
    if (result.highlightId) {
      const feat = geojson?.features.find(f => f.properties.id === result.highlightId);
      if (feat) setSelected(feat);
    }
  }, [geojson]);

  const onMapClick  = useCallback(e => setSelected(e.features?.[0] ?? null), []);
  const onMouseMove = useCallback(e => {
    const feat = e.features?.[0];
    setTooltip(feat ? { x: e.point.x, y: e.point.y, props: feat.properties } : null);
  }, []);

  const isDark = theme === "dark";
  const visibleCount = filteredGeo?.features.length ?? 0;
  const total = stats?.total_segments ?? 0;

  return (
    <>
      <div className="topbar">
        <div className="topbar-brand">
          <div className="logo">BED<span>ROCKED</span></div>
          <div className="sub">SOMERVILLE · MA</div>
        </div>
        <div className="cyvl-source">
          <span className="cyvl-dot">◉</span> DATA · <b>CYVL</b> SCAN
          <Tooltip text={<><strong>Live Cyvl data</strong>Pavement 5,080 · catch basins 381 · above-ground assets 8,254 · signs 3,782 · street-level imagery — pulled from Cyvl project f15b854a. Sewer network from Somerville GIS. Click any segment for the live Cyvl scan photo.</>} />
        </div>

        {stats && (
          <div className="topbar-stats">
            <div className="stat-metric"><div className="stat-num red">{stats.high_priority}</div><div className="stat-lbl">▲ CRITICAL <Tooltip text="Score ≥50. Old pipes under failing pavement with high bundling potential — act now." /></div></div>
            <div className="stat-sep" />
            <div className="stat-metric"><div className="stat-num amber">{stats.medium_priority.toLocaleString()}</div><div className="stat-lbl">◆ MODERATE <Tooltip text="Score 35–50. Good candidates once critical segments are underway." /></div></div>
            <div className="stat-sep" />
            <div className="stat-metric"><div className="stat-num green">{stats.low_priority}</div><div className="stat-lbl">▼ LOW <Tooltip text="Score <35. Newer infrastructure or shallower pavement impact." /></div></div>
            <div className="stat-sep" />
            <div className="stat-metric"><div className="stat-num blue">{stats.total_segments.toLocaleString()}</div><div className="stat-lbl">SEGMENTS <Tooltip text="Total combined-sewer segments scored for construction criticality." /></div></div>
            <div className="stat-distrib">
              <div className="stat-distrib-seg" style={{ flex: stats.high_priority,   background: "var(--red)" }} />
              <div className="stat-distrib-seg" style={{ flex: stats.medium_priority, background: "var(--amber)" }} />
              <div className="stat-distrib-seg" style={{ flex: stats.low_priority,    background: "var(--green)" }} />
            </div>
          </div>
        )}

        <nav className="topbar-nav">
          <button className={`nav-tab ${page === "map"  ? "active" : ""}`} onClick={() => setPage("map")}>MAP</button>
          <button className={`nav-tab ${page === "data" ? "active" : ""}`} onClick={() => setPage("data")}>DATA</button>
        </nav>
        <button className="theme-toggle" onClick={() => setTheme(isDark ? "light" : "dark")}>{isDark ? "☀" : "☾"}</button>
      </div>

      {page === "data" && <DataPage />}

      {page === "map" && <>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">ACQUIRING SOMERVILLE SEWER NETWORK…</div>
        </div>
      )}

      <div className="map-wrap">
        <div className="map-grid" />
        <Map
          initialViewState={{ longitude: -71.096, latitude: 42.3875, zoom: 13.5 }}
          ref={mapRef}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLES[theme]}
          interactiveLayerIds={["pipes", "catchment-fill"]}
          onClick={onMapClick}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setTooltip(null)}
          cursor={tooltip ? "pointer" : "grab"}
        >
          <NavigationControl position="top-left" style={{ top: 8 }} />

          {layers.sewerNet && geojson && (
            <Source id="sewer-net" type="geojson" data={geojson}>
              <Layer id="sewer-net-layer" type="line" paint={{ "line-color": "#3a4658", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3], "line-opacity": 0.5 }} />
            </Source>
          )}
          {layers.roads && roadsGeo && (
            <Source id="roads" type="geojson" data={roadsGeo}>
              <Layer id="roads-layer" type="line" paint={{ "line-color": ["step", ["get", "pci_score"], "#ef4444", 40, "#f59e0b", 70, "#22c55e"], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 5], "line-opacity": 0.6 }} />
            </Source>
          )}
          {layers.waterMains && waterMainsGeo && (
            <Source id="water-mains" type="geojson" data={waterMainsGeo}>
              <Layer id="water-mains-layer" type="line" paint={{ "line-color": "#3b82f6", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3], "line-opacity": 0.7 }} />
            </Source>
          )}
          {layers.waterRisk && waterRiskGeo && (
            <Source id="water-risk" type="geojson" data={waterRiskGeo}>
              <Layer id="water-risk-layer" type="line" paint={{ "line-color": ["match", ["get", "RiskQuad"], "Failing", "#ef4444", "High Risk", "#f97316", "Maintenance & Monitoring", "#f59e0b", "#22c55e"], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 16, 4], "line-opacity": 0.8 }} />
            </Source>
          )}
          {layers.catchments && catchmentGeo && (
            <Source id="catchments" type="geojson" data={catchmentGeo}>
              <Layer id="catchment-fill" type="fill" paint={{ "fill-color": ["get", "_color"], "fill-opacity": 0.06 }} />
              <Layer id="catchment-line" type="line" paint={{ "line-color": ["get", "_color"], "line-width": 1, "line-opacity": 0.6, "line-dasharray": [3, 3] }} />
              <Layer id="catchment-label" type="symbol" layout={{ "text-field": ["get", "SumTribIn"], "text-size": 12, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"] }} paint={{ "text-color": ["get", "_color"], "text-halo-color": "#05070b", "text-halo-width": 2 }} />
            </Source>
          )}
          {layers.stormInlets && inletsGeo && (
            <Source id="inlets" type="geojson" data={inletsGeo}>
              <Layer id="inlets-layer" type="circle" paint={{ "circle-color": "#5fd3f3", "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 4], "circle-opacity": 0.7, "circle-stroke-color": "#05070b", "circle-stroke-width": 1 }} />
            </Source>
          )}
          {layers.heatmap && filteredGeo && (
            <Source id="sewer-heat" type="geojson" data={filteredGeo}>
              <Layer id="pipe-heatmap" type="heatmap" paint={{
                "heatmap-weight": ["interpolate", ["linear"], ["get", "score"], 0, 0, 100, 1],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.2, 13, 0.5, 16, 1.2],
                "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.3, "rgba(34,197,94,0.7)", 0.6, "rgba(245,158,11,0.85)", 0.85, "rgba(239,68,68,0.95)", 1.0, "rgba(255,60,10,1)"],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 13, 10, 15, 16, 17, 24],
                "heatmap-opacity": 0.85,
              }} />
            </Source>
          )}
          {layers.pipes && filteredGeo && (
            <Source id="sewers" type="geojson" data={filteredGeo}>
              <Layer id="pipes-glow" type="line" paint={{ "line-color": ["rgb", ["get", "_r"], ["get", "_g"], ["get", "_b"]], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 5, 16, 12], "line-opacity": 0.22, "line-blur": 6 }} />
              <Layer id="pipes" type="line" paint={{ "line-color": ["rgb", ["get", "_r"], ["get", "_g"], ["get", "_b"]], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.4, 14, 2.6, 16, 4.5], "line-opacity": 0.95 }} />
              {selected && (
                <Layer id="pipes-selected" type="line" filter={["==", ["get", "id"], selected.properties.id]}
                  paint={{ "line-color": "#2438ff", "line-width": 5, "line-opacity": 1, "line-gap-width": 1 }} />
              )}
            </Source>
          )}
        </Map>
      </div>

      <SearchBox onResult={onSearchResult} visibleCount={visibleCount} />

      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        layers={layers}
        onLayersChange={setLayers}
        options={options}
        defaults={DEFAULT_FILTERS}
        visibleCount={visibleCount}
        total={total}
      />

      <div className="legend">
        <div className="legend-title">CONSTRUCTION CRITICALITY
          <span className="legend-count">{visibleCount.toLocaleString()} / {total.toLocaleString()} shown</span>
        </div>
        <div className="legend-gradient" />
        <div className="legend-labels"><span>0 · LOW</span><span>MED</span><span>HIGH · 100</span></div>
        <ScoreHistogram dist={scoreDist} />
      </div>

      <div className="export-bar">
        <a className="btn btn-ghost" href={`${API}/api/export/csv`} download>↓ CSV</a>
        <a className="btn btn-solid" href={`${API}/api/export/geojson`} download>↓ GEOJSON</a>
      </div>

      <EvidenceCard feature={selected} onClose={() => setSelected(null)} />

      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 60 }}>
          <div className="tt-score" style={{ color: `rgb(${scoreColor(tooltip.props.score).join(",")})` }}>{tooltip.props.score}</div>
          <div className="tt-label" style={{ color: `rgb(${scoreColor(tooltip.props.score).join(",")})` }}>{scoreLabel(tooltip.props.score)}</div>
          {tooltip.props.street_name && <div className="tt-street">{tooltip.props.street_name}</div>}
        </div>
      )}
      </>}
    </>
  );
}
