"""Shared geometry for RePoE passive tree exports (Atlas, Genesis Tree)."""
import math
import re

clean = lambda text: re.sub(r"\[([^\]]+)\]", lambda match: match[1].split("|")[-1], text)


def layout(data, describe):
    """Place nodes and draw orbit-aware connections.

    `describe(key, meta)` returns the node's fields, or None to skip it.
    """
    nodes, positions = {}, {}
    for group_id, group in enumerate(data["groups"]):
        for placement in group["passives"]:
            key = str(placement["hash"])
            fields = describe(key, data["passives"][key])
            if fields is None:
                continue
            orbit = placement["radius"]
            angle = 2 * math.pi * placement["position_clockwise"] / data["skills_per_orbit"][orbit]
            radius = data["orbit_radii"][orbit]
            nodes[key] = {"id": key, "x": round(group["x"] + math.sin(angle) * radius, 3),
                          "y": round(group["y"] - math.cos(angle) * radius, 3), **fields}
            positions[key] = (placement, group_id, angle)
    edges, seen = [], set()
    for key, (placement, group_id, angle) in positions.items():
        for index, other_id in enumerate(placement["connections"]):
            other = str(other_id)
            pair = tuple(sorted([key, other]))
            if other not in nodes or key == other or pair in seen:
                continue
            seen.add(pair)
            a, b = nodes[key], nodes[other]
            spline = placement["splines"][index]
            radius = data["orbit_radii"][abs(spline)] if 0 < abs(spline) < len(data["orbit_radii"]) else 0
            sweep = 0 if spline > 0 else 1
            dest, dest_group, dest_angle = positions[other]
            if not spline and group_id == dest_group and placement["radius"] == dest["radius"]:
                radius = data["orbit_radii"][placement["radius"]]
                sweep = 1 if (dest_angle - angle) % (2 * math.pi) < math.pi else 0
            distance = math.hypot(b["x"] - a["x"], b["y"] - a["y"])
            path = f'M {a["x"]} {a["y"]} '
            path += f'A {radius} {radius} 0 0 {sweep} {b["x"]} {b["y"]}' if radius and 0 < distance <= radius * 2 + .01 else f'L {b["x"]} {b["y"]}'
            edges.append({"from": key, "to": other, "path": path})
    return nodes, edges
