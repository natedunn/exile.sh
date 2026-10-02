"""Convert the pinned RePoE Atlas export and mirror its icons. No live runtime dependencies.

Replace the source fixture and publish a NEW asset revision when updating the snapshot.
Game data and artwork belong to Grinding Gear Games.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

from repoe_tree import clean, layout

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "public/atlas-trees/v2"
BASE = "https://repoe-fork.github.io/poe2/"
ART_COMMIT = "90c1873011d9ae53beb49419067e75e0b7ce2353"
ART_BASE = f"https://raw.githubusercontent.com/juddisjudd/atlas.exilecompass.com/{ART_COMMIT}/static/icons/"
raw = (ROOT / "shared/fixtures/atlas/Atlas.json").read_bytes()
data = json.loads(raw)
choices = json.loads((ROOT / "shared/fixtures/atlas/options.json").read_text())
assert choices["source"]["atlasSha256"] == hashlib.sha256(raw).hexdigest(), "Revalidate choices for this Atlas snapshot"
for key, choice in choices["nodes"].items():
    meta = data["passives"][key]
    assert meta["name"] == choice["name"] and meta["stats"] == choice["sourceStats"], f"Stale Atlas choices: {key}"
DEST.mkdir(parents=True, exist_ok=True)
(DEST / "icons").mkdir(exist_ok=True)
def describe(key, meta):
    if meta["is_icon_only"]:
        return None
    subtree = meta.get("atlas_subtree", {}).get("id", "Main")
    stats = [clean(line) for line in meta["stat_text"]]
    if meta["is_atlas_root"]:
        stats = [f"Starting point for the {subtree.lower()} Atlas tree."]
    fields = {"name": clean(meta["name"]) or f"{subtree} Atlas starting point",
              "stats": stats, "notable": meta["is_notable"] or meta["is_keystone"],
              "keystone": meta["is_keystone"], "ascendancy": "", "start": False,
              "icon": meta["icon"], "atlasSubtree": subtree}
    if key in choices["nodes"]:
        fields["options"] = choices["nodes"][key]["options"]
    return fields
nodes, edges = layout(data, describe)
source = {"url": BASE + "passive_skill_trees/Atlas.json", "exportVersion": "4.5.5.2",
          "sha256": hashlib.sha256(raw).hexdigest(), "artworkOwner": "Grinding Gear Games", "artworkMirror": ART_BASE}
paths = {node["icon"] for node in nodes.values() if node["icon"]}
cached_art = json.loads((ROOT / "public/atlas-trees/v1/art.json").read_text())
def download(icon):
    if icon in cached_art and (ROOT / "public" / cached_art[icon].lstrip("/")).exists():
        return icon, cached_art[icon]
    url = ART_BASE + urllib.parse.quote(icon.split("/")[-1].replace(".dds", ".webp"))
    try:
        content = urllib.request.urlopen(url, timeout=30).read()
    except urllib.error.HTTPError as error:
        if error.code != 404: raise
        print("Missing artwork:", icon)
        return icon, ""
    if content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise ValueError(f"Not a WebP: {url}")
    name = hashlib.sha256(content).hexdigest()[:20] + ".webp"
    (DEST / "icons" / name).write_bytes(content)
    return icon, "/atlas-trees/v2/icons/" + name
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    art = {key: path for key, path in pool.map(download, sorted(paths)) if path}
source["options"] = choices["source"]
(DEST / "tree.json").write_text(json.dumps({"source": source, "nodes": list(nodes.values()), "edges": edges}, separators=(",", ":")))
(DEST / "art.json").write_text(json.dumps(art, separators=(",", ":")))
print(f"{len(nodes)} Atlas nodes, {len(edges)} edges, {len(art)} icons")
