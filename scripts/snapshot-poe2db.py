"""Snapshot PoeDB's per-class modifier pools. Python stdlib only.

PoeDB reads the game files independently of PoB and RePoE, so its pools are
a cross-check on how the importer combines ours, not a data source. Each run
rewrites scripts/data/poe2db-modifier-pools.json; shared/item-registry-poe2db
.test.ts compares it with the generated registry. Run after
update-item-registry.py --refresh (bun run items:refresh runs both).

Base and desecrated modifiers carry no id on PoeDB, so they are keyed by
affix name, level, modifier group and roll numbers: immune to wording
differences, but still telling a one-handed range from a two-handed one.
"""
import datetime
import html
import json
import pathlib
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'scripts/data/poe2db-modifier-pools.json'
SOURCE = 'https://poe2db.tw/us/'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'exile-poe2db-v1'
CACHE.mkdir(exist_ok=True)

# Armour classes are split by attribute requirement on PoeDB; combinations
# the game lacks return 404 and are skipped.
PAGES = [
    'Talismans', 'Bows', 'Quivers', 'Wands', 'Staves', 'Sceptres', 'Quarterstaves',
    'Crossbows', 'Spears', 'Claws', 'Daggers', 'Flails', 'One_Hand_Swords',
    'Two_Hand_Swords', 'One_Hand_Axes', 'Two_Hand_Axes', 'One_Hand_Maces',
    'Two_Hand_Maces', 'Foci', 'Bucklers', 'Amulets', 'Rings', 'Belts', 'Life_Flasks',
    'Mana_Flasks', 'Charms',
] + [
    f'{kind}_{attributes}'
    for kind in ['Body_Armours', 'Helmets', 'Gloves', 'Boots', 'Shields']
    for attributes in ['str', 'dex', 'int', 'str_dex', 'str_int', 'dex_int', 'str_dex_int']
]
INFLUENCES = ['soul', 'berserking', 'decay', 'marksman', 'chronomancy', 'destruction']


def fetch(page):
    """--cached reuses today's downloads while developing the comparison."""
    cached = CACHE / f'{page}.html'
    if '--cached' in sys.argv and cached.exists():
        return cached.read_text(encoding='utf-8')
    request = urllib.request.Request(SOURCE + page, headers={'User-Agent': 'exile.sh item registry cross-check'})
    try:
        body = urllib.request.urlopen(request, timeout=60).read().decode('utf-8')
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise
    cached.write_text(body, encoding='utf-8')
    time.sleep(0.5)  # Politeness: one page at a time.
    return body


def number(value):
    """Same spelling as JavaScript's String(Number(value)): 0.20 -> 0.2."""
    text = ('%f' % float(value)).rstrip('0').rstrip('.')
    return text or '0'


def roll_key(entry):
    plain = html.unescape(re.sub(r'<[^>]+>', '', entry['str']))
    numbers = sorted(number(n) for n in re.findall(r'\d+(?:\.\d+)?', plain))
    return '|'.join([entry['Name'], str(int(entry['Level'])), '+'.join(entry['ModFamilyList']), ','.join(numbers)])


def plain_name(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()


def pools(view):
    found = {
        'normal': sorted(roll_key(x) for x in view.get('normal', [])),
        'desecrated': sorted(roll_key(x) for x in view.get('desecrated', [])),
        'corrupted': sorted(x['Name'] for x in view.get('corrupted', [])),
        'sacrifice': sorted(x['Name'] for x in view.get('corruption_upgrade', [])),
        'essence': sorted({x['Code'] for k in ('essence', 'perfect_essence') for x in view.get(k, [])}),
        'augments': sorted({plain_name(x['Name']) for x in view.get('socketable', [])}),
    }
    for tag in INFLUENCES:
        found[tag] = sorted(x['Code'] for x in view.get(tag, []))
    return {pool: entries for pool, entries in found.items() if entries}


pages = {}
for page in PAGES:
    body = fetch(page)
    start = body.find('ModsView(') if body else -1
    if start < 0:
        continue
    view, _ = json.JSONDecoder().raw_decode(body[start + len('ModsView('):])
    option = view['opt']
    pages[page] = {
        'url': SOURCE + page,
        'itemClass': option['ItemClassesCode'],
        'tags': sorted(t for t in (option.get('tags') or '').split(',') if t),
        'pools': pools(view),
    }
if len(pages) < 40:
    raise SystemExit(f'Only {len(pages)} PoeDB pages carried modifier data; the page format may have changed.')

DEST.write_text(json.dumps({
    'source': SOURCE,
    'captured': datetime.date.today().isoformat(),
    'purpose': 'Independent cross-check of the generated item registry. Not a data source.',
    'pages': pages,
}, indent=1, ensure_ascii=False, sort_keys=True) + '\n', encoding='utf-8')
print('Captured', len(pages), 'PoeDB class pages')
