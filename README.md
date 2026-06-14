# BedRocked

**Sequencing Somerville's $1.29 B sewer-separation program from data instead of by hand.**

🔗 **Live demo → https://sewershed-bedrocked.vercel.app**

Built at the **Cyvl × Autodesk Physical-AI Hackathon** (Somerville, MA · June 2026).

---

## The problem

Somerville, MA is under a **$1.29 billion, multi-decade mandate** to separate its
combined sewers (pipes that carry sewage and stormwater together and overflow into
the Mystic and Charles during storms). **2,404 street segments are still combined.**
Today the city decides *which streets to dig, and in what order,* largely by hand —
across pavement condition, pipe age, dig depth, nearby assets, and water-main risk.

**BedRocked turns that into a data product:** it scores every combined segment 0–100
for **dig-readiness** and lets a planner sequence the whole program on a map.

## What it does

- 🗺️ **Interactive map** of all 2,404 combined-sewer segments, colored by a weighted
  0–100 readiness score (red = dig first → green = later).
- 🧮 **6-factor scoring model** — pavement urgency, pipe age, dig depth, asset bundling,
  network leverage, and water-main co-risk — joining city sewer GIS to Cyvl's street scan.
- 🧰 **Layer toggles** — road condition (PCI), water mains & risk, catchments, storm
  drains, catch-basin condition, heatmap.
- 🔎 **Plain-English search** — *"high-priority pipes older than 100 years"* — a Claude
  model turns language into a deterministic filter (it never invents numbers; scoped to
  this dataset only).
- 🖼️ **Evidence cards** — click any segment for its score breakdown, pipe facts, and the
  **live Cyvl street-scan photo** as provenance.
- 📐 **Autodesk export** — one-click **DXF dig-plan** (layered by priority) that opens in
  AutoCAD / AutoCAD Web, plus an APS Viewer pipeline that renders the plan in 3D.

## Data & provenance

Two independent, real sources — nothing mocked. Full sheet:
[`docs/Sewershed_Data_Sources.pdf`](docs/Sewershed_Data_Sources.pdf)

| From **Cyvl** (AI street scan) | From **Somerville GIS** (public) |
|---|---|
| Pavement condition — 5,080 segments | Sewer mains — 11 layers, 2,404 combined |
| Catch basins — 381 (+ photos) | Catchments — 7 drainage areas |
| Above-ground assets — 8,254 | Storm inlets — 3,659 |
| Signs 3,782 · markings 7,116 | Water mains 8,028 · risk 2,061 |
| Street-level imagery (live CDN) | Pipe age / depth / material |

Evidence-card photos stream live from Cyvl's CDN — verifiable provenance, not a label.

## The catch-basin condition model (knowledge distillation)

Every Cyvl asset ships with `condition: null`. To fill it for the 381 catch basins:

```
Cyvl photo → crop to the projected asset marker
           → Claude Vision labels 112 crops  (teacher)
           → distilled classifier scores all 381  (student)
```

Honest framing: at 381 basins this proves the *scaling pattern* — the teacher labels
once, the lightweight student then scores every asset for cents, city-wide.

## Architecture

```
                 ┌─────────── Cyvl API / GIS exports ───────────┐
                 │  pavement · assets · imagery · sewer · water  │
                 └───────────────────┬──────────────────────────┘
        spatial join + 6-factor scoring (Python / shapely)
                                     │
                         segments_scored.json  ◀── one precomputed file
                                     │
        ┌────────────────────────────┴───────────────────────────┐
   React + MapLibre map            serverless /api/search (Claude, scoped)
   (Vite, deployed on Vercel)      Autodesk: DXF export + APS Viewer
```

**Stack:** React · Vite · MapLibre GL · Python (shapely, scikit-learn) ·
Anthropic Claude (NL search + vision labeling) · Autodesk Platform Services · Vercel.

## Run locally

```bash
# backend (scoring API)
cd backend && pip install -r requirements.txt && uvicorn main:app --port 8000

# frontend
cd frontend && npm install && npm run dev      # → http://localhost:5173
```

The deployed build serves the data statically (no backend) and runs NL search as a
Vercel serverless function — keys live only in Vercel environment variables.

## Repo

| Path | What |
|---|---|
| `frontend/` | React + MapLibre app (deployed) |
| `backend/` | FastAPI scorer + endpoints |
| `autodesk/` | DXF export + APS Viewer pipeline |
| `cyvl_data/` · `data/` | Cyvl exports + Somerville sewer GIS |
| `docs/` | data-provenance sheet |

---

*Built at the Cyvl × Autodesk Hackathon, Somerville MA, 2026.*
