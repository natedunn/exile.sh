"""Derive main-only explorer snapshots; ascendancies are requested separately."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / 'public/pob-trees/passives-v1'
destination.mkdir(parents=True, exist_ok=True)
for source in sorted((root / 'public/pob-trees/v4').glob('*.json')):
    tree = json.loads(source.read_text())
    nodes = [node for node in tree['nodes'] if not node['ascendancy']]
    ids = {node['id'] for node in nodes}
    edges = [edge for edge in tree['edges'] if edge['from'] in ids and edge['to'] in ids]
    (destination / source.name).write_text(json.dumps({**tree, 'nodes': nodes, 'edges': edges}, separators=(',', ':')))
