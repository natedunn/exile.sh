"""Snapshot RePoE equipment metadata and mirror its artwork locally.
Existing image files are keyed by source path and retained; downloads are bounded.
"""
import concurrent.futures, hashlib, json, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = 'https://repoe-fork.github.io/poe2/'
CLASSES = {'Body Armour','Helmet','Gloves','Boots','Shield','Buckler','Focus','One Hand Mace','Two Hand Mace','Warstaff','Spear','Bow','Crossbow','Talisman','Ring','Amulet','Staff','Belt','Wand','Sceptre','Quiver','LifeFlask','ManaFlask','UtilityFlask','Jewel'}
art_dir = ROOT / 'public/equipment'
art_dir.mkdir(exist_ok=True)
raw = {name: urllib.request.urlopen(SOURCE+name+'.min.json',timeout=30).read() for name in ['base_items','uniques']}
data = {k: json.loads(v) for k,v in raw.items()}
records = {'bases': {}, 'uniques': {}}
paths = {}
for kind, items in [('bases',data['base_items']),('uniques',data['uniques'])]:
    for item in items.values():
        if kind == 'bases' and (item.get('release_state') != 'released' or item['item_class'] not in CLASSES):
            continue
        if item.get('is_alternate_art'):
            continue
        path = item.get('visual_identity',{}).get('dds_file','').replace('.dds','.webp')
        if not path.startswith('Art/') or not path.endswith('.webp'):
            continue
        key = hashlib.sha256(path.encode()).hexdigest()[:20]+'.webp'
        paths[key] = path
        if kind == 'uniques' and item['name'] == 'Grand Spectrum':
            base = path.rsplit('_', 1)[-1].removesuffix('.webp')
            records[kind][item['name']+'|'+base] = {'image':'/equipment/'+key,'itemClass':item['item_class'],'width':item['inventory_width'],'height':item['inventory_height']}
        records[kind].setdefault(item['name'], {'image':'/equipment/'+key,'itemClass':item['item_class'],'width':item['inventory_width'],'height':item['inventory_height']})
def download(pair):
    key,path = pair
    dest = art_dir/key
    if dest.exists(): return None
    try:
        response = urllib.request.urlopen(SOURCE+urllib.parse.quote(path),timeout=20)
        content = response.read(1_000_001)
        if len(content)>1_000_000 or content[:4]!=b'RIFF' or content[8:12]!=b'WEBP':
            raise ValueError('Invalid WebP')
        dest.write_bytes(content)
    except Exception:
        return key
failures = [key for key in concurrent.futures.ThreadPoolExecutor(max_workers=6).map(download,paths.items()) if key]
for table in records.values():
    for row in table.values():
        if not (ROOT/'public'/row['image'].lstrip('/')).exists(): row['image'] = ''
(ROOT/'shared/equipment-art.json').write_text(json.dumps(records,separators=(',',':'),ensure_ascii=False)+'\n')
(ROOT/'shared/equipment-art-source.json').write_text(json.dumps({'source':SOURCE,'sha256':{k:hashlib.sha256(v).hexdigest() for k,v in raw.items()},'artworkOwner':'Grinding Gear Games','failedDownloads':failures},indent=2)+'\n')
print(f'{len(records["bases"])} bases, {len(records["uniques"])} uniques; {len(paths)-len(failures)} local images; {len(failures)} unavailable')
