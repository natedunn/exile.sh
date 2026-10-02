"""Build the item reference from PoB and RePoE. Python stdlib only.

Run with --refresh to deliberately replace a published snapshot. Ordinary runs
verify source hashes and refuse to silently change the published game data.
PoB's visible bases provide an allowlist: RePoE contains inherited PoE1 content.
This is a reference catalogue, not proof of crafting reachability.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import sys
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/items/v1'
REV = 'ce566eac45ea8a86477f513c7ee65a1ebe60014e'
POB = f'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REV}/src/Data/'
REPOE = 'https://repoe-fork.github.io/poe2/'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'exile-item-registry-v1'
CACHE.mkdir(exist_ok=True)
manifest = DEST / 'source.json'
previous = json.loads(manifest.read_text()) if manifest.exists() else None
hashes = {}


def fetch(url):
    cached = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if '--refresh' in sys.argv or not cached.exists():
        cached.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    raw = cached.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    # Sources new to this importer have no recorded hash yet; record them.
    if previous and '--refresh' not in sys.argv and url in previous['sha256'] and previous['sha256'][url] != digest:
        raise ValueError(f'Source changed: {url}. Review and use --refresh intentionally.')
    hashes[url] = digest
    return raw.decode()


def clean(text):
    return re.sub(r'\[([^\[\]]+)\]', lambda m: m[1].split('|')[-1], text)


def mod_text(text):
    """Modifier text with every roll range written low to high. The export
    keeps a negative stat's order, so "reduced" lines read "(60-56)%"."""
    def ordered(m):
        low, high = sorted([m[1], m[2]], key=float)
        return f'({low}-{high})'
    return re.sub(r'\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)', ordered, clean(text))


def item_class(text):
    return {'UtilityFlask': 'Charm', 'LifeFlask': 'Life Flask', 'ManaFlask': 'Mana Flask', 'TrapTool': 'Trap Tool'}.get(text, text)


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


files = {}
for directory in ['Bases', 'Uniques']:
    url = f'https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/contents/src/Data/{directory}?ref={REV}'
    files[directory] = [f['name'] for f in json.loads(fetch(url)) if f['name'].endswith('.lua')]
urls = [REPOE + name + '.min.json' for name in ['base_items', 'mods', 'uniques', 'augments']]
urls += [POB + name for name in ['ModItem.lua', 'ModFlask.lua', 'ModCharm.lua', 'ModJewel.lua', 'ModCorrupted.lua', 'ModVeiled.lua', 'Essence.lua']]
urls += [POB + directory + '/' + name for directory, names in files.items() for name in names]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    sources = dict(zip(urls, pool.map(fetch, urls)))
raw_bases = json.loads(sources[REPOE + 'base_items.min.json'])
raw_mods = json.loads(sources[REPOE + 'mods.min.json'])
raw_uniques = json.loads(sources[REPOE + 'uniques.min.json'])
raw_augments = json.loads(sources[REPOE + 'augments.min.json'])
visible_names = set()
base_hints = {}
for name in files['Bases']:
    for match in re.finditer(r'itemBases\["([^"]+)"\] = \{\n(.*?)\n\}', sources[POB + 'Bases/' + name], re.S):
        if not re.search(r'\bhidden = true', match[2]) or match[1].startswith(('Runeforged ', 'Runemastered ')):
            visible_names.add(match[1])
            tags = re.search(r'tags = \{([^}]+)\}', match[2])
            hint = set(re.findall(r'(\w+) = true', tags[1])) if tags else set()
            implicit = re.search(r'\bimplicit = ("(?:[^"\\]|\\.)*")', match[2])
            req = re.search(r'\breq = \{([^}]*)\}', match[2])
            requirements = { {'str': 'strength', 'dex': 'dexterity', 'int': 'intelligence'}.get(k, k): int(v) for k, v in re.findall(r'(\w+) = (\d+)', req[1] if req else '') }
            armour = re.search(r'\barmour = \{([^}]*)\}', match[2])
            stats = {k: float(v) for k, v in re.findall(r'(\w+) = ([\d.]+)', armour[1] if armour else '')}
            base_hints.setdefault(match[1], []).append({
                'armour': stats,
                'tags': {tag for tag in hint if not tag.startswith('genesis_tree_')},
                'implicits': json.loads(implicit[1]).split('\n') if implicit else [],
                'requirements': requirements,
            })

