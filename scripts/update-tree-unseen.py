"""Extract Oracle's Paths Not Taken IDs from pinned upstream unlock constraints.

These small metadata tables ship with the app; published geometry stays immutable.
"""
import json
import pathlib
import urllib.request

REVISION = "ce566eac45ea8a86477f513c7ee65a1ebe60014e"
ROOT = pathlib.Path(__file__).resolve().parents[1]
result = {"revision": REVISION, "versions": {}}
for version in ["0_1", "0_2", "0_3", "0_4", "0_5"]:
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
