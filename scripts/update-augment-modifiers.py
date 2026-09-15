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
references = {}
name = None
application = None
for line in raw.decode().splitlines():
    match = re.fullmatch(r'\t\[(".*")\] = \{', line)
    if match:
        name = json.loads(match[1])
        application = None
        records[name] = []
        references[name] = {'applications': []}
    match = re.fullmatch(r'\t\t\[(".*")\] = \{', line)
    if match and name:
        application = {'slot': json.loads(match[1]), 'lines': [], 'bonded': []}
        references[name]['applications'].append(application)
    match = re.fullmatch(r'\t{4}(type|limit|levelReq) = (.*),', line)
    if match and name:
        key = {'type': 'type', 'limit': 'limit', 'levelReq': 'level'}[match[1]]
        value = json.loads(match[2])
        if key in references[name] and references[name][key] != value:
            raise ValueError(f'Inconsistent {key} for {name}')
        references[name][key] = value
    match = re.fullmatch(r'(\t{4,5})(".*"),', line)
    if match and name:
        text = json.loads(match[2])
        if application is None:
            raise ValueError('Augment effect without application')
        application['bonded' if len(match[1]) == 5 else 'lines'].append(text)
        if len(match[1]) == 5:
            text = 'Bonded: ' + text
        if text not in records[name]:
            records[name].append(text)
if not records or any(not lines for lines in records.values()):
    raise ValueError('Unexpected augment source structure')
if any(not ref.get('type') or not ref['applications'] for ref in references.values()):
    raise ValueError('Incomplete augment reference')
(ROOT / 'shared/augment-modifiers.json').write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n')
(ROOT / 'shared/augment-modifiers-source.json').write_text(json.dumps({
    'source': url, 'revision': revision, 'sha256': hashlib.sha256(raw).hexdigest(),
    'artworkOwner': 'Grinding Gear Games',
}, indent=2) + '\n')
destination = ROOT / 'public/augments/v1'
destination.mkdir(parents=True, exist_ok=True)
(destination / 'catalogue.json').write_text(json.dumps(references, separators=(',', ':'), ensure_ascii=False) + '\n')
(destination / 'source.json').write_text(json.dumps({
    'source': url, 'revision': revision, 'sha256': hashlib.sha256(raw).hexdigest(),
    'artworkOwner': 'Grinding Gear Games',
}, indent=2) + '\n')
print(f'{len(records)} augment definitions')