mod_ids = set()
veiled_ids = set()
for name in ['ModItem.lua', 'ModFlask.lua', 'ModCharm.lua', 'ModJewel.lua', 'ModCorrupted.lua', 'ModVeiled.lua']:
    ids = set(re.findall(r'\["([^"]+)"\] =', sources[POB + name]))
    mod_ids.update(ids)
    if name == 'ModVeiled.lua':
        veiled_ids = ids

mods = {}
for key, value in raw_mods.items():
    # Orb of Sacrifice upgrades a corruption implicit into a stronger one.
    # The export files these under "unique" and PoB has no table for them,
    # but their spawn weights are ordinary base tags.
    sacrifice = key.startswith('CorruptionUpgrade') and value['generation_type'] == 'unique'
    # Keep special sources in the reference pool, never present them as normal rolls.
    if value['generation_type'] not in ['prefix', 'suffix', 'corrupted', 'instilled'] and not sacrifice:
        continue
    if value['domain'] not in ['item', 'flask', 'misc', 'jewel', 'abyss_jewel', 'desecrated']:
        continue
    if (key not in mod_ids and not sacrifice) or not value.get('text') or 'UNUSED' in key.upper():
        continue
    mods[key] = {
        'id': key, 'name': value['name'], 'text': mod_text(value['text']),
        'level': value['required_level'], 'affix': 'corrupted' if sacrifice else value['generation_type'],
        'groups': value['groups'], 'tags': value['implicit_tags'],
        'addsTags': value['adds_tags'], 'domain': value['domain'],
        'eligibility': [{'tag': w['tag'], 'allowed': w['weight'] > 0} for w in value['spawn_weights']],
        'source': 'sacrifice' if sacrifice else 'essence' if value['is_essence_only'] else (
            'desecrated' if value['domain'] == 'desecrated' or key in veiled_ids else (
                'corruption' if value['generation_type'] == 'corrupted' else (
                    'instilling' if value['generation_type'] == 'instilled' else 'normal'))),
    }

# Essences name their modifier per item class. Display modifiers stand in for
# "one of" outcomes and carry no generation type, so their affix is fixed here.
ESSENCE_AFFIX = {'EssenceDisplayAttributes': 'suffix', 'EssenceDisplayDefences': 'prefix'}
# A display modifier's real outcomes are the ordinary modifiers with exactly
# its roll range on a matching stat: Lesser Essence of Enhancement's
# (27-42)% is the tier-two local Armour, Evasion or Energy Shield modifier.
# Pages keep the outcomes their base can roll.
ESSENCE_FAMILY = {'EssenceDisplayAttributes': r'strength|dexterity|intelligence', 'EssenceDisplayDefences': r'armour|evasion|energy_shield|physical_damage_reduction'}


def essence_outcomes(mod_id, affix):
    display = raw_mods[mod_id]
    family = ESSENCE_FAMILY.get(display['groups'][0]) if display['groups'] else None
    if not family:
        return [mod_id]
    (stat,) = display['stats']
    # "+(9-12) to Strength" and "(7-10)% increased Strength" share a family.
    percent = lambda stat_id: '+%' in stat_id or stat_id.endswith('_increase')

    def same_roll(key, value):
        stats = value['stats']
        return (
            len(stats) == 1 and re.search(family, stats[0]['id'])
            and (stats[0]['min'], stats[0]['max']) == (stat['min'], stat['max'])
            and percent(stat['id']) == percent(stats[0]['id'])
        )
    # The game's essence table pairs Enhancement with one outcome per
    # single- or two-attribute armour type; the Str/Dex/Int hybrid shares the
    # roll range but is not an outcome (cross-checked with PoeDB, 2026-10-02).
    three_way = lambda key: all(part in raw_mods[key]['stats'][0]['id'] for part in ('armour', 'evasion', 'energy_shield'))
    found = sorted(
        key for key, value in mods.items()
        if value['source'] == 'normal' and value['affix'] == affix and same_roll(key, raw_mods[key]) and not three_way(key)
    )
    # Some outcomes exist only on essences (Perfect Essence of the Infinite's
    # "% increased Strength"). They carry no base weights, so all are kept.
    if not found:
        found = sorted(
            key for key, value in raw_mods.items()
            if key.startswith('Essence') and not key.startswith('EssenceDisplay')
            and value['generation_type'] == affix and value['domain'] == 'item' and same_roll(key, value)
        )
    return found
