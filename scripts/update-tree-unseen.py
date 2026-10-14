"""Extract Oracle's Paths Not Taken IDs from pinned upstream unlock constraints.

These small metadata tables ship with the app; published geometry stays immutable.
"""
from data_sources import build_root, pob_revision, tree_versions
import json
import pathlib
import urllib.request

ROOT = build_root(__file__)
REVISION = pob_revision("ce566eac45ea8a86477f513c7ee65a1ebe60014e")
path = ROOT / "shared/generated/tree-unseen.json"
previous = json.loads(path.read_text()) if path.exists() else {"versions": {}}
result = {"revision": previous.get("revision", REVISION), "versions": previous["versions"],
          "revisions": previous.get("revisions", {v: previous.get("revision") for v in previous["versions"]})}
for version in tree_versions(["0_1", "0_2", "0_3", "0_4", "0_5"]):
    result["revisions"][version] = REVISION
    url = f"https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REVISION}/src/TreeData/{version}/tree.json"
    source = json.load(urllib.request.urlopen(url))
    unlocks = {int(key) for key, node in source["nodes"].items()
               if node.get("ascendancyName") == "Oracle" and "Walk the Paths Not Taken" in node.get("stats", [])}
    result["versions"][version] = sorted(
        (key for key, node in source["nodes"].items()
         if not node.get("isOnlyImage") and node.get("group") is not None
         and node.get("unlockConstraint", {}).get("ascendancy") == "Oracle"
         and unlocks.intersection(node.get("unlockConstraint", {}).get("nodes", []))), key=int)
path = ROOT / "shared/generated/tree-unseen.json"
path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps(result, indent=2) + "\n")
