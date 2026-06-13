#!/usr/bin/env python3
"""
Impute missing install years on sanitary_mains.geojson using material-based medians.
Adds install_year (int) and age_source ("actual" | "imputed_material" | "imputed_fallback")
to every feature. Writes sanitary_mains_aged.geojson.
"""

import json, datetime
from pathlib import Path

IN  = Path("/home/yash/Github/Cyvl-Hack/public/data/sewer/sanitary_mains.geojson")
OUT = Path("/home/yash/Github/Cyvl-Hack/public/data/sewer/sanitary_mains_aged.geojson")

# Medians derived from actual data above
MATERIAL_YEAR = {
    "Brick":                1878,
    "Brick & Wood":         1935,
    "Vitrified Clay":       1900,
    "Cast Iron":            1889,
    "Cement Concrete":      1875,
    "Reinforced Concrete":  1892,
    "Asbestos Cement":      1969,
    "Ductile Iron":         1925,
    "Polyvinyl Chloride":   1875,
    "Stone":                1917,
    "Other":                1878,
    "Unknown":              1911,
}
GLOBAL_FALLBACK = 1886  # median of all Combined pipes with known dates

with open(IN) as f:
    fc = json.load(f)

actual = imputed_mat = imputed_fb = 0

for feat in fc["features"]:
    p = feat["properties"]
    ts  = p.get("INSTALLDAT")
    mat = p.get("Material") or "Unknown"

    yr = None
    src = None

    if ts and ts not in (0, None, ""):
        try:
            yr  = datetime.datetime.fromtimestamp(ts / 1000).year
            src = "actual"
            actual += 1
        except:
            pass

    if yr is None:
        if mat in MATERIAL_YEAR:
            yr  = MATERIAL_YEAR[mat]
            src = "imputed_material"
            imputed_mat += 1
        else:
            yr  = GLOBAL_FALLBACK
            src = "imputed_fallback"
            imputed_fb += 1

    p["install_year"] = yr
    p["age_source"]   = src

OUT.write_text(json.dumps(fc))

total = len(fc["features"])
print(f"Written: {OUT.name}  ({total} features)")
print(f"  actual date:        {actual:4}  ({actual/total*100:.1f}%)")
print(f"  imputed (material): {imputed_mat:4}  ({imputed_mat/total*100:.1f}%)")
print(f"  imputed (fallback): {imputed_fb:4}  ({imputed_fb/total*100:.1f}%)")