essences = []
essence_diagnostics = []
for match in re.finditer(r'\["([^"]+)"\] = \{ name = "([^"]+)", type = "([^"]+)", tierLevel = (\d+), mods = \{(.*?)\}, \}', sources[POB + 'Essence.lua']):
    outcomes = {}
    for cls, mod_id in re.findall(r'\["([^"]+)"\] = "([^"]+)"', match[5]):
        value = raw_mods.get(mod_id)
        affix = value and (value['generation_type'] if value['generation_type'] in ['prefix', 'suffix'] else ESSENCE_AFFIX.get(mod_id.rstrip('0123456789')))
        if not value or not value.get('text') or not affix:
            essence_diagnostics.append({'essence': match[2], 'itemClass': cls, 'mod': mod_id})
            continue
        found = essence_outcomes(mod_id, affix)
        if not found:
            essence_diagnostics.append({'essence': match[2], 'itemClass': cls, 'mod': mod_id, 'reason': 'No concrete outcome'})
            continue
        outcomes[cls] = [{'id': key, 'text': mod_text(raw_mods[key]['text']), 'affix': affix} for key in found]
    if outcomes:
        essences.append({'id': match[1], 'name': match[2], 'type': match[3], 'level': int(match[4]), 'mods': outcomes})

# Augment slots name item-class families; map each onto catalogue classes.
MARTIAL = ['One Hand Sword', 'One Hand Axe', 'One Hand Mace', 'Claw', 'Dagger', 'Spear', 'Flail', 'Two Hand Sword', 'Two Hand Axe', 'Two Hand Mace', 'Warstaff', 'Bow', 'Crossbow', 'Talisman']
ARMOUR = ['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus']
CASTER = ['Wand', 'Staff']
AUGMENT_SLOTS = {
    'All': MARTIAL + CASTER + ['Sceptre'] + ARMOUR, 'Armour': ARMOUR,
    'Martial Weapon': MARTIAL, 'Caster Weapon': CASTER + ['Sceptre'], 'Wand or Staff': CASTER,
    'Martial Or Caster Weapon': MARTIAL + CASTER + ['Sceptre'],
    'Martial Weapon Wand or Staff': MARTIAL + CASTER,
    'Shield or Buckler': ['Shield', 'Buckler'], 'Quarterstaff': ['Warstaff'],
    'Maces or Talisman': ['One Hand Mace', 'Two Hand Mace', 'Talisman'],
    'One Hand Mace or Quarterstaff': ['One Hand Mace', 'Warstaff'],
    'Quarterstaff or Spear': ['Warstaff', 'Spear'],
    'Crossbow Bow or Spear': ['Crossbow', 'Bow', 'Spear'],
}
AUGMENT_TYPES = {'Rune': 'Rune', 'SoulCore': 'Soul Core', 'Idol': 'Idol', 'AbyssalEye': 'Abyssal Eye', 'CongealedMist': 'Congealed Mist'}
augments = []
augment_diagnostics = []
for key, value in raw_augments.items():
    base = raw_bases.get(key)
    if not base or base.get('release_state') != 'released':
        augment_diagnostics.append({'id': key, 'reason': 'No released base item'})
        continue
    effects = []
    for slot, effect in value['categories'].items():
        if slot not in AUGMENT_SLOTS:
            if slot not in ARMOUR + MARTIAL + CASTER + ['Sceptre']:
                augment_diagnostics.append({'id': key, 'reason': 'Unknown slot ' + slot})
                continue
            AUGMENT_SLOTS[slot] = [slot]
        # Some stats have no translation in the export; record rather than invent them.
        if effect.get('stats') and not effect.get('stat_text'):
            augment_diagnostics.append({'id': key, 'reason': 'Untranslated stats for ' + slot})
        text = [mod_text(t) for t in effect.get('stat_text', [])]
        bonded = [mod_text(t) for t in effect.get('bonded_stat_text', [])]
        if text or bonded:
            effects.append({'slot': slot, 'text': text, 'bonded': bonded})
    image = base.get('visual_identity', {}).get('dds_file', '')
    augments.append({
        'id': key, 'name': base['name'], 'type': AUGMENT_TYPES.get(value['type_id'], value['type_id']),
        'level': value.get('required_level', 0), 'image': REPOE + image.replace('.dds', '.webp') if image else '',
        'effects': effects,
    })
