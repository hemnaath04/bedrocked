#!/usr/bin/env bash
# One-shot launcher for the Sewershed × Autodesk APS viewer.
# Prereq: paste APS_CLIENT_ID / APS_CLIENT_SECRET into autodesk/.env first.
set -e
cd "$(dirname "$0")"

if [ ! -f .env ] || ! grep -q "APS_CLIENT_ID=." .env; then
  echo "✗ No APS key yet. Create .env from .env.example and paste:"
  echo "    APS_CLIENT_ID=...   APS_CLIENT_SECRET=..."
  echo "  (free app at https://aps.autodesk.com, or ask Xavier @ Cyvl)"
  exit 1
fi

python3 -m pip install -q -r requirements.txt
echo "→ building scene from data/scored_streets.geojson"
python3 build_scene.py
echo "→ uploading to Autodesk (OSS → Model Derivative)"
python3 run_aps.py
echo "→ starting viewer at http://localhost:8080  (Ctrl-C to stop)"
python3 viewer/token_server.py
