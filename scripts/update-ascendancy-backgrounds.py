"""Mirror versioned GGG ascendancy backgrounds from the pinned PoB DDS arrays.
Run with Pillow and zstandard. Placement follows PoB's centered DrawAsset quad,
whose source width/height are half-extents. No runtime upstream requests.
"""
import hashlib, io, json, pathlib, struct, urllib.request
from PIL import Image
import zstandard
ROOT = pathlib.Path(__file__).resolve().parents[1]
REVISION = "ce566eac45ea8a86477f513c7ee65a1ebe60014e"
SOURCE = f"https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REVISION}/src/TreeData/"
DEST = ROOT / "public/pob-trees/ascendancy-v1"
DEST.mkdir(parents=True, exist_ok=True)
versions = {}
encoded = {}
for version in ["0_1", "0_2", "0_3", "0_4", "0_5"]:
    data = json.load(urllib.request.urlopen(SOURCE + version + "/tree.json"))
    backgrounds = {a["name"]: a["background"] for c in data["classes"] for a in c.get("ascendancies", []) if a.get("background")}
    wanted = {bg["image"] for bg in backgrounds.values()}
    images = {}
    for file, entries in data.get("ddsCoords", {}).items():
        matches = {name: index for name, index in entries.items() if name in wanted}
        if not matches: continue
        raw = zstandard.ZstdDecompressor().decompress(urllib.request.urlopen(SOURCE + version + "/" + file).read())
        if raw[:4] != b"DDS " or raw[84:88] != b"DX10": raise ValueError("Unsupported DDS")
        fmt, dimension, _, layers, _ = struct.unpack("<5I", raw[128:148])
        if fmt not in {98,99} or dimension != 3: raise ValueError("Expected BC7 2D array")
        height, width = struct.unpack("<2I", raw[12:20])
        mips = struct.unpack("<I", raw[28:32])[0]
        stride = sum(max(1, ((width >> m)+3)//4)*max(1, ((height >> m)+3)//4)*16 for m in range(mips))
        assert len(raw) == 148 + stride * layers
        header = bytearray(raw[:148]); struct.pack_into("<I", header, 140, 1)
        for name, index in matches.items():
            start = 148 + (index - 1) * stride
            payload = header + raw[start:start+stride]
            signature = hashlib.sha256(payload).hexdigest()
            if signature in encoded:
                images[name] = encoded[signature]
                continue
            image = Image.open(io.BytesIO(payload)).convert("RGBA")
            output = io.BytesIO(); image.save(output, format="WEBP", quality=85, method=4)
            content = output.getvalue(); filename = hashlib.sha256(content).hexdigest()[:24] + ".webp"
            (DEST / filename).write_bytes(content)
            images[name] = "/pob-trees/ascendancy-v1/" + filename
            encoded[signature] = images[name]
    versions[version] = {name: {"image": images[bg["image"]], "x": bg["x"], "y": bg["y"], "width": bg["width"] * 2, "height": bg["height"] * 2} for name,bg in backgrounds.items()}
    print(version, len(backgrounds), flush=True)
(ROOT / "shared/generated/ascendancy-backgrounds.json").write_text(json.dumps({"source": SOURCE, "revision": REVISION, "artworkOwner": "Grinding Gear Games", "versions": versions}, separators=(",", ":")))