augments.sort(key=lambda a: (a['type'], a['level'], a['name']))

# An influence's modifiers only spawn once its warp rune ("Can roll Soul
# modifiers") is socketed, and each rune fits one slot. The modifiers' own
# weights carry no item-class limit, so the rune's slot is the only gate.
influences = []
for key, value in raw_augments.items():
    for slot, effect in value['categories'].items():
        for line in effect.get('stat_text', []):
            found = re.fullmatch(r'Can roll (\w+) modifiers', clean(line))
            if found:
                influences.append({'tag': found[1].lower(), 'label': found[1], 'rune': raw_bases[key]['name'], 'classes': AUGMENT_SLOTS[slot]})
INFLUENCE_ORDER = ['soul', 'berserking', 'decay', 'marksman', 'chronomancy', 'destruction']
influences.sort(key=lambda i: INFLUENCE_ORDER.index(i['tag']) if i['tag'] in INFLUENCE_ORDER else len(INFLUENCE_ORDER))
# A pool whose rune is missing from the export would show on nothing; stop
# rather than silently drop it.
unknown = sorted(set(INFLUENCE_ORDER) - {i['tag'] for i in influences})
if unknown:
    raise ValueError('Influence tags with no warp rune: ' + ', '.join(unknown))

def matching_hint(value):
    hints = [h for h in base_hints[value['name']] if h['tags'] == set(value['tags'])]
    if len(hints) == 1:
        return hints[0]
    implicit_text = [clean(raw_mods[i]['text']) for i in value['implicits'] if raw_mods.get(i, {}).get('text')]
    exact = [h for h in hints if [clean(t) for t in h['implicits']] == implicit_text]
    if exact:
        hints = exact
    for key, prop in [('Armour', 'armour'), ('Evasion', 'evasion'), ('EnergyShield', 'energy_shield')]:
        expected = value['properties'].get(prop, {}).get('min', 0)
        exact = [h for h in hints if h['armour'].get(key, 0) == expected]
        if exact:
            hints = exact
    # Do not borrow stats or implicits from another same-name base.
    if hints and all(h == hints[0] for h in hints):
        return hints[0]
    return None


bases = {}
base_diagnostics = []
for key, value in raw_bases.items():
    if value['name'] not in visible_names or value.get('release_state') != 'released':
        continue
    if value['domain'] not in ['item', 'flask', 'misc', 'jewel', 'abyss_jewel']:
        continue
    if not any(set(value['tags']) == hint['tags'] for hint in base_hints[value['name']]):
        continue
    image = value.get('visual_identity', {}).get('dds_file', '')
    same_name = [b for b in raw_bases.values() if b['name'] == value['name'] and b.get('release_state') == 'released' and any(set(b['tags']) == hint['tags'] for hint in base_hints[value['name']])]
    item_slug = 'base-' + slug(value['name']) + ('-' + slug(key.split('/')[-1]) if len(same_name) > 1 else '')
    if item_slug in bases:
        raise ValueError('Duplicate base slug: ' + item_slug)
    hint = matching_hint(value)
    if not hint:
        base_diagnostics.append({'id': key, 'reason': 'Ambiguous PoB definition'})
        continue
    properties = dict(value['properties'])
    ward = hint['armour'].get('Ward')
    if ward is not None:
        properties['ward'] = {'min': int(ward), 'max': int(ward)}
    bases[item_slug] = {
        'id': key, 'slug': item_slug, 'kind': 'base', 'name': value['name'],
        'itemClass': item_class(value['item_class']), 'domain': value['domain'], 'tags': value['tags'],
        'image': REPOE + image.replace('.dds', '.webp') if image else '',
        'dropLevel': value['drop_level'], 'requirements': hint['requirements'],
        'properties': properties,
        'form': 'runemastered' if value['name'].startswith('Runemastered ') else ('runeforged' if value['name'].startswith('Runeforged ') or 'runeforged' in value['tags'] else 'original'),
        'implicits': [clean(text) for text in hint['implicits']],
    }

# Unique-only bases can be hidden in PoB, so resolve them separately but require
# a released RePoE base and a name in RePoE's unique stash catalogue.
by_name = {}
for value in raw_bases.values():
    if value.get('release_state') == 'released':
        by_name.setdefault(value['name'], []).append(value)
