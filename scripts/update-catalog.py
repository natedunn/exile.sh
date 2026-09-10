import json,pathlib,hashlib,urllib.request,datetime
p=pathlib.Path('shared');p.mkdir(exist_ok=True)
url='https://repoe-fork.github.io/poe2/base_items.min.json'
with urllib.request.urlopen(url, timeout=60) as response: raw=response.read()
base=json.loads(raw)
p.joinpath('catalog-source.json').write_text(json.dumps({'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'artworkOwner':'Grinding Gear Games','metadataProject':'RePoE fork'},indent=2)+'\n')
# Catalog all released potential exchange items, so future observations are not limited to the research hour.
classes={'StackableCurrency','SoulCore','Support Skill Gem','Omen','UncutSkillGemStackable','UncutReservationGemStackable','VaultKey','MapFragment','PinnacleKeyStackable','UncutSupportGemStackable','AtlasCurrency','IncubatorStackable','Breachstone','Expedition2Logbooks'}
def category(k,v):
 s=(k+' '+v['name']).lower();c=v['item_class']
 if c=='Omen' or v['name'].startswith('Omen of '):return 'Omens'
 for term,cat in [('essence','Essences'),('omen','Omens'),('rune','Runes'),('soulcore','Soul Cores'),('soul core','Soul Cores'),('uncut','Uncut Gems'),('expedition','Expedition'),('delirium','Delirium'),('distilled','Delirium'),('breach','Breach'),('catalyst','Breach'),('abyss','Abyss'),('idol','Idols'),('incursion','Incursion'),('verisium','Verisium')]:
  if term in s:return cat
 if c=='Support Skill Gem':return 'Lineage Gems'
 if c in {'MapFragment','PinnacleKeyStackable','Breachstone'}:return 'Fragments'
 if c=='VaultKey':return 'Keys'
 if c=='StackableCurrency':return 'Currency'
 return 'Other'
a=[]
for k,v in base.items():
 if v.get('item_class') not in classes or v.get('release_state')!='released':continue
 art=v.get('visual_identity',{}).get('dds_file','')
 a.append({'id':k,'name':v['name'],'category':category(k,v),'icon':'https://repoe-fork.github.io/poe2/'+art.replace('.dds','.webp') if art else '', 'description':v.get('properties',{}).get('description','')})
p.joinpath('catalog.json').write_text(json.dumps(a,ensure_ascii=False,separators=(',',':'))+'\n')
print('catalog entries',len(a))
