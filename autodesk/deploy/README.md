# Sewershed × Autodesk — Vercel deploy

Static APS viewer + one serverless token endpoint. The 3D dig-plan is already
translated in Autodesk OSS (URN baked into index.html); this just serves it.

## Deploy
1. `vercel` (or connect this folder in the Vercel dashboard).
2. Set **Environment Variables** in the Vercel project:
   - `APS_CLIENT_ID`
   - `APS_CLIENT_SECRET`
3. Redeploy. Open the URL → the dig-plan loads in the Autodesk Viewer.

## Refresh the model
From `autodesk/`, run `python run_aps.py`, copy the new URN into `index.html`
(`const URN = ...`) and `cp out/scene_meta.json deploy/scene_meta.json`, redeploy.

Files: `index.html` (viewer), `api/token.js` (serverless token), `scene_meta.json`
(per-street street+score for the click panel), `vercel.json`.
