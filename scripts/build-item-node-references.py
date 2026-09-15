#!/usr/bin/env python3
"""Generate individual anointment references from the pinned local tree assets."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = root / 'public/pob-trees/node-reference-v1'
count = 0
for source in sorted((root / 'public/pob-trees/v4').glob('*.json')):
    version = source.stem
    tree = json.loads(source.read_text())
    art = json.loads((root / f'public/pob-trees/art-v2/{version}.json').read_text())
    records = {}
    ambiguous = set()
    for node in tree['nodes']:
        if not node['notable'] or node['ascendancy'] or node['start']:
            continue
        name = node['name'].lower()
        key = hashlib.sha256(name.encode()).hexdigest()[:24]
        record = {k: node[k] for k in ('name', 'stats', 'options') if k in node}
        record['image'] = art.get(node['icon'])
        if key in records and records[key] != record:
            ambiguous.add(key)
        records[key] = record
    folder = output / version
    folder.mkdir(parents=True, exist_ok=True)
    for key, record in records.items():
        if key in ambiguous:
            continue
        target = folder / f'{key}.json'
        content = json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n'
        if target.exists() and target.read_text() != content:
            raise ValueError(f'Published reference changed; use a new revision: {target}')
        target.write_text(content)
    count += len(records) - len(ambiguous)
print(f'Generated {count} individual node references from local tree data.')
