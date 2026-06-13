"""
Offline scoring script — run once to produce data/scored_streets.geojson.
Joins sewer pipe data with Cyvl pavement/asset data and computes a
0-100 readiness score per combined sewer segment.
"""
import json
import math
from pathlib import Path
from shapely.geometry import shape, Point, LineString
from shapely.strtree import STRtree

DATA = Path(__file__).parent.parent / "data"
CYVL = Path(__file__).parent.parent / "cyvl_data"
OUT  = DATA / "scored_streets.geojson"

# ── helpers ──────────────────────────────────────────────────────────────────

def load(path):
    return json.loads(Path(path).read_text())["features"]

def midpoint(geom):
    ls = shape(geom)
    p = ls.interpolate(0.5, normalized=True)
    return p

def epoch_to_year(ms):
    if ms is None or ms == 0:
        return None
    return 1970 + int(ms / 1000 / 60 / 60 / 24 / 365.25)

def normalize(val, lo, hi):
    """Scale val in [lo,hi] to [0,1], clamp."""
    if hi == lo:
        return 0.5
    return max(0.0, min(1.0, (val - lo) / (hi - lo)))

# ── load data ─────────────────────────────────────────────────────────────────

print("Loading sewer pipes...")
all_pipes   = load(DATA / "ss_gravity_mains.geojson")
combined    = [f for f in all_pipes if f["properties"].get("WATERTYPE") == "Combined"]
print(f"  {len(combined)} combined segments")

print("Loading Cyvl data...")
pave_feats  = load(CYVL / "factors" / "factor1_pavement.geojson")
asset_feats = load(CYVL / "factors" / "factor4_bundling_assets.geojson")
img_feats   = load(CYVL / "factors" / "evidence_imagery.geojson")

# ── spatial indices ───────────────────────────────────────────────────────────

print("Building spatial indices...")

pave_geoms  = [shape(f["geometry"]) for f in pave_feats]
pave_tree   = STRtree(pave_geoms)

asset_geoms = [shape(f["geometry"]).centroid for f in asset_feats]
asset_tree  = STRtree(asset_geoms)

img_geoms   = [shape(f["geometry"]).centroid for f in img_feats]
img_tree    = STRtree(img_geoms)

# ── network topology for Factor 5 ─────────────────────────────────────────────

separated_mh = {
    f["properties"].get("FROMMH")
    for f in all_pipes
    if f["properties"].get("WATERTYPE") in ("Storm", "Sewage")
} | {
    f["properties"].get("TOMH")
    for f in all_pipes
    if f["properties"].get("WATERTYPE") in ("Storm", "Sewage")
}

# ── score each segment ────────────────────────────────────────────────────────

SEARCH_DEG = 0.0005   # ~50m in degrees

print("Scoring segments...")
features_out = []

for feat in combined:
    props = feat["properties"]
    geom  = feat["geometry"]

    try:
        line  = shape(geom)
        mid   = line.interpolate(0.5, normalized=True)
    except Exception:
        continue

    buf = mid.buffer(SEARCH_DEG)

    # ── Factor 1 (30%): pavement urgency — low PCI = high score ──────────────
    nearby_pave = pave_tree.query(buf)
    if len(nearby_pave) > 0:
        pcis = [pave_feats[i]["properties"].get("pci_score", 75) for i in nearby_pave]
        avg_pci = sum(pcis) / len(pcis)
    else:
        avg_pci = 75
    f1 = 1.0 - normalize(avg_pci, 0, 100)   # low PCI → high readiness

    # ── Factor 2 (25%): pipe age — older = higher score ─────────────────────
    install_ms = props.get("INSTALLDAT")
    install_yr = epoch_to_year(install_ms)
    if install_yr:
        f2 = normalize(2026 - install_yr, 0, 150)   # max ~150 yr old
    else:
        f2 = 0.5   # unknown age → neutral

    # ── Factor 3 (20%): dig cost — shallower is cheaper (higher score) ───────
    up   = props.get("UpstreamIn") or 0
    down = props.get("Downstream") or 0
    depth = max(up, down)
    if depth > 0:
        f3 = 1.0 - normalize(depth, 0, 30)   # <5 ft shallow, >30 ft very deep
    else:
        f3 = 0.5

    # ── Factor 4 (15%): bundling value — more assets nearby = higher score ───
    nearby_assets = asset_tree.query(buf)
    asset_count = len(nearby_assets)
    f4 = normalize(asset_count, 0, 15)

    # ── Factor 5 (10%): network leverage — connects separated segments ────────
    from_mh = props.get("FROMMH", "")
    to_mh   = props.get("TOMH", "")
    connected_sep = sum([
        1 if from_mh in separated_mh else 0,
        1 if to_mh   in separated_mh else 0,
    ])
    f5 = connected_sep / 2.0

    # ── weighted score 0–100 ─────────────────────────────────────────────────
    score = round((f1*0.30 + f2*0.25 + f3*0.20 + f4*0.15 + f5*0.10) * 100, 1)

    # ── nearest evidence image ────────────────────────────────────────────────
    nearby_imgs = img_tree.query(buf)
    image_url = None
    if len(nearby_imgs) > 0:
        image_url = img_feats[nearby_imgs[0]]["properties"].get("image_url")

    install_year_out = install_yr or "Unknown"
    diameter = props.get("Diameter") or props.get("Width") or 0

    features_out.append({
        "type": "Feature",
        "geometry": geom,
        "properties": {
            "id":           props.get("FACILITYID", props.get("OBJECTID")),
            "street_name":  props.get("Streetname", ""),
            "water_type":   props.get("WATERTYPE"),
            "score":        score,
            "pci":          round(avg_pci, 1),
            "install_year": install_year_out,
            "pipe_age":     2026 - install_yr if install_yr else None,
            "diameter_in":  diameter,
            "material":     props.get("Material", ""),
            "depth_ft":     round(depth, 1) if depth else None,
            "asset_count":  asset_count,
            "network_leverage": connected_sep,
            "image_url":    image_url,
            "from_mh":      from_mh,
            "to_mh":        to_mh,
            # factor breakdown for UI tooltip
            "f1_pavement":  round(f1 * 100, 1),
            "f2_age":       round(f2 * 100, 1),
            "f3_depth":     round(f3 * 100, 1),
            "f4_bundling":  round(f4 * 100, 1),
            "f5_network":   round(f5 * 100, 1),
        }
    })

# sort highest score first
features_out.sort(key=lambda f: f["properties"]["score"], reverse=True)

fc = {"type": "FeatureCollection", "features": features_out}
OUT.write_text(json.dumps(fc))
print(f"\nDone — {len(features_out)} segments → {OUT}")
scores = [f["properties"]["score"] for f in features_out]
print(f"Score range: {min(scores):.1f} – {max(scores):.1f}, avg: {sum(scores)/len(scores):.1f}")
