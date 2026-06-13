import { useEffect, useState, useCallback } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import EvidenceCard from "./EvidenceCard";
import { scoreColor, scoreClass, scoreLabel } from "./utils";

const API = "http://localhost:8000";
const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export default function App() {
  const [geojson, setGeojson]   = useState(null);
  const [stats, setStats]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [tooltip, setTooltip]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/segments`).then(r => r.json()),
      fetch(`${API}/api/stats`).then(r => r.json()),
    ]).then(([fc, s]) => {
      const features = fc.features.map(f => {
        const [r, g, b] = scoreColor(f.properties.score);
        return { ...f, properties: { ...f.properties, _r: r, _g: g, _b: b } };
      });
      setGeojson({ ...fc, features });
      setStats(s);
      setLoading(false);
    });
  }, []);

  const onMapClick = useCallback(e => {
    const feat = e.features?.[0];
    setSelected(feat ?? null);
  }, []);

  const onMouseMove = useCallback(e => {
    const feat = e.features?.[0];
    setTooltip(feat ? { x: e.point.x, y: e.point.y, props: feat.properties } : null);
  }, []);

  return (
    <>
      {/* ── topbar ── */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="logo">Sewer<span>shed</span></div>
          <div className="sub">Somerville, MA</div>
        </div>

        {stats && (
          <div className="topbar-stats">
            <div className="stat-chip red">
              <div className="chip-val">{stats.high_priority}</div>
              <div className="chip-lbl">High<br/>Priority</div>
            </div>
            <div className="stat-chip amber">
              <div className="chip-val">{stats.medium_priority}</div>
              <div className="chip-lbl">Medium<br/>Priority</div>
            </div>
            <div className="stat-chip green">
              <div className="chip-val">{stats.low_priority}</div>
              <div className="chip-lbl">Low<br/>Priority</div>
            </div>
            <div className="stat-chip blue">
              <div className="chip-val">{stats.total_segments.toLocaleString()}</div>
              <div className="chip-lbl">Combined<br/>Pipes</div>
            </div>
          </div>
        )}
      </div>

      {/* ── loading ── */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Loading Somerville sewer network…</div>
        </div>
      )}

      {/* ── map ── */}
      <div className="map-wrap">
        <Map
          initialViewState={{ longitude: -71.096, latitude: 42.3875, zoom: 13.5 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={["pipes"]}
          onClick={onMapClick}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setTooltip(null)}
          cursor={tooltip ? "pointer" : "grab"}
        >
          <NavigationControl position="top-left" style={{ top: 8 }} />

          {geojson && (
            <Source id="sewers" type="geojson" data={geojson}>
              {/* outer glow */}
              <Layer id="pipes-glow" type="line" paint={{
                "line-color": ["rgb", ["get", "_r"], ["get", "_g"], ["get", "_b"]],
                "line-width": ["interpolate", ["linear"], ["zoom"], 12, 10, 16, 20],
                "line-opacity": 0.06,
                "line-blur": 8,
              }} />
              {/* main line */}
              <Layer id="pipes" type="line" paint={{
                "line-color": ["rgb", ["get", "_r"], ["get", "_g"], ["get", "_b"]],
                "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 14, 3, 16, 5],
                "line-opacity": 0.85,
              }} />
              {/* selected */}
              {selected && (
                <Layer id="pipes-selected" type="line"
                  filter={["==", ["get", "id"], selected.properties.id]}
                  paint={{ "line-color": "#fff", "line-width": 5, "line-opacity": 1,
                           "line-gap-width": 1 }}
                />
              )}
            </Source>
          )}
        </Map>
      </div>

      {/* ── legend ── */}
      <div className="legend">
        <div className="legend-title">Separation Readiness Score</div>
        <div className="legend-gradient" />
        <div className="legend-labels">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
      </div>

      {/* ── export ── */}
      <div className="export-bar">
        <a className="btn btn-ghost" href={`${API}/api/export/csv`} download>
          ↓ CSV
        </a>
        <a className="btn btn-solid" href={`${API}/api/export/geojson`} download>
          ↓ GeoJSON
        </a>
      </div>

      {/* ── evidence card ── */}
      <EvidenceCard feature={selected} onClose={() => setSelected(null)} />

      {/* ── tooltip ── */}
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 60 }}>
          <div className="tt-score" style={{
            color: `rgb(${scoreColor(tooltip.props.score).join(",")})`,
          }}>
            {tooltip.props.score}
          </div>
          <div className="tt-label" style={{
            color: `rgb(${scoreColor(tooltip.props.score).join(",")})`,
          }}>
            {scoreLabel(tooltip.props.score)}
          </div>
          {tooltip.props.street_name && (
            <div className="tt-street">{tooltip.props.street_name}</div>
          )}
        </div>
      )}
    </>
  );
}
