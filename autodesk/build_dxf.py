"""
Sewershed dig-plan -> AutoCAD DXF (no APS account needed).

Each combined-sewer street is an LWPOLYLINE on a layer by readiness tier, with a
TEXT label (rank + street + score). Opens directly in AutoCAD, AutoCAD Web
(web.autocad.com), or the Autodesk Viewer. This is the offline Autodesk artifact.

  python build_dxf.py   ->  out/sewershed_digplan.dxf
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "scored_streets.geojson"
OUT = Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
DXF = OUT / "sewershed_digplan.dxf"

# readiness tier -> (layer name, AutoCAD color index)
TIERS = [
    ("READY_HIGH_dig_first", 1, lambda r: r >= 50),   # red
    ("READY_MED_soon", 30, lambda r: 35 <= r < 50),    # orange
    ("READY_LOW_later", 3, lambda r: r < 35),          # green
]
LABEL_LAYER = "DIG_ORDER_LABELS"

def line_coords(g):
    if g["type"] == "LineString":
        return g["coordinates"]
    if g["type"] == "MultiLineString":
        return [p for part in g["coordinates"] for p in part]
    return []

def main():
    feats = [f for f in json.loads(SRC.read_text())["features"] if line_coords(f.get("geometry") or {})]
    ranked = sorted(feats, key=lambda f: f["properties"].get("score", 0), reverse=True)

    # project lng/lat -> local metres about centroid
    sx = sy = n = 0
    for f in ranked:
        for c in line_coords(f["geometry"]):
            sx += c[0]; sy += c[1]; n += 1
    lon0, lat0 = sx / n, sy / n
    mlon = 111320 * math.cos(math.radians(lat0)); mlat = 110540
    px = lambda lng: (lng - lon0) * mlon
    py = lambda lat: (lat - lat0) * mlat

    out = []
    w = out.append
    def pair(code, val): w(str(code)); w(str(val))

    # HEADER
    pair(0, "SECTION"); pair(2, "HEADER")
    pair(9, "$ACADVER"); pair(1, "AC1015")
    pair(9, "$INSUNITS"); pair(70, 6)  # metres
    pair(0, "ENDSEC")

    # TABLES / LAYER
    pair(0, "SECTION"); pair(2, "TABLES"); pair(0, "TABLE"); pair(2, "LAYER")
    layers = [(t[0], t[1]) for t in TIERS] + [(LABEL_LAYER, 7)]
    pair(70, len(layers))
    for name, color in layers:
        pair(0, "LAYER"); pair(2, name); pair(70, 0); pair(62, color); pair(6, "CONTINUOUS")
    pair(0, "ENDTAB"); pair(0, "ENDSEC")

    # ENTITIES
    pair(0, "SECTION"); pair(2, "ENTITIES")
    for i, f in enumerate(ranked):
        p = f["properties"]
        r = float(p.get("score", 0))
        layer = next(name for name, _c, test in TIERS if test(r))
        pts = line_coords(f["geometry"])
        # LWPOLYLINE
        pair(0, "LWPOLYLINE"); pair(8, layer); pair(90, len(pts)); pair(70, 0)
        for c in pts:
            pair(10, f"{px(c[0]):.3f}"); pair(20, f"{py(c[1]):.3f}")
        # TEXT label at midpoint
        mid = pts[len(pts) // 2]
        street = (p.get("street_name") or "Unnamed").replace("\n", " ")
        pair(0, "TEXT"); pair(8, LABEL_LAYER)
        pair(10, f"{px(mid[0]):.3f}"); pair(20, f"{py(mid[1]):.3f}"); pair(30, 0)
        pair(40, 4); pair(1, f"{i+1}. {street} [{round(r)}]")
    pair(0, "ENDSEC"); pair(0, "EOF")

    DXF.write_text("\n".join(out))
    print(f"wrote {len(ranked)} streets -> {DXF}")
    print(f"  size: {DXF.stat().st_size//1024} KB")
    print("  open in AutoCAD, web.autocad.com, or the Autodesk Viewer.")

if __name__ == "__main__":
    main()
