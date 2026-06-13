"""
End-to-end: Sewershed dig-plan -> Autodesk Viewer.

  build_scene (OBJ+MTL) -> zip -> OSS upload -> Model Derivative SVF2 -> URN.

Needs APS_CLIENT_ID / APS_CLIENT_SECRET in autodesk/.env (free app at
https://aps.autodesk.com). Bumps the object key each run so SVF2's per-key cache
doesn't serve a stale scene (reference finding). Prints the URN to paste into
viewer/index.html.

  python build_scene.py        # 1. generate geometry
  python run_aps.py            # 2. push to APS, get URN
  python viewer/token_server.py # 3. serve a viewer token, open viewer/index.html
"""
import sys
import time
import zipfile
from pathlib import Path

import build_scene
from aps_client import get_token, ensure_bucket, upload_object, translate, wait_until_done
from config import APS_CLIENT_ID

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
BUCKET = "sewershed-digplan"  # lowercase, globally-unique-ish; transient policy

def main():
    if not APS_CLIENT_ID:
        sys.exit("Set APS_CLIENT_ID / APS_CLIENT_SECRET in autodesk/.env first "
                 "(create a free app at https://aps.autodesk.com).")

    # 1. geometry
    build_scene.main()

    # 2. zip OBJ + MTL together (Model Derivative needs them zipped for colors)
    version = int(time.time())
    object_key = f"scene_cad_v{version}.zip"
    zip_path = OUT / object_key
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(OUT / "scene.obj", "scene.obj")
        z.write(OUT / "scene.mtl", "scene.mtl")
    print(f"zipped -> {zip_path.name}")

    # 3. APS
    token = get_token()
    ensure_bucket(token, BUCKET)
    print("uploading…")
    urn = upload_object(token, BUCKET, object_key, zip_path)
    print("translating…")
    translate(token, urn, root_filename="scene.obj")
    wait_until_done(token, urn)

    print("\n✅ DONE")
    print("URN:", urn)
    print("\nPaste it into viewer/index.html  ->  const URN = '...'")
    (HERE / "viewer" / "urn.txt").write_text(urn)
    print("(also written to viewer/urn.txt)")

if __name__ == "__main__":
    main()
