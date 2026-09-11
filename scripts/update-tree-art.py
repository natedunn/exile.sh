"""Extract official icons from pinned PoB DDS arrays into cacheable WebP files.

Run with Python dependencies Pillow and zstandard. Each manifest is version-pinned;
existing manifests are immutable (use a new art revision to change extraction).
"""
import hashlib, io, json, pathlib, struct, urllib.request
from PIL import Image
import zstandard
ROOT = pathlib.Path(__file__).resolve().parents[1]
REVISION = "ce566eac45ea8a86477f513c7ee65a1ebe60014e"
SOURCE = f"https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REVISION}/src/TreeData/"
dest = ROOT / "public/pob-trees/art-v2"
(dest / "icons").mkdir(parents=True, exist_ok=True)
for tree_file in sorted((ROOT / "public/pob-trees/v2").glob("*.json")):
    version = tree_file.stem
    if (dest / (version + ".json")).exists():
        continue
    data = json.load(urllib.request.urlopen(SOURCE + version + "/tree.json"))
    required = {n["icon"] for n in json.loads(tree_file.read_text())["nodes"] if n["icon"]}
    manifest = {}
    for file, entries in data.get("ddsCoords", {}).items():
        if not file.startswith("skills_") or not required.intersection(entries):
            continue
        raw = zstandard.ZstdDecompressor().decompress(urllib.request.urlopen(SOURCE + version + "/" + file).read())
        if raw[:4] != b"DDS " or raw[84:88] != b"DX10":
            raise ValueError("Unsupported atlas format")
        fmt, dimension, _, layers, _ = struct.unpack("<5I", raw[128:148])
        if fmt != 71 or dimension != 3:
            raise ValueError("Expected BC1 2D texture array")
        height, width = struct.unpack("<2I", raw[12:20])
        mip_count = struct.unpack("<I", raw[28:32])[0]
        stride = sum(max(1, ((width >> m) + 3) // 4) * max(1, ((height >> m) + 3) // 4) * 8 for m in range(mip_count))
        assert len(raw) == 148 + stride * layers, (file, len(raw), stride, layers, width, height, mip_count)
        header = bytearray(raw[:148])
        struct.pack_into("<I", header, 140, 1)
        for path, index in entries.items():
            if path not in required:
                continue
            start = 148 + (index - 1) * stride
            icon = Image.open(io.BytesIO(header + raw[start:start + stride])).convert("RGBA")
            output = io.BytesIO()
            icon.save(output, format="WEBP", quality=85, method=6)
            content = output.getvalue()
            name = hashlib.sha256(content).hexdigest()[:24] + ".webp"
            (dest / "icons" / name).write_bytes(content)
            manifest[path] = "/pob-trees/art-v2/icons/" + name
    (dest / (version + ".json")).write_text(json.dumps(manifest, separators=(",", ":")))
    print(version, len(manifest), "/", len(required), flush=True)
(dest / "source.json").write_text(json.dumps({"source": SOURCE, "revision": REVISION, "artworkOwner": "Grinding Gear Games"}, indent=2) + "\n")
