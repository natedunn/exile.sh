"""Convert the pinned RePoE Atlas export and mirror its icons. No live runtime dependencies.

Replace the source fixture and publish a NEW asset revision when updating the snapshot.
Game data and artwork belong to Grinding Gear Games.
"""
import concurrent.futures
import hashlib
import json
import math
import pathlib
import re
import urllib.parse
import urllib.request

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
nodes, positions = {}, {}
clean = lambda text: re.sub(r"\[([^\]]+)\]", lambda match: match[1].split("|")[-1], text)
for group_id, group in enumerate(data["groups"]):
    for placement in group["passives"]:
        key = str(placement["hash"])
        meta = data["passives"][key]
        if meta["is_icon_only"]:
            continue
        orbit = placement["radius"]
        angle = 2 * math.pi * placement["position_clockwise"] / data["skills_per_orbit"][orbit]
        radius = data["orbit_radii"][orbit]
        subtree = meta.get("atlas_subtree", {}).get("id", "Main")
        stats = [clean(line) for line in meta["stat_text"]]
        if meta["is_atlas_root"]:
            stats = [f"Starting point for the {subtree.lower()} Atlas tree."]
        nodes[key] = {"id": key, "x": round(group["x"] + math.sin(angle) * radius, 3),
                      "y": round(group["y"] - math.cos(angle) * radius, 3),
                      "name": clean(meta["name"]) or f"{subtree} Atlas starting point",
                      "stats": stats, "notable": meta["is_notable"] or meta["is_keystone"],
                      "keystone": meta["is_keystone"], "ascendancy": "", "start": False,
                      "icon": meta["icon"], "atlasSubtree": subtree}
        positions[key] = (placement, group_id, angle)
        if key in choices["nodes"]:
            nodes[key]["options"] = choices["nodes"][key]["options"]
edges, seen = [], set()
for key, (placement, group_id, angle) in positions.items():
    for index, other_id in enumerate(placement["connections"]):
        other = str(other_id)
        pair = tuple(sorted([key, other]))
        if other not in nodes or key == other or pair in seen:
            continue
        seen.add(pair)
        a, b = nodes[key], nodes[other]
        spline = placement["splines"][index]
        radius = data["orbit_radii"][abs(spline)] if 0 < abs(spline) < len(data["orbit_radii"]) else 0
        sweep = 0 if spline > 0 else 1
        dest, dest_group, dest_angle = positions[other]
        if not spline and group_id == dest_group and placement["radius"] == dest["radius"]:
            radius = data["orbit_radii"][placement["radius"]]
            sweep = 1 if (dest_angle - angle) % (2 * math.pi) < math.pi else 0
        distance = math.hypot(b["x"] - a["x"], b["y"] - a["y"])
        path = f'M {a["x"]} {a["y"]} '
        path += f'A {radius} {radius} 0 0 {sweep} {b["x"]} {b["y"]}' if radius and 0 < distance <= radius * 2 + .01 else f'L {b["x"]} {b["y"]}'
        edges.append({"from": key, "to": other, "path": path})
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
