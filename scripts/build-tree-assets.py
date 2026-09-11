"""Generate version-pinned geometry, retaining signed connection orbits.

Connector rules reference PoB PassiveTree.lua (MIT; license shipped with assets).
The v3 path preserves keystone classification and leaves earlier assets intact.
"""
import json, math, pathlib, urllib.request
REVISION = "ce566eac45ea8a86477f513c7ee65a1ebe60014e"
root = pathlib.Path(__file__).resolve().parents[1] / "public/pob-trees/v3"
root.mkdir(exist_ok=True)
for version in ["0_1", "0_2", "0_3", "0_4", "0_5"]:
    target = root / (version + ".json")
    if target.exists():
        continue
    url = f"https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{REVISION}/src/TreeData/{version}/tree.json"
    data = json.load(urllib.request.urlopen(url))
    groups = data["groups"]
    groups = groups.values() if isinstance(groups, dict) else groups
    by_node = {str(n): g for g in groups if g for n in g.get("nodes", [])}
    result = {}
    angles = {}
    for key, n in data["nodes"].items():
        g = by_node.get(key)
        if not g:
            continue
        orbit = n.get("orbit", 0)
        angle_table = data["constants"].get("orbitAnglesByOrbit")
        angle = angle_table[orbit][n.get("orbitIndex", 0)] if angle_table else 2 * math.pi * n.get("orbitIndex", 0) / data["constants"]["skillsPerOrbit"][orbit]
        angles[key] = angle
        radius = data["constants"]["orbitRadii"][orbit]
        result[key] = {"id": key, "x": round(g["x"] + math.sin(angle) * radius, 3), "y": round(g["y"] - math.cos(angle) * radius, 3), "name": n.get("name", "Passive"), "stats": n.get("stats", []), "notable": bool(n.get("isNotable") or n.get("isKeystone")), "keystone": bool(n.get("isKeystone")), "ascendancy": n.get("ascendancyName", ""), "start": bool(n.get("classesStart")), "icon": n.get("icon", "")}
    edges, seen = [], set()
    for key, n in data["nodes"].items():
        if key not in result:
            continue
        a = result[key]
        for connection in n.get("connections", []):
            other = str(connection["id"])
            if other not in result or key == other:
                continue
            b = result[other]
            pair = tuple(sorted([key, other]))
            if pair in seen or a["ascendancy"] != b["ascendancy"] or a["start"] or b["start"]:
                continue
            seen.add(pair)
            orbit = connection.get("orbit", 0)
            radius = data["constants"]["orbitRadii"][abs(orbit)] if orbit and abs(orbit) < len(data["constants"]["orbitRadii"]) else 0
            sweep = 0 if orbit > 0 else 1
            dest = data["nodes"][other]
            if not orbit and n.get("group") == dest.get("group") and n.get("orbit") == dest.get("orbit"):
                radius = data["constants"]["orbitRadii"][n.get("orbit", 0)]
                sweep = 1 if (angles[other] - angles[key]) % (2 * math.pi) < math.pi else 0
            distance = math.hypot(b["x"] - a["x"], b["y"] - a["y"])
            path = f'M {a["x"]} {a["y"]} '
            path += f'A {radius} {radius} 0 0 {sweep} {b["x"]} {b["y"]}' if radius and 0 < distance <= radius * 2 + .01 else f'L {b["x"]} {b["y"]}'
            edges.append({"from": key, "to": other, "path": path})
    target.write_text(json.dumps({"version": version, "revision": REVISION, "nodes": list(result.values()), "edges": edges}, separators=(",", ":")))
    print(version, len(result), len(edges))
