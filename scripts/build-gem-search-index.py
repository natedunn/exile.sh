"""Build a text index from the published gem effect references."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/gems/effects-v1"
DESTINATION = ROOT / "public/gems/v1/search-index.json"
CATALOGUE = ROOT / "public/gems/v1/catalogue.json"

gems = json.loads(CATALOGUE.read_text())["gems"].values()
skill_ids = {gem["skillId"] for gem in gems if gem["name"] and gem["gameId"]}

index = {}
for path in sorted(SOURCE.glob("*.json")):
    if path.stem not in skill_ids:
        continue
    effects = json.loads(path.read_text())
    if "sets" not in effects:
        continue
    lines = {
        line
        for stat_set in effects["sets"].values()
        for group in ("levels", "quality", "gemlingQuality")
        for entry in stat_set.get(group, {}).values()
        for line in entry["lines"]
    }
    index[path.stem] = sorted(lines)

DESTINATION.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Indexed {len(index)} gem effects in {DESTINATION}")
