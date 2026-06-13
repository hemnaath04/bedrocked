"""
Sewershed dig-plan -> Autodesk-ready OBJ+MTL scene.

Each combined-sewer segment becomes a 3D bar following the street: WIDTH fixed,
HEIGHT proportional to dig-readiness, COLOR by readiness tier. Every bar is its
own OBJ `o seg_<id>` group, so Model Derivative turns it into an individually
selectable node (dbId) in the Autodesk Viewer — click a street, read its score,
move/hide it. (This is the trick from Cyvl's reference repo: `o` groups -> nodes.)

Input:  ../data/scored_streets.geojson  (output of backend/scorer.py)
Output: out/scene.obj + out/scene.mtl   (zip together for Model Derivative)
"""
import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "scored_streets.geojson"
OUT = Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)

WIDTH_M = 14.0         # bar width across the street (chunky so it reads at city scale)
H_MIN, H_MAX = 6.0, 70.0   # bar height range (m) — taller = dig first

# readiness tier -> material (flat diffuse colors defined in the MTL)
def tier(r):
    if r >= 50: return "ready_high"
    if r >= 35: return "ready_med"
    return "ready_low"

MATERIALS = {
    # name:        (r, g, b)  0..1   warm editorial ramp, matches the web app
    "ready_high": (0.847, 0.275, 0.184),  # red
    "ready_med":  (0.847, 0.561, 0.169),  # amber
    "ready_low":  (0.306, 0.659, 0.412),  # green
    "ground":     (0.22, 0.19, 0.15),  # warm grey base plane — visible vs viewer bg
}

def line_coords(geom):
    if geom["type"] == "LineString":
        return geom["coordinates"]
    if geom["type"] == "MultiLineString":
        return [p for part in geom["coordinates"] for p in part]
    return []

def main():
    fc = json.loads(SRC.read_text())
    feats = [f for f in fc["features"] if line_coords(f.get("geometry") or {})]

    # projection origin = centroid; project lng/lat -> local metres (shift to ~0,0
    # so the Viewer doesn't jitter on huge UTM-scale floats — reference finding #5)
    sx = sy = n = 0
    for f in feats:
        for c in line_coords(f["geometry"]):
            sx += c[0]; sy += c[1]; n += 1
    lon0, lat0 = sx / n, sy / n
    mlon = 111320 * math.cos(math.radians(lat0))
    mlat = 110540
    px = lambda lng: (lng - lon0) * mlon
    py = lambda lat: (lat - lat0) * mlat

    verts: list[tuple[float, float, float]] = []
    objs: list[tuple[str, str, list[tuple]]] = []  # (name, material, faces)
    meta: dict[str, dict] = {}  # seg_<i> -> {street, score, catchment} for the viewer panel

    def add_vert(x, y, z):
        verts.append((x, y, z))
        return len(verts)  # 1-based OBJ index

    def perp(ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1.0
        return (-dy / L, dx / L)  # unit normal

    minx = miny = 1e18
    maxx = maxy = -1e18
    for i, f in enumerate(feats):
        p = f["properties"]
        r = float(p.get("score", 0))
        h = H_MIN + (max(0.0, min(100.0, r)) / 100.0) * (H_MAX - H_MIN)
        pts = [(px(c[0]), py(c[1])) for c in line_coords(f["geometry"])]
        if len(pts) < 2:
            continue
        for x, y in pts:
            minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)

        # build a raised ribbon following the polyline: top strip at z=h, walls to z=0
        top_l, top_r, bot_l, bot_r = [], [], [], []
        for j, (x, y) in enumerate(pts):
            # average normal of adjacent edges
            if j == 0:
                nx, ny = perp(*pts[0], *pts[1])
            elif j == len(pts) - 1:
                nx, ny = perp(*pts[-2], *pts[-1])
            else:
                n1 = perp(*pts[j - 1], *pts[j]); n2 = perp(*pts[j], *pts[j + 1])
                nx, ny = (n1[0] + n2[0]), (n1[1] + n2[1])
                L = math.hypot(nx, ny) or 1.0; nx, ny = nx / L, ny / L
            ox, oy = nx * WIDTH_M / 2, ny * WIDTH_M / 2
            top_l.append(add_vert(x + ox, y + oy, h))
            top_r.append(add_vert(x - ox, y - oy, h))
            bot_l.append(add_vert(x + ox, y + oy, 0.0))
            bot_r.append(add_vert(x - ox, y - oy, 0.0))

        faces = []
        for j in range(len(pts) - 1):
            # top
            faces.append((top_l[j], top_r[j], top_r[j + 1], top_l[j + 1]))
            # left wall
            faces.append((bot_l[j], top_l[j], top_l[j + 1], bot_l[j + 1]))
            # right wall
            faces.append((top_r[j], bot_r[j], bot_r[j + 1], top_r[j + 1]))
        # end caps
        faces.append((bot_l[0], top_l[0], top_r[0], bot_r[0]))
        faces.append((top_l[-1], bot_l[-1], bot_r[-1], top_r[-1]))
        objs.append((f"seg_{i}", tier(r), faces))
        meta[f"seg_{i}"] = {
            "street": p.get("street_name") or "Unnamed",
            "score": round(r),
            "catchment": (p.get("from_mh") or "").split("-")[0] or "?",
            "flagged_basin": bool(p.get("flagged_basin_nearby")),
            "water_risk": p.get("water_risk_quad", "None"),
        }

    # a ground plane so the scene reads as a city, not floating bars
    g1 = add_vert(minx - 30, miny - 30, -0.2); g2 = add_vert(maxx + 30, miny - 30, -0.2)
    g3 = add_vert(maxx + 30, maxy + 30, -0.2); g4 = add_vert(minx - 30, maxy + 30, -0.2)
    objs.append(("ground_plane", "ground", [(g1, g2, g3, g4)]))

    # ── write MTL ──
    mtl = []
    for name, (r, g, b) in MATERIALS.items():
        mtl += [f"newmtl {name}", f"Kd {r:.3f} {g:.3f} {b:.3f}", "Ka 0 0 0", "d 1.0", "illum 1", ""]
    (OUT / "scene.mtl").write_text("\n".join(mtl))

    # ── write OBJ ──
    obj = ["mtllib scene.mtl"]
    for x, y, z in verts:
        obj.append(f"v {x:.3f} {y:.3f} {z:.3f}")  # Z-up; viewer fixes with setWorldUpVector(0,0,1)
    for name, material, faces in objs:
        obj.append(f"o {name}")
        obj.append(f"usemtl {material}")
        for fc_ in faces:
            obj.append("f " + " ".join(str(idx) for idx in fc_))
    (OUT / "scene.obj").write_text("\n".join(obj))
    (OUT / "scene_meta.json").write_text(json.dumps(meta))

    print(f"scene: {len(objs)} objects, {len(verts)} verts")
    print(f"  -> {OUT/'scene.obj'}")
    print(f"  -> {OUT/'scene.mtl'}")
    print(f"origin lon0={lon0:.6f} lat0={lat0:.6f}")

if __name__ == "__main__":
    main()
