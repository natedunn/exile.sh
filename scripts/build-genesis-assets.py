"""Convert the pinned RePoE Genesis Tree export and mirror its icons. No live runtime dependencies.

The export carries stat IDs only, so effects come from the frozen RePoE stat translations.
Replace the source fixtures and publish a NEW asset revision when updating the snapshot.
Game data and artwork belong to Grinding Gear Games.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import urllib.request

from repoe_tree import clean, layout

ROOT = pathlib.Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "shared/fixtures/genesis"
DEST = ROOT / "public/genesis-trees/v1"
BASE = "https://repoe-fork.github.io/poe2/"
ART_BASE = "https://cdn.poe2db.tw/image/"
WOMBS = {"Currency": "Currency", "Amulets": "Amulet", "Rings": "Ring", "Belts": "Belt", "Breachstones": "Breachstone"}
raw = (FIXTURES / "BrequelTree.json").read_bytes()
data = json.loads(raw)
translations = json.loads((FIXTURES / "stat-translations.json").read_text())
choices = json.loads((FIXTURES / "options.json").read_text())
digest = hashlib.sha256(raw).hexdigest()
assert translations["source"]["genesisSha256"] == digest, "Refreeze stat translations for this Genesis snapshot"
assert choices["source"]["genesisSha256"] == digest, "Revalidate choices for this Genesis snapshot"
for key, choice in choices["nodes"].items():
    meta = data["passives"][key]
    assert meta["name"] == choice["name"] and meta["stats"] == choice["sourceStats"], f"Stale Genesis choices: {key}"


def number(value):
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def describe_stats(stats):
    """Apply the game's stat description rules; stats without one are hidden in game."""
    lines = []
    for entry in translations["entries"]:
        if not any(stat in stats for stat in entry["ids"]):
            continue
        values = [stats.get(stat, 0) for stat in entry["ids"]]
        for variant in entry["English"]:
            if not all((rule["min"] is None or value >= rule["min"]) and (rule["max"] is None or value <= rule["max"])
                       for rule, value in zip(variant["condition"], values)):
                continue
            text = variant["string"]
            for index, (value, handlers, form) in enumerate(zip(values, variant["index_handlers"], variant["format"])):
                for handler in handlers:
                    if handler == "negate":
                        value = -value
                    elif handler == "divide_by_one_hundred_1dp":
                        value = round(value / 100, 1)
                    else:
                        raise ValueError(f"Unknown stat handler: {handler}")
                shown = ("+" if form == "+#" and value >= 0 else "") + number(value)
                text = text.replace("{%d}" % index, shown)
                if index == 0:
                    text = text.replace("{}", shown)
            lines.append(clean(text))
            break
    return lines


def describe(key, meta):
    # Roots are unnamed, iconless anchors beside each Womb; the game does not show them.
    if meta["hash"] in data["roots"]:
        return None
    womb = WOMBS[re.match(r"BrequelTree([A-Z][a-z]+)", meta["id"])[1]]
    fields = {"name": clean(meta["name"]), "stats": describe_stats(meta["stats"]),
              "notable": meta["is_notable"] or meta["is_keystone"], "keystone": meta["is_keystone"],
              "ascendancy": "", "start": False, "icon": meta["icon"], "womb": womb}
    if key in choices["nodes"]:
        fields["options"] = choices["nodes"][key]["options"]
    return fields


nodes, edges = layout(data, describe)
DEST.mkdir(parents=True, exist_ok=True)
(DEST / "icons").mkdir(exist_ok=True)
source = {"url": BASE + "passive_skill_trees/BrequelTree.json", "title": data["title"], "sha256": digest,
          "artworkOwner": "Grinding Gear Games", "artworkMirror": ART_BASE,
          "statTranslations": translations["source"], "options": choices["source"]}


def download(icon):
    url = ART_BASE + icon.replace(".dds", ".webp")
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://poe2db.tw/"})
    content = urllib.request.urlopen(request, timeout=30).read()
    if content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise ValueError(f"Not a WebP: {url}")
    name = hashlib.sha256(content).hexdigest()[:20] + ".webp"
    (DEST / "icons" / name).write_bytes(content)
    return icon, "/genesis-trees/v1/icons/" + name


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    art = dict(pool.map(download, sorted({node["icon"] for node in nodes.values()})))
(DEST / "tree.json").write_text(json.dumps({"source": source, "nodes": list(nodes.values()), "edges": edges}, separators=(",", ":")))
(DEST / "art.json").write_text(json.dumps(art, separators=(",", ":")))
print(f"{len(nodes)} Genesis nodes, {len(edges)} edges, {len(art)} icons")
