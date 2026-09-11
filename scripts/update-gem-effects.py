"""Generate lazy per-skill numerical tooltip references from pinned PoB data.

Build-time dependencies: lupa (Lua 5.1). No Lua runs in the app or on user input.
Uses PoB's StatDescriber (MIT, public/pob-trees/LICENSE-PoB.txt) with its generated
GGG stat descriptions. Combat mod constructors are inert: we only read literal gem
stats. Actor-level interpolation and build-specific quality bonuses are not guessed.
Quality contributions are displayed separately from base effects.
"""
import hashlib, json, math, pathlib, re, tempfile, urllib.request
from lupa.lua51 import LuaRuntime
ROOT = pathlib.Path(__file__).resolve().parents[1]
REV = 'ce566eac45ea8a86477f513c7ee65a1ebe60014e'
SOURCE = f'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REV}/src/'
DEST = ROOT / 'public/gems/effects-v1'
CACHE = pathlib.Path(tempfile.gettempdir()) / ('exile-gem-effects-' + REV)
CACHE.mkdir(exist_ok=True); DEST.mkdir(parents=True, exist_ok=True)
if (DEST / 'source.json').exists():
    raise SystemExit('Published effects exist; use a new revision to update them.')
hashes = {}
failures = {}
def fetch(path):
    if path in failures: raise RuntimeError(failures[path])
    cached = CACHE / path
    if not cached.exists():
        cached.parent.mkdir(parents=True, exist_ok=True)
        try:
            cached.write_bytes(urllib.request.urlopen(SOURCE + path, timeout=30).read())
        except Exception as error:
            failures[path] = str(error)
            raise
    raw = cached.read_bytes(); hashes[path] = hashlib.sha256(raw).hexdigest()
    return raw.decode()

lua = LuaRuntime(unpack_returned_tuples=True)
lua.execute('''
function enum() return setmetatable({}, {__index=function(t,k) local v=1; for _ in pairs(t) do v=v+1 end; rawset(t,k,v); return v end}) end
SkillType=enum(); ModFlag=enum(); KeywordFlag=enum()
bit={bor=function(...) return 0 end}
function placeholder(...) return {} end
function round(value,places) local scale=10^(places or 0); return math.floor(value*scale+0.5)/scale end
function floor(value,places) local scale=10^(places or 0); return math.floor(value*scale)/scale end
-- StatDescriber copies only the scope list and inserts into that list; its
-- scope entries are read-only. Share entries instead of recursively copying
-- their self-referencing scope lists and the complete description database.
function copyTable(t) local result={} for k,v in pairs(t) do result[k]=v end return result end
''')
skills = lua.table()
for name in ['act_str','act_dex','act_int','sup_str','sup_dex','sup_int','other']:
    lua.execute(fetch('Data/Skills/' + name + '.lua'))(skills, lua.globals().placeholder, lua.globals().placeholder, lua.globals().placeholder)
# Resolve the describer's specific-scope lookup without relying on the shell cwd.
api = f'https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/contents/src/Data/StatDescriptions/Specific_Skill_Stat_Descriptions?ref={REV}'
specific = {item['name'][:-4] for item in json.load(urllib.request.urlopen(api, timeout=30))}
lua.globals().hasSpecific = lambda name: name.rsplit('/',1)[-1].removesuffix('.lua') in specific
lua.execute("io.open=function(path,mode) if hasSpecific(path) then return {close=function() end} end return nil end")
lua.globals().LoadModule = lambda path: lua.execute(fetch(path+'.lua'))
diagnostics = []
lua.globals().ConPrintf = lambda *args: diagnostics.append(str(args))
describe = lua.execute(fetch('Modules/StatDescriber.lua'))
def values(table):
    return [table[i] for i in range(1,len(table)+1)] if table is not None else []
def clean(line):
    return re.sub(r'\[([^\[\]]+)\]', lambda m:m[1].split('|')[-1], line)
def lines(stats,scope,quality=False):
    start=len(diagnostics)
    try:
        out,_ = describe(lua.table_from(stats),scope,quality)
        result=[clean(s) for s in values(out)]
        if len(diagnostics)>start or any(re.search(r'\{[^}]*\}',s) for s in result):
            return [], True
        return result,len(diagnostics)>start
    except Exception as error:
        if str(error) not in diagnostics: print('Translation error:', error, flush=True)
        diagnostics.append(str(error))
        return [],True
catalogue = json.loads((ROOT/'public/gems/v1/catalogue.json').read_text())
required = sorted({r['skillId'] for r in catalogue['gems'].values()})
count = 0
for effect in required:
    assert re.fullmatch(r'[a-zA-Z0-9_]+',effect),effect
    skill=skills[effect]
    if skill is None or skill['statSets'] is None: continue
    result={'sets':{}}
    for index,statset in enumerate(values(skill['statSets']),1):
        scope=statset['statDescriptionScope'] or ('gem_stat_descriptions' if skill['support'] else 'skill_stat_descriptions')
        compiled={'label':statset['label'] or skill['name'],'levels':{},'quality':{}}
        for level,leveldata in statset['levels'].items():
            if not isinstance(level,(float,int)) or not 1<=level<=100: continue
            stats={}; incomplete=False
            for pos,stat in enumerate(values(statset['stats']),1):
                interpolation=leveldata['statInterpolation']
                if interpolation is not None and interpolation[pos] not in [None,1]:
                    incomplete=True;continue
                stats[stat]=leveldata[pos] if leveldata[pos] is not None else 1
            for stat in values(statset['constantStats']): stats[stat[1]]=stats.get(stat[1],0)+(stat[2] or 0)
            rendered,failed=lines(stats,scope)
            compiled['levels'][str(int(level))]={'lines':rendered,'partial':incomplete or failed}
        quality_stats = [s for s in values(skill['qualityStats']) if not values(s[3]) or index-1 in values(s[3])]
        if quality_stats:
            for quality in range(1,101):
                stats={}
                for stat in quality_stats: stats[stat[1]]=stats.get(stat[1],0)+math.trunc(stat[2]*quality)
                rendered,failed=lines(stats,scope,True)
                compiled['quality'][str(quality)]={'lines':rendered,'partial':failed}
        result['sets'][str(index)]=compiled
    (DEST/(effect+'.json')).write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
    count+=1
    if count%100==0:print(count,'skills compiled',flush=True)
(DEST/'source.json').write_text(json.dumps({'source':SOURCE,'revision':REV,'sha256':hashes,'artworkOwner':'Grinding Gear Games','qualityRange':[1,100],'limitations':['Actor-level interpolated values are omitted and marked partial.','Quality effects are separate; equipment, passive and alternate-quality bonuses are not applied.'],'diagnostics':sorted(set(diagnostics))},indent=2)+'\n')
print('Compiled',count,'skills;',len(set(diagnostics)),'unique translation diagnostics',flush=True)
