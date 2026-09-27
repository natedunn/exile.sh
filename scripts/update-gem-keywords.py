"""Mirror PoE2 keyword definitions and link labels from RePoE game data."""

import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/gems/v1"
CATALOGUE = DEST / "catalogue.json"
BASE = "https://repoe-fork.github.io/poe2/"
KEYWORDS_URL = BASE + "keywords.min.json"
SKILLS_URL = BASE + "skills.min.json"
LINK = re.compile(r"\[([^\]|]+)(?:\|([^\]]+))?\]")


def fetch(url):
    raw = urllib.request.urlopen(url, timeout=30).read()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


keywords, keywords_hash = fetch(KEYWORDS_URL)
skills, skills_hash = fetch(SKILLS_URL)
definitions = {
    key: {"term": row["term"], "definition": row["definition"]}
    for key, row in keywords.items()
    if row.get("term") and row.get("definition")
}


def compact(text):
    return re.sub(r"[^a-z0-9]", "", text.casefold())


aliases = {}
for key, row in sorted(definitions.items()):
    aliases.setdefault(row["term"].casefold(), key)
    # An ID such as Physical or Shock is also the game's short display name.
    if re.fullmatch(r"[A-Z][a-zA-Z]+", key):
        aliases.setdefault(key.casefold(), key)


def source_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from source_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from source_strings(child)


for text in source_strings(skills):
    for key, label in LINK.findall(text):
        if key not in definitions:
            continue
        label = label or key
        # Game markup sometimes uses a generic label for a specific keyword,
        # such as [Hit|Damage]. Only match labels that name that keyword.
        if compact(label).startswith(compact(key)) or compact(key).startswith(compact(label)):
            aliases.setdefault(label.casefold(), key)

for text in source_strings(definitions):
    for key, label in LINK.findall(text):
        if key not in definitions:
            continue
        label = label or key
        if compact(label).startswith(compact(key)) or compact(key).startswith(compact(label)):
            aliases.setdefault(label.casefold(), key)


def plain(text):
    return LINK.sub(lambda match: match[2] or match[1], text)


catalogue = json.loads(CATALOGUE.read_text())
descriptions = {gem["skillId"]: gem["description"] for gem in catalogue["gems"].values() if gem.get("skillId") and gem.get("description")}
linked_descriptions = {}
for skill_id, skill in skills.items():
    active = skill.get("active_skill") if isinstance(skill, dict) else None
    description = active.get("description") if isinstance(active, dict) else None
    if description and "[" in description and plain(description) == descriptions.get(skill_id):
        linked_descriptions[skill_id] = description

snapshot = {
    "source": KEYWORDS_URL,
    "sha256": keywords_hash,
    "keywords": definitions,
}
alias_snapshot = {
    "sources": {KEYWORDS_URL: keywords_hash, SKILLS_URL: skills_hash},
    "aliases": dict(sorted(aliases.items())),
    "descriptions": linked_descriptions,
}
(DEST / "keywords.json").write_text(
    json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n"
)
(DEST / "keyword-aliases.json").write_text(
    json.dumps(alias_snapshot, ensure_ascii=False, separators=(",", ":")) + "\n"
)
print(f"Mirrored {len(definitions)} keyword definitions, {len(aliases)} labels, and {len(linked_descriptions)} linked descriptions")
