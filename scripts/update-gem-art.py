"""Build a pinned gem reference and extract official PoB icon arrays as WebP.
Run with Pillow and zstandard (same environment as update-tree-art.py).
Use a new destination revision to update published reference data.
PoB license: public/pob-trees/LICENSE-PoB.txt. Game data/art © GGG.
"""
import concurrent.futures, hashlib, io, json, pathlib, re, struct, urllib.request, urllib.parse
from PIL import Image
import zstandard
ROOT = pathlib.Path(__file__).resolve().parents[1]
REVISION = 'ce566eac45ea8a86477f513c7ee65a1ebe60014e'
SOURCE = f'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REVISION}/src/Data/'
DEST = ROOT / 'public/gems/v1'
if (DEST / 'catalogue.json').exists():
    raise SystemExit('Published catalogue exists; use a new asset revision to update it.')
(DEST / 'icons').mkdir(parents=True, exist_ok=True)
hashes = {}
def fetch(url):
    content = urllib.request.urlopen(url, timeout=30).read()
    hashes[url] = hashlib.sha256(content).hexdigest()
    return content

def string(block, key):
    match = re.search(r'\b' + key + r'\s*=\s*("(?:[^"\\]|\\.)*")', block)
    return json.loads(match[1]) if match else ''

# Only read generated literal fields. Do not execute upstream Lua.
assets = fetch(SOURCE + 'Skills/SkillAssets.lua').decode()
images = {}
for filename, block in re.findall(r'\["(gem-icons_[^"]+)"\]\s*=\s*\{(.*?)\n\t\t\}', assets, re.S):
    entries = re.findall(r'\["([^"]+)"\]\s*=\s*(\d+)', block)
    raw = zstandard.ZstdDecompressor().decompress(fetch(SOURCE + 'Skills/' + filename))
    assert raw[:4] == b'DDS ' and raw[84:88] == b'DX10'
    fmt, dimension, _, layers, _ = struct.unpack('<5I', raw[128:148])
    assert dimension == 3 and fmt in [28, 71], (filename, fmt)
    height, width = struct.unpack('<2I', raw[12:20])
    mip_count = max(1, struct.unpack('<I', raw[28:32])[0])
    stride = sum((max(1, width >> m) * max(1, height >> m) * 4 if fmt == 28 else max(1, ((width >> m)+3)//4) * max(1, ((height >> m)+3)//4) * 8) for m in range(mip_count))
    assert len(raw) == 148 + layers * stride
    header = bytearray(raw[:148]); struct.pack_into('<I', header, 140, 1)
    for path, index in entries:
        start = 148 + (int(index)-1)*stride
        img = Image.open(io.BytesIO(header + raw[start:start+stride])).convert('RGBA')
        out = io.BytesIO(); img.save(out, format='WEBP', quality=90, method=6)
        content = out.getvalue(); name = hashlib.sha256(content).hexdigest()[:24]+'.webp'
        (DEST / 'icons' / name).write_bytes(content)
        images[path.lower()] = '/gems/v1/icons/' + name

skills = {}
for filename in ['act_str', 'act_dex', 'act_int', 'sup_str', 'sup_dex', 'sup_int', 'other']:
    lua = fetch(SOURCE + 'Skills/' + filename + '.lua').decode()
    for effect, block in re.findall(r'skills\["([^"]+)"\] = \{(.*?)(?=\nskills\[|\Z)', lua, re.S):
        skills[effect] = {k: string(block, k) for k in ['name', 'description', 'icon']}
        color = re.search(r'\n\tcolor = (\d+)', block)
        skills[effect]['color'] = int(color[1]) if color else 0
        cast = re.search(r'\n\tcastTime = ([\d.]+)', block)
        if cast: skills[effect]['castTime'] = float(cast[1])
        skills[effect]['support'] = bool(re.search(r'\n\tsupport = true', block))

# RePoE supplies support icon paths omitted from PoB's support skill records.
repoe_url = 'https://repoe-fork.github.io/poe2/skill_gems.min.json'
repoe = json.loads(fetch(repoe_url))
# Mirror missing support artwork from the same RePoE asset export used for equipment.
paths = {v.get('icon_dds_file', '') for v in repoe.values()}
paths = {p for p in paths if p.startswith('Art/') and p.endswith('.dds') and p.replace('/4k/', '/').lower() not in images}
def mirror(path):
    url = 'https://repoe-fork.github.io/poe2/' + urllib.parse.quote(path[:-4]+'.webp')
    try:
        raw = fetch(url)
        if len(raw) > 2_000_000: raise ValueError('Image too large')
        img = Image.open(io.BytesIO(raw)).convert('RGBA'); img.thumbnail((96,96))
        out = io.BytesIO(); img.save(out, format='WEBP', quality=90, method=6)
        content = out.getvalue(); name = hashlib.sha256(content).hexdigest()[:24]+'.webp'
        (DEST / 'icons' / name).write_bytes(content)
        return path.replace('/4k/', '/').lower(), '/gems/v1/icons/'+name
    except Exception as error:
        print('Missing artwork:', path, str(error), flush=True)
        return path.replace('/4k/', '/').lower(), ''
for path, image in concurrent.futures.ThreadPoolExecutor(max_workers=6).map(mirror, sorted(paths)):
    if image: images[path] = image
gems = fetch(SOURCE + 'Gems.lua').decode()
records = {}
for gem_id, block in re.findall(r'\["([^"]+)"\] = \{(.*?)\n\t\},', gems, re.S):
    effect = string(block, 'grantedEffectId')
    ref = skills.get(effect, {})
    game_id = string(block, 'gameId')
    icon = ref.get('icon') or repoe.get(game_id, {}).get('icon_dds_file') or ''
    icon = icon.replace('/4k/', '/')
    records[gem_id] = {
        'name': string(block, 'name'), 'gameId': game_id, 'skillId': effect,
        'variantId': string(block, 'variantId'),
        'description': ref.get('description', ''), 'tags': string(block, 'tagString'),
        'type': string(block, 'gemType'), 'support': ref.get('support', False),
        'color': ref.get('color', 0), 'image': images.get(icon.lower(), ''),
        **({'castTime': ref['castTime']} if 'castTime' in ref else {}),
    }
# Include weapon/ascendancy-granted skills even when they are not socketable gems.
for effect, ref in skills.items():
    if any(r['skillId'] == effect for r in records.values()): continue
    records[effect] = {'name': ref['name'], 'skillId': effect, 'gameId': '', 'variantId': '', 'description': ref['description'], 'tags': '', 'type': 'Support' if ref['support'] else 'Skill', 'support': ref['support'], 'color': ref['color'], 'image': images.get(ref['icon'].lower(), '')}
(DEST / 'catalogue.json').write_text(json.dumps({'version': '0.5', 'gems': records}, separators=(',', ':'), ensure_ascii=False)+'\n')
(DEST / 'source.json').write_text(json.dumps({'revision':REVISION,'source':SOURCE,'supportIconMetadata':repoe_url,'sha256':hashes,'artworkOwner':'Grinding Gear Games'}, indent=2)+'\n')
print(f'{len(records)} references, {sum(bool(r["image"]) for r in records.values())} with artwork; {len(images)} icons extracted')
