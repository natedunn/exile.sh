"""Extract tooltip header values from the same pinned PoB sources as the gem catalogue."""

import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "public/gems/v1/catalogue.json"
DESTINATION = ROOT / "public/gems/v1/headers.json"
REVISION = json.loads((ROOT / "public/gems/v1/source.json").read_text())["revision"]
SOURCE = f"https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REVISION}/src/Data/"


def fetch(path):
    data = urllib.request.urlopen(SOURCE + path, timeout=30).read()
    hashes[path] = hashlib.sha256(data).hexdigest()
    return data.decode()


def number(block, key):
    match = re.search(r"\b" + key + r" = (-?\d+(?:\.\d+)?)", block)
    return float(match[1]) if match and "." in match[1] else int(match[1]) if match else None


hashes = {}
references = json.loads(CATALOGUE.read_text())["gems"].values()
game_ids = {gem["gameId"] for gem in references if gem["gameId"]}
skill_ids = {gem["skillId"] for gem in references if gem["skillId"]}

gems = {}
for _, block in re.findall(r'\["([^"]+)"\] = \{(.*?)\n\t\},', fetch("Gems.lua"), re.S):
    game_id_match = re.search(r'\bgameId = "([^"]+)"', block)
    if not game_id_match:
        continue
    game_id = game_id_match[1]
    if game_id not in game_ids:
        continue
    entry = {}
    for key, source_key in (("tier", "Tier"), ("naturalMaxLevel", "naturalMaxLevel"), ("strength", "reqStr"), ("dexterity", "reqDex"), ("intelligence", "reqInt")):
        value = number(block, source_key)
        if value is not None:
            entry[key] = value
    weapon = re.search(r'\bweaponRequirements = "([^"]+)"', block)
    if weapon:
        entry["weapon"] = weapon[1]
    gems[game_id] = entry

skills = {}
for filename in ("act_str", "act_dex", "act_int", "sup_str", "sup_dex", "sup_int", "other"):
    source = fetch(f"Skills/{filename}.lua")
    for skill_id, block in re.findall(r'skills\["([^"]+)"\] = \{(.*?)(?=\nskills\[|\Z)', source, re.S):
        if skill_id not in skill_ids:
            continue
        levels_block = re.search(r"\n\tlevels = \{(.*?)\n\t\},", block, re.S)
        if not levels_block:
            continue
        levels = {}
        for level, line in re.findall(r"^\t\t\[(\d+)\] = \{([^\n]*)\},?$", levels_block[1], re.M):
            entry = {}
            for key in ("levelRequirement", "attackSpeedMultiplier", "baseMultiplier", "critChance", "manaMultiplier"):
                value = number(line, key)
                if value is not None:
                    entry[key] = value
            cost = re.search(r"\bcost = \{([^}]*)\}", line)
            if cost:
                entry["cost"] = {key: float(value) if "." in value else int(value) for key, value in re.findall(r"(\w+) = (-?\d+(?:\.\d+)?)", cost[1])}
            if entry:
                levels[level] = entry
        if levels:
            skills[skill_id] = levels

DESTINATION.write_text(json.dumps({"version": REVISION, "sha256": hashes, "gems": gems, "skills": skills}, separators=(",", ":"), ensure_ascii=False) + "\n")
print(f"Extracted {len(gems)} gem headers and {len(skills)} skill level tables")
