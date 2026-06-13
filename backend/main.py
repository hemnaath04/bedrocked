import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import io
import csv

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATA = Path(__file__).parent.parent / "data"

def load_scored():
    path = DATA / "scored_streets.geojson"
    if not path.exists():
        raise HTTPException(500, "scored_streets.geojson not found — run scorer.py first")
    return json.loads(path.read_text())

@app.get("/api/segments")
def get_segments():
    return JSONResponse(load_scored())

@app.get("/api/segment/{feature_id}")
def get_segment(feature_id: str):
    fc = load_scored()
    for feat in fc["features"]:
        if str(feat["properties"].get("id")) == feature_id:
            return feat
    raise HTTPException(404, "Segment not found")

@app.get("/api/export/csv")
def export_csv():
    fc = load_scored()
    fields = ["id", "street_name", "score", "pci", "install_year", "pipe_age",
              "diameter_in", "material", "depth_ft", "asset_count",
              "network_leverage", "f1_pavement", "f2_age", "f3_depth",
              "f4_bundling", "f5_network"]

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for feat in fc["features"]:
        writer.writerow(feat["properties"])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sewershed_scores.csv"}
    )

@app.get("/api/export/geojson")
def export_geojson():
    fc = load_scored()
    content = json.dumps(fc)
    return StreamingResponse(
        iter([content]),
        media_type="application/geo+json",
        headers={"Content-Disposition": "attachment; filename=sewershed_scores.geojson"}
    )

@app.get("/api/stats")
def get_stats():
    fc = load_scored()
    scores = [f["properties"]["score"] for f in fc["features"]]
    ages   = [f["properties"]["pipe_age"] for f in fc["features"] if f["properties"].get("pipe_age")]
    return {
        "total_segments": len(scores),
        "avg_score": round(sum(scores) / len(scores), 1),
        "high_priority": sum(1 for s in scores if s >= 50),
        "medium_priority": sum(1 for s in scores if 30 <= s < 50),
        "low_priority": sum(1 for s in scores if s < 30),
        "oldest_pipe_age": max(ages) if ages else None,
        "avg_pipe_age": round(sum(ages) / len(ages)) if ages else None,
    }
