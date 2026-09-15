"""Extract augment effect text from the same pinned PoB revision as gem artwork."""
import hashlib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
revision = json.loads((ROOT / 'public/gems/v1/source.json').read_text())['revision']
url = f'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{revision}/src/Data/ModRunes.lua'
raw = urllib.request.urlopen(url, timeout=30).read()
records = {}
name = None
for line in raw.decode().splitlines():
    match = re.fullmatch(r'\t\[(".*")\] = \{', line)
    if match:
        name = json.loads(match[1])
        records[name] = []
    match = re.fullmatch(r'(\t{4,5})(".*"),', line)
    if match and name:
        text = json.loads(match[2])
        if len(match[1]) == 5:
            text = 'Bonded: ' + text
        if text not in records[name]:
            records[name].append(text)
if not records or any(not lines for lines in records.values()):
    raise ValueError('Unexpected augment source structure')
(ROOT / 'shared/augment-modifiers.json').write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n')
(ROOT / 'shared/augment-modifiers-source.json').write_text(json.dumps({
    'source': url, 'revision': revision, 'sha256': hashlib.sha256(raw).hexdigest(),
    'artworkOwner': 'Grinding Gear Games',
}, indent=2) + '\n')
print(f'{len(records)} augment definitions')
