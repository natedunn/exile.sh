"""Mirror GGG rune and soul-core artwork from RePoE for equipment overlays."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = "https://repoe-fork.github.io/poe2/"
raw = urllib.request.urlopen(SOURCE + "base_items.min.json", timeout=30).read()
records = {}
paths = {}
for item in json.loads(raw).values():
    if item["item_class"] != "SoulCore" or item.get("release_state") != "released":
        continue
    path = item.get("visual_identity", {}).get("dds_file", "").replace(".dds", ".webp")
    if not path.startswith("Art/") or not path.endswith(".webp"):
        continue
    key = hashlib.sha256(path.encode()).hexdigest()[:20] + ".webp"
    paths[key] = path
    records[item["name"]] = "/equipment/sockets/" + key

directory = ROOT / "public/equipment/sockets"
directory.mkdir(exist_ok=True)

def download(pair):
    key, path = pair
    dest = directory / key
    if dest.exists():
        return
    content = urllib.request.urlopen(SOURCE + urllib.parse.quote(path), timeout=30).read(1_000_001)
    if len(content) > 1_000_000 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise ValueError("Invalid WebP: " + path)
    dest.write_bytes(content)

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(download, paths.items()))
(ROOT / "shared/socket-art.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
(ROOT / "shared/socket-art-source.json").write_text(json.dumps({
    "source": SOURCE,
    "sha256": hashlib.sha256(raw).hexdigest(),
    "artworkOwner": "Grinding Gear Games",
}, indent=2) + "\n")
print(f"{len(records)} socketable names, {len(paths)} mirrored images")
