"""Autodesk Platform Services client — auth, OSS upload, Model Derivative.
Adapted from Cyvl's hackathon reference (xavier-cyvl/hackathonBuckets)."""
import base64
import time
import requests
from config import APS_HOST, APS_CLIENT_ID, APS_CLIENT_SECRET, APS_SCOPES


def get_token(scopes=APS_SCOPES):
    """2-legged client-credentials token."""
    raw = f"{APS_CLIENT_ID}:{APS_CLIENT_SECRET}".encode()
    r = requests.post(
        f"{APS_HOST}/authentication/v2/token",
        headers={"Authorization": "Basic " + base64.b64encode(raw).decode(),
                 "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": scopes},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def ensure_bucket(token, bucket_key):
    r = requests.post(
        f"{APS_HOST}/oss/v2/buckets",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"bucketKey": bucket_key, "policyKey": "transient"},
        timeout=30,
    )
    if r.status_code not in (200, 409):  # 409 = already exists
        r.raise_for_status()


def upload_object(token, bucket_key, object_key, file_path):
    """Signed-S3 3-step upload. Returns padding-stripped base64 URN."""
    base = f"{APS_HOST}/oss/v2/buckets/{bucket_key}/objects/{object_key}"
    h = {"Authorization": f"Bearer {token}"}
    signed = requests.get(f"{base}/signeds3upload", headers=h, timeout=30).json()
    with open(file_path, "rb") as f:
        requests.put(signed["urls"][0], data=f, timeout=300).raise_for_status()
    done = requests.post(f"{base}/signeds3upload", headers={**h, "Content-Type": "application/json"},
                         json={"uploadKey": signed["uploadKey"]}, timeout=30)
    done.raise_for_status()
    object_id = done.json()["objectId"]
    return base64.urlsafe_b64encode(object_id.encode()).decode().rstrip("=")


def translate(token, urn, root_filename="scene.obj"):
    """OBJ+MTL zip -> SVF2. compressedUrn + rootFilename keeps materials/colors."""
    r = requests.post(
        f"{APS_HOST}/modelderivative/v2/designdata/job",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                 "x-ads-force": "true"},
        json={"input": {"urn": urn, "compressedUrn": True, "rootFilename": root_filename},
              "output": {"formats": [{"type": "svf2", "views": ["2d", "3d"]}]}},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def wait_until_done(token, urn, timeout_s=900, interval_s=10):
    url = f"{APS_HOST}/modelderivative/v2/designdata/{urn}/manifest"
    waited = 0
    while waited < timeout_s:
        m = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30).json()
        print("  translate:", m.get("status"), m.get("progress"))
        if m.get("status") == "success":
            return m
        if m.get("status") == "failed":
            raise RuntimeError(f"translation failed: {m}")
        time.sleep(interval_s)
        waited += interval_s
    raise TimeoutError("translation did not finish")
