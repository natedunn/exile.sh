"""Build support-to-skill matches from the catalogue's pinned PoB skill data.

Only generated Lua literals are parsed. Upstream code is never executed.
Matches use base skill types; build-specific type changes are out of scope.
"""

import hashlib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
GEMS = ROOT / "public/gems/v1"
SOURCE = json.loads((GEMS / "source.json").read_text())
CATALOGUE = json.loads((GEMS / "catalogue.json").read_text())["gems"]
FILES = ("act_str", "act_dex", "act_int", "sup_str", "sup_dex", "sup_int", "other")
TOKEN = re.compile(r"SkillType\.([A-Za-z0-9_]+)")


def fetch(name):
    url = SOURCE["source"] + "Skills/" + name + ".lua"
    raw = urllib.request.urlopen(url, timeout=30).read()
    assert hashlib.sha256(raw).hexdigest() == SOURCE["sha256"][url], url
    return raw.decode()


def field(block, name):
    match = re.search(r"^\t" + name + r" = ([^\n]+)$", block, re.M)
    return match[1] if match else ""


def expression(block, name):
    return TOKEN.findall(field(block, name))


def type_set(block, name):
    return set(re.findall(r"\[SkillType\.([A-Za-z0-9_]+)\] = true", field(block, name)))


def matches(expression, types):
    stack = []
    for token in expression:
        if token == "NOT":
            if not stack:
                raise ValueError("Invalid skill type expression: NOT")
            stack[-1] = not stack[-1]
        elif token in ("AND", "OR"):
            if len(stack) < 2:
                raise ValueError("Invalid skill type expression: " + token)
            right = stack.pop()
            left = stack.pop()
            stack.append(left and right if token == "AND" else left or right)
        else:
            stack.append(token in types)
    return any(stack)


skills = {}
for name in FILES:
    for skill_id, block in re.findall(
        r'skills\["([^"]+)"\] = \{(.*?)(?=\nskills\[|\Z)', fetch(name), re.S
    ):
        skills[skill_id] = {
            "types": type_set(block, "skillTypes"),
            "minionTypes": type_set(block, "minionSkillTypes"),
            "requires": expression(block, "requireSkillTypes"),
            "excludes": expression(block, "excludeSkillTypes"),
            "ignoreMinionTypes": field(block, "ignoreMinionTypes") == "true,",
            "cannotBeSupported": field(block, "cannotBeSupported") == "true,",
        }

skill_refs = {
    key: value
    for key, value in CATALOGUE.items()
    if value["gameId"]
    and not value["support"]
    and value["skillId"] in skills
    and "{" not in value["name"]
}
supports = {
    value["skillId"]: value
    for value in CATALOGUE.values()
    if value["gameId"] and value["support"] and value["skillId"] in skills
}
assert len(skill_refs) >= 350 and len(supports) >= 500

skill_keys = sorted(skill_refs, key=lambda key: skill_refs[key]["name"].casefold())
compatible = {}
for support_id in supports:
    support = skills[support_id]
    matched = []
    for index, key in enumerate(skill_keys):
        ref = skill_refs[key]
        skill = skills[ref["skillId"]]
        if skill["cannotBeSupported"] or not skill["types"]:
            continue
        if support["excludes"] and matches(support["excludes"], skill["types"]):
            continue
        required_types = skill["types"].copy()
        if not support["ignoreMinionTypes"]:
            required_types |= skill["minionTypes"]
        if support["requires"] and not matches(support["requires"], required_types):
            continue
        matched.append(index)
    compatible[support_id] = matched

output = {
    "sourceRevision": SOURCE["revision"],
    "scope": "Base gem skill types; build-specific support and minion type changes are excluded.",
    "skills": skill_keys,
    "supports": compatible,
}
(GEMS / "support-compatibility.json").write_text(
    json.dumps(output, separators=(",", ":"), ensure_ascii=False) + "\n"
)
print(
    f"{len(supports)} supports checked against {len(skill_refs)} skills; "
    f"{sum(len(match) for match in compatible.values())} matches"
)
