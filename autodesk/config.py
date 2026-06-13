import os
from pathlib import Path

# load .env if present (APS_CLIENT_ID / APS_CLIENT_SECRET)
_env = Path(__file__).resolve().parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

APS_HOST = "https://developer.api.autodesk.com"
APS_CLIENT_ID = os.environ.get("APS_CLIENT_ID", "")
APS_CLIENT_SECRET = os.environ.get("APS_CLIENT_SECRET", "")
# upload/translate scopes (NOT viewer:read — that 400s on 2-legged; see Cyvl repo)
APS_SCOPES = "data:read data:write data:create bucket:create bucket:read"
# viewer token uses data:read only
VIEWER_SCOPES = "data:read"
