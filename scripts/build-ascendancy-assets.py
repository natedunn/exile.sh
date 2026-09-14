"""Split pinned v4 trees into independently cacheable ascendancy snapshots.
Artwork manifests contain only each ascendancy's icons; image files remain shared.
"""
import json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "public/pob-trees/ascendancies-v1"
manifest_path = ROOT / "shared/generated/ascendancy-trees.json"
previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest = {}
for file in sorted((ROOT / "public/pob-trees/v4").glob("*.json")):
    version = file.stem
    tree = json.loads(file.read_text())
    art = json.loads((ROOT / f"public/pob-trees/art-v2/{version}.json").read_text())
    manifest[version] = []
    dest = DEST / version
    dest.mkdir(parents=True, exist_ok=True)
    for name in sorted({n['ascendancy'] for n in tree['nodes'] if n['ascendancy']}):
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        nodes = [n for n in tree['nodes'] if n['ascendancy'] == name]
        ids = {n['id'] for n in nodes}
        edges = [e for e in tree['edges'] if e['from'] in ids and e['to'] in ids]
        icons = {n['icon']:art[n['icon']] for n in nodes if n['icon'] in art}
        (dest / f'{slug}.json').write_text(json.dumps({'nodes':nodes,'edges':edges}, separators=(',',':')))
        (dest / f'{slug}-art.json').write_text(json.dumps(icons, separators=(',',':')))
        base = f'/pob-trees/ascendancies-v1/{version}/{slug}'
        manifest[version].append({'value':name,'label':name,'data':base+'.json','art':base+'-art.json'})
for version, choices in previous.items():
    variants = [c for c in choices if c['value'] == 'Abyssal Lich']
    manifest[version].extend(variants)
    manifest[version].sort(key=lambda c: c['value'])
(ROOT / 'shared/generated/ascendancy-trees.json').write_text(json.dumps(manifest, separators=(',',':')))
print(sum(len(v) for v in manifest.values()), 'ascendancy snapshots')
