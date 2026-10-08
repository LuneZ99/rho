#!/usr/bin/env python3
"""Grant the existing rho key all configured proxy models. Never prints credentials.
Run with LITELLM_MASTER_KEY, LITELLM_API_KEY and optional LITELLM_BASE_URL in env.
"""
import json
import os
import urllib.parse
import urllib.request

base = os.environ.get("LITELLM_BASE_URL", "https://litellm.sh.corgi.plus/v1").rstrip("/").removesuffix("/v1")
key = os.environ["LITELLM_API_KEY"]
master = os.environ["LITELLM_MASTER_KEY"]

def call(path, credential, payload=None):
    request = urllib.request.Request(base + path, headers={"Authorization": "Bearer " + credential, "Content-Type": "application/json"}, data=json.dumps(payload).encode() if payload else None)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

try:
    info = call("/key/info?" + urllib.parse.urlencode({"key": key}), master)["info"]
    print("Key alias:", info.get("key_alias"), "Previous models:", info.get("models"))
    call("/key/update", master, {"key": key, "models": ["all-proxy-models"]})
    available = sorted(m["id"] for m in call("/v1/models", key)["data"])
    configured = sorted(m["id"] for m in call("/v1/models", master)["data"])
    if available != configured:
        raise RuntimeError("Model access differs from proxy list; inspect owner/team constraints")
    print(json.dumps({"models": available, "count": len(available)}, ensure_ascii=False))
except Exception as error:
    # HTTPError contains request URLs that could include a key.
    raise SystemExit("Model access update/verification failed: " + type(error).__name__)