unique_art = {}
for value in raw_uniques.values():
    if not value.get('is_alternate_art'):
        unique_art.setdefault(value['name'], []).append(value)
uniques = {}
diagnostics = []
for name in files['Uniques']:
    for block in re.findall(r'\[\[(.*?)\]\]', sources[POB + 'Uniques/' + name], re.S):
        lines = [line.strip() for line in block.strip().splitlines() if line.strip()]
        if len(lines) < 2 or lines[0] not in unique_art:
            continue
        item_name, base_name = lines[:2]
        candidates = by_name.get(base_name, [])
        if not candidates or len({candidate['item_class'] for candidate in candidates}) != 1:
            diagnostics.append({'name': item_name, 'reason': 'No unambiguous released base'})
            continue
        variants = [line[len('Variant: '):] for line in lines if line.startswith('Variant: ')]
        versions = [line[len('Version: '):] for line in lines if line.startswith('Version: ')]
        current_version = next((i + 1 for i, label in enumerate(versions) if label == 'Current'), len(versions))
        complex_item = any(line.startswith('Has Alt Variant') for line in lines)
        implicit_count = next((int(line.split(': ')[1]) for line in lines if line.startswith('Implicits: ')), 0)
        options = [{'id': i + 1, 'name': label} for i, label in enumerate(variants) if not re.search(r'\bPre \d|^\d+\.\d', label)]
        if not options:
            options = [{'id': 0, 'name': 'Current'}]
        valid_ids = {option['id'] for option in options}
        effects = []
        metadata = {}
        for line in lines[2:]:
            if re.match(r'^(Variant|Version|Selected |Has Alt |Allow Duplicate|Implicits|Crafted)', line):
                continue
            if line.startswith(('League:', 'Source:', 'Requires Level ', 'Limited to:', 'Radius:', 'Sockets:')):
                metadata[line.split(':')[0].split('Requires')[0] or 'requirements'] = line
                continue
            version_match = re.search(r'\{version:([\d,]+)\}', line)
            if version_match and current_version not in [int(i) for i in version_match[1].split(',')]:
                continue
            variant_match = re.search(r'\{variant:([\d,]+)\}', line)
            variant_ids = [int(i) for i in variant_match[1].split(',')] if variant_match else []
            if variant_ids:
                variant_ids = [i for i in variant_ids if i in valid_ids]
                if not variant_ids:
                    continue
            text = re.sub(r'\{(?:variant|version|tags|group):[^}]*\}|\{(?:desecrated|unscalable)\}', '', line)
            if re.search(r'\{[^}]*\}', text):
                raise ValueError(f'Unhandled modifier markup for {item_name}: {text}')
            effects.append({'text': clean(text), 'variants': variant_ids})
        art_options = unique_art[item_name]
        art = next((art for art in art_options if base_name.lower() in art['visual_identity'].get('dds_file', '').lower()), art_options[0])
        image = art['visual_identity'].get('dds_file', '')
        item_slug = 'unique-' + slug(item_name) + '-' + slug(base_name)
        if item_slug in uniques:
            raise ValueError('Ambiguous unique: ' + item_name)
        uniques[item_slug] = {
            'slug': item_slug, 'kind': 'unique', 'name': item_name, 'baseName': base_name,
            'baseSlug': 'base-' + slug(base_name) if 'base-' + slug(base_name) in bases else None,
            'itemClass': item_class(candidates[0]['item_class']),
            'image': REPOE + image.replace('.dds', '.webp') if image else '',
            'variants': options, 'complex': complex_item,
            'implicitCount': implicit_count, 'modifiers': effects,
            'metadata': list(metadata.values()),
        }

# Recipe edges are reviewed separately; base name similarity is never evidence
# that a particular unique can be upgraded to a form.
recipe_file = ROOT / 'scripts/data/unique-runeforging.json'
recipes = json.loads(recipe_file.read_text())
base_by_id = {b['id']: b for b in bases.values()}
for record in recipes['uniques']:
    matches = [u for u in uniques.values() if u['name'] == record['name']]
    if len(matches) != 1:
        raise ValueError('Ambiguous recipe unique: ' + record['name'])
    unique = matches[0]
    paths = []
    reachable = {unique['baseSlug']}
    for path in record['paths']:
        source, target = base_by_id[path['from']], base_by_id[path['to']]
        if source['slug'] not in reachable or source['itemClass'] != target['itemClass']:
            raise ValueError('Disconnected recipe: ' + record['name'])
        reachable.add(target['slug'])
        paths.append({'from': source['slug'], 'to': target['slug'], 'craftId': path['craftId']})
    unique['runeforging'] = {'source': record['source'], 'sourceVersion': record['sourceVersion'], 'paths': paths}

