#!/usr/bin/env python3
"""Preserve PoB skill names that differ from the published gem catalogue names."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'public/gems/v1/source.json').read_text())
catalogue = json.loads((ROOT / 'public/gems/v1/catalogue.json').read_text())['gems']
references = {}
for gem in catalogue.values():
    references.setdefault(gem['skillId'], set()).add(gem['name'].lower())

def read_skill_file(filename):
    url = source['source'] + 'Skills/' + filename + '.lua'
    raw = urllib.request.urlopen(url, timeout=30).read()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != source['sha256'].get(url):
        raise ValueError(f'Source does not match published catalogue: {url}')
    aliases = {}
    for skill_id, block in re.findall(r'skills\["([^"]+)"\] = \{(.*?)(?=\nskills\[|\Z)', raw.decode(), re.S):
        if skill_id not in references:
            continue
        for field in ['name', 'baseTypeName']:
            match = re.search(r'\b' + field + r'\s*=\s*("(?:[^"\\]|\\.)*")', block)
            name = json.loads(match[1]).lower() if match else ''
            if name and name not in references[skill_id]:
                aliases.setdefault(name, set()).add(skill_id)
    return aliases

aliases = {}
files = ['act_str', 'act_dex', 'act_int', 'sup_str', 'sup_dex', 'sup_int', 'other']
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for result in pool.map(read_skill_file, files):
        for name, ids in result.items():
            aliases.setdefault(name, set()).update(ids)
output = {'revision': source['revision'], 'aliases': {name: sorted(ids) for name, ids in sorted(aliases.items())}}
(ROOT / 'shared/gem-name-aliases.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'Generated {len(aliases)} alternate names from verified PoB skill IDs.')
