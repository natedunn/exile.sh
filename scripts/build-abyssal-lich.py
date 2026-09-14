"""Materialize PoB's switchable Lich nodes as an independent Abyssal Lich tree.
Additive assets: existing Lich snapshots/manifests remain immutable.
Run with Pillow and zstandard. Source options are frozen for verification.
"""
import hashlib, io, json, pathlib, struct, urllib.request
from PIL import Image
import zstandard
ROOT=pathlib.Path(__file__).resolve().parents[1]
REV='ce566eac45ea8a86477f513c7ee65a1ebe60014e'
SOURCE=f'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REV}/src/TreeData/'
DEST=ROOT/'public/pob-trees/ascendancies-v1'
(DEST/'icons').mkdir(exist_ok=True)
manifest_path=ROOT/'shared/generated/ascendancy-trees.json'
manifest=json.loads(manifest_path.read_text())
fixtures={}
for version in ['0_3','0_4','0_5']:
    source=json.load(urllib.request.urlopen(SOURCE+version+'/tree.json'))
    base=json.loads((DEST/version/'lich.json').read_text())
    art=json.loads((DEST/version/'lich-art.json').read_text())
    options={key:n.get('options',{}).get('Abyssal Lich',{}) for key,n in source['nodes'].items() if n.get('ascendancyName')=='Lich' and not n.get('isOnlyImage')}
    fixtures[version]=options
    nodes=[]; ids={}
    for node in base['nodes']:
        opt=options.get(node['id'],{})
        new={**node,'ascendancy':'Abyssal Lich','baseId':node['id'],'id':str(opt.get('id',node['id']))}
        for key in ['name','stats','icon']:
            if key in opt:new[key]=opt[key]
        ids[node['id']]=new['id'];nodes.append(new)
    edges=[{**e,'from':ids[e['from']],'to':ids[e['to']]} for e in base['edges']]
    required={n['icon'] for n in nodes}
    missing=required-art.keys()
    for file,entries in source['ddsCoords'].items():
        if not file.startswith('skills_') or not missing.intersection(entries):continue
        raw=zstandard.ZstdDecompressor().decompress(urllib.request.urlopen(SOURCE+version+'/'+file).read())
        assert raw[:4]==b'DDS ' and raw[84:88]==b'DX10'
        fmt,dimension,_,layers,_=struct.unpack('<5I',raw[128:148]);assert fmt==71 and dimension==3
        height,width=struct.unpack('<2I',raw[12:20]);mips=struct.unpack('<I',raw[28:32])[0]
        stride=sum(max(1,((width>>m)+3)//4)*max(1,((height>>m)+3)//4)*8 for m in range(mips))
        assert len(raw)==148+stride*layers
        header=bytearray(raw[:148]);struct.pack_into('<I',header,140,1)
        for path,index in entries.items():
            if path not in missing:continue
            start=148+(index-1)*stride
            image=Image.open(io.BytesIO(header+raw[start:start+stride])).convert('RGBA')
            output=io.BytesIO();image.save(output,format='WEBP',quality=85,method=4)
            content=output.getvalue();name=hashlib.sha256(content).hexdigest()[:24]+'.webp'
            (DEST/'icons'/name).write_bytes(content);art[path]='/pob-trees/ascendancies-v1/icons/'+name
    # MasteryBlank is an intentional socket placeholder shared with Lich.
    assert not {p for p in required-art.keys() if not p.endswith('MasteryBlank.dds')}
    (DEST/version/'abyssal-lich.json').write_text(json.dumps({'nodes':nodes,'edges':edges},separators=(',',':')))
    (DEST/version/'abyssal-lich-art.json').write_text(json.dumps({k:v for k,v in art.items() if k in required},separators=(',',':')))
    manifest[version]=[c for c in manifest[version] if c['value']!='Abyssal Lich']+[{'value':'Abyssal Lich','label':'Abyssal Lich','data':f'/pob-trees/ascendancies-v1/{version}/abyssal-lich.json','art':f'/pob-trees/ascendancies-v1/{version}/abyssal-lich-art.json'}]
    manifest[version].sort(key=lambda c:c['value'])
    print(version,len(nodes),'nodes',flush=True)
manifest_path.write_text(json.dumps(manifest,separators=(',',':')))
(ROOT/'shared/fixtures/pob/abyssal-lich-options.json').write_text(json.dumps({'revision':REV,'source':SOURCE,'versions':fixtures},separators=(',',':')))