# Published recipe rows provide broader coverage. Resolve exact names only
# when the imported identity is unique; never pick an arbitrary same-name base.
published_file = ROOT / 'scripts/data/runeforging-recipes.json'
published = json.loads(published_file.read_text())
recipe_diagnostics = []
for unique in uniques.values():
    if unique.get('runeforging'):
        continue
    rows = [r for r in published['rows'] if r['name'] == unique['name']]
    paths = []
    reachable = {unique['baseSlug']}
    pending = list(enumerate(rows))
    while pending:
        remaining = []
        for index, row in pending:
            inputs = [b for b in bases.values() if b['name'] == row['from'] and b['itemClass'] == unique['itemClass']]
            outputs = [b for b in bases.values() if b['name'] == row['to'] and b['itemClass'] == unique['itemClass']]
            if len(inputs) != 1 or len(outputs) != 1:
                recipe_diagnostics.append({'unique': unique['name'], 'from': row['from'], 'to': row['to'], 'reason': 'Missing or ambiguous base identity'})
                continue
            if inputs[0]['slug'] not in reachable or inputs[0]['slug'] == outputs[0]['slug']:
                remaining.append((index, row))
                continue
            reachable.add(outputs[0]['slug'])
            paths.append({'from': inputs[0]['slug'], 'to': outputs[0]['slug'], 'craftId': index})
        if len(remaining) == len(pending):
            recipe_diagnostics.extend({'unique': unique['name'], **row, 'reason': 'Disconnected or self-referential recipe'} for _, row in remaining)
            break
        pending = remaining
    if paths:
        unique['runeforging'] = {'source': published['source'], 'sourceVersion': 'Reviewed ' + published['reviewed'], 'paths': paths}

DEST.mkdir(parents=True, exist_ok=True)
# Split heavy modifier data from the searchable catalogue; loaded on base pages only.
for filename, data in [('catalogue.json', {'version': 'v1', 'items': {**bases, **uniques}}), ('modifiers.json', {'mods': mods, 'essences': essences, 'augments': augments, 'augmentSlots': AUGMENT_SLOTS, 'influences': influences})]:
    (DEST / filename).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
manifest.write_text(json.dumps({
    'pobRevision': REV, 'repoeSource': REPOE,
    'runeforgingMappings': {'file': 'scripts/data/unique-runeforging.json', 'sha256': hashlib.sha256(recipe_file.read_bytes()).hexdigest(), 'coverage': 'Published unique recipes resolved only against unambiguous imported base identities; unresolved paths are excluded. Absence does not mean an upgrade is impossible.', 'uniques': sum('runeforging' in u for u in uniques.values()), 'publishedRecipes': {'file': 'scripts/data/runeforging-recipes.json', 'sha256': hashlib.sha256(published_file.read_bytes()).hexdigest(), 'source': published['source']}},
    'sha256': dict(sorted(hashes.items())), 'artworkOwner': 'Grinding Gear Games',
    'counts': {'bases': len(bases), 'uniques': len(uniques), 'modifiers': len(mods), 'essences': len(essences), 'augments': len(augments)},
    'limitations': ['Reference data does not prove crafting reachability.', 'Complex multi-variant uniques are reference-only.', 'Hidden PoB bases are excluded except released Runeforged and Runemastered forms. Ambiguous base definitions are excluded.', 'PoB and RePoE releases may differ; source hashes identify the exact inputs.'],
    'diagnostics': diagnostics, 'baseDiagnostics': base_diagnostics, 'recipeDiagnostics': recipe_diagnostics,
    'essenceDiagnostics': essence_diagnostics, 'augmentDiagnostics': augment_diagnostics,
}, indent=2) + '\n')
print('Imported', len(bases), 'bases,', len(uniques), 'uniques,', len(mods), 'modifiers,', len(essences), 'essences,', len(augments), 'augments;', len(diagnostics), 'excluded uniques')
