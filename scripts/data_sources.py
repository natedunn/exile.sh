"""Frozen inputs and isolated roots for game-data generators (stdlib only)."""
import atexit
import hashlib
import io
import json
import os
import pathlib
import re
import threading
import urllib.request
import urllib.error

_lock = threading.Lock()
_access = {"used": {}, "missing": [], "records": {}}
_config = None
_capture = None


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON source key: ' + key)
        result[key] = value
    return result


def build_root(script_file):
    global _config, _capture
    root = os.environ.get("EXILE_DATA_STAGE")
    if not root:
        raise SystemExit("Game data must be generated in isolation: use bun run data:generate --capture <directory> --out <new-directory>.")
    root = pathlib.Path(root).resolve()
    marker = root / ".data-stage.json"
    _config = json.loads(marker.read_text())
    if root == pathlib.Path(script_file).resolve().parents[1]:
        raise ValueError("The stage must differ from the source checkout")
    capture = pathlib.Path(os.environ["EXILE_DATA_CAPTURE"]).resolve()
    manifest = json.loads((capture / "capture.json").read_text())
    _capture = manifest
    sources = {row["url"]: row for row in manifest["sources"]}

    def frozen_open(request, *args, **kwargs):
        url = request.full_url if isinstance(request, urllib.request.Request) else request
        with _lock:
            entry = sources.get(url)
            if entry is None:
                _access["missing"].append(url)
                raise OSError("Uncaptured source: " + str(url))
            path = (capture / entry["file"]).resolve()
            if not path.is_relative_to(capture):
                raise ValueError("Source path escapes capture")
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
                raise ValueError("Frozen source hash mismatch: " + url)
            _access["used"][url] = entry["sha256"]
            if entry.get('status', 200) != 200:
                raise urllib.error.HTTPError(url, entry['status'], 'Captured HTTP status', {}, io.BytesIO(raw))
            # Inventory source identities independently of a generator's parser.
            # A definition skipped by a regex still becomes a review item.
            inventory = {}
            if url.endswith('.json') or '/contents/' in url:
                data = json.loads(raw, object_pairs_hook=unique_object)
                if isinstance(data, dict):
                    nested = next((key for key in ('nodes', 'passives') if isinstance(data.get(key), dict)), None)
                    values = {**{str(k): v for k, v in data.items() if k != nested},
                              **({nested + '/' + str(k): v for k, v in data[nested].items()} if nested else {})}
                    inventory = {str(k): hashlib.sha256(json.dumps(v, sort_keys=True).encode()).hexdigest() for k, v in values.items()}
                elif isinstance(data, list):
                    inventory = {str(i): hashlib.sha256(json.dumps(v, sort_keys=True).encode()).hexdigest() for i, v in enumerate(data)}
                else:
                    raise ValueError('Unexpected JSON source shape: ' + url)
            elif url.endswith('.lua'):
                text = raw.decode()
                pattern = r'^(?:skills|itemBases)\["([^"\n]+)"\]\s*=|^\t\["([^"\n]+)"\]\s*=|^\[\['
                starts = list(re.finditer(pattern, text, re.M))
                for index, match in enumerate(starts):
                    identity = match[1] or match[2] or ('block-' + str(index))
                    end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
                    if identity in inventory:
                        base = identity
                        occurrence = 2
                        while identity in inventory:
                            identity = base + '#duplicate-' + str(occurrence)
                            occurrence += 1
                    inventory[identity] = hashlib.sha256(text[match.start():end].encode()).hexdigest()
                if not inventory:
                    inventory = {'whole-file': entry['sha256']}
            _access['records'][url] = inventory
        result = io.BytesIO(raw)
        result.status = 200
        result.headers = {}
        return result

    urllib.request.urlopen = frozen_open
    # Use a fresh stage-owned cache so an upstream URL can never bypass the capture.
    os.environ["TMPDIR"] = str(root / ".cache")
    (root / ".cache").mkdir(exist_ok=True)
    import tempfile
    tempfile.tempdir = str(root / ".cache")
    atexit.register(lambda: (root / ".source-access.json").write_text(json.dumps(_access, sort_keys=True)))
    return root


def pob_revision(default):
    if _config is None:
        raise ValueError("Call build_root before choosing a revision")
    return _config.get("pobRevision", default)


def tree_versions(default):
    return _config.get("treeVersions") or default


def captured_at(url=None):
    rows = [row for row in _capture['sources'] if url is None or row['url'] == url]
    if not rows:
        raise ValueError('Missing source capture time')
    return max(row['capturedAt'] for row in rows)


def selected_trees(paths):
    versions = _config.get("treeVersions")
    return [p for p in paths if not versions or p.stem in versions]


class Accounting:
    """One disposition for every discovered record; no unreported omissions."""
    def __init__(self, root, generator):
        self.root, self.generator, self.records = root, generator, {}

    def add(self, family, identity, status, reason="", **details):
        key = family + ":" + str(identity)
        if key in self.records:
            raise ValueError("Duplicate accounting identity: " + key)
        if status not in ("imported", "excluded", "partial", "unknown"):
            raise ValueError("Unknown accounting status")
        self.records[key] = {"status": status, "reason": reason, **details}

    def write(self):
        directory = self.root / ".data-accounting"
        directory.mkdir(exist_ok=True)
        result = {"schemaVersion": 1, "generator": self.generator,
                  "records": dict(sorted(self.records.items()))}
        (directory / (self.generator + ".json")).write_text(json.dumps(result, sort_keys=True) + "\n")


def target_patch():
    return _config['targetPatch']


def source_version(provider):
    return _config.get('sourceVersions', {}).get(provider, 'unverified')
