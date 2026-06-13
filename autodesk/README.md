# Sewershed × Autodesk Platform Services

Pushes the Sewershed **dig-plan into the Autodesk Viewer** — every combined-sewer
street becomes a 3D bar (height + color = dig-readiness) that's individually
selectable, so the city's engineers inspect the plan in the same CAD environment
they already use. Built on Cyvl's reference APS pipeline (`xavier-cyvl/hackathonBuckets`).

```
OBJ+MTL (per-street `o` groups)  ->  zip  ->  OSS signed-S3 upload
   ->  Model Derivative SVF2  ->  URN  ->  APS Viewer (selectable nodes)
```

## Run (3 steps)

```bash
pip install -r requirements.txt

# 1. credentials — free app at https://aps.autodesk.com (My Apps → Create App)
cp .env.example .env        # paste APS_CLIENT_ID / APS_CLIENT_SECRET

# 2. build the scene + push to Autodesk (prints a URN, writes viewer/urn.txt)
python build_scene.py
python run_aps.py

# 3. serve a viewer token and open the scene
python viewer/token_server.py     # → http://localhost:8080
```

Click any street bar → its name, catchment, readiness score and flags (clogged
basin, failing water main) appear. Red = dig first, amber = soon, green = later;
taller = more urgent.

## Files
| file | role |
|---|---|
| `build_scene.py` | `data/scored_streets.geojson` → `out/scene.obj` + `.mtl` + `scene_meta.json` |
| `aps_client.py` | APS auth · OSS upload · Model Derivative (adapted from Cyvl's repo) |
| `run_aps.py` | build → zip → upload → translate → URN |
| `viewer/` | token server + APS Viewer page (Z-up fix, per-object selection panel) |

## Notes (from Cyvl's findings, kept honest)
- Viewer token must be `data:read` — `viewer:read` 400s on 2-legged OAuth.
- OBJ+MTL must be **zipped** with `rootFilename: scene.obj` or colors render gray.
- SVF2 caches per object key — `run_aps.py` versions the key each run.
- Geometry is Z-up; the viewer applies `setWorldUpVector(0,0,1)`.
