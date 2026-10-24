#!/usr/bin/env python3
"""Capture the real CI host; never equate a Docker environment variable with it."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def assess(current):
    minimum = {"3.3": (3, 3, 13), "3.4": (3, 4, 12), "4.0": (4, 0, 9)}
    fixed = minimum.get(".".join(map(str, current[:2])))
    status = (("contains-all-four-fixes" if current >= fixed else "below-official-fixed-version")
              if fixed else "distribution-backport-review-required")
    return fixed, status


def capture():
    result = subprocess.run(
        ["dpkg-query", "-W", "-f=${Status}\t${binary:Package}\t${Version}\t${Architecture}\n"],
        check=True, capture_output=True, text=True,
    )
    packages = []
    for line in result.stdout.splitlines():
        status, name, version, architecture = line.split("\t")
        if status.split()[-1] == "installed":
            packages.append({"name": name, "version": version, "architecture": architecture})
    candidates = [("system", path) for path in Path("/usr/bin").glob("ruby*") if path.is_file()]
    toolcache = Path(os.environ.get("RUNNER_TOOL_CACHE", "/opt/hostedtoolcache")) / "Ruby"
    candidates += [("toolcache", path) for path in toolcache.glob("*/x64/bin/ruby")]
    brew = Path("/home/linuxbrew/.linuxbrew/Homebrew/Library/Homebrew/vendor/portable-ruby")
    candidates += [("homebrew-portable", path) for path in brew.glob("*/bin/ruby")]
    candidates += [("local", path) for path in Path("/usr/local/bin").glob("ruby*") if path.is_file()]
    clean_env = {key: value for key, value in os.environ.items()
                 if key not in {"RUBYOPT", "RUBYLIB", "GEM_HOME", "GEM_PATH"}}
    rubies, seen = [], set()
    for origin, path in sorted(candidates):
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        version = subprocess.run([str(resolved), "--disable-gems", "--version"],
                                 env=clean_env, capture_output=True, text=True, timeout=10)
        if version.returncode != 0:
            raise RuntimeError(f"Ruby inventory probe failed for {origin}")
        match = re.match(r"ruby (\d+)\.(\d+)\.(\d+)\b", version.stdout)
        if not match:
            raise RuntimeError("Unknown Ruby version response")
        current = tuple(map(int, match.groups()))
        fixed, assessment = assess(current)
        rubies.append({
            "origin": origin, "version": ".".join(map(str, current)),
            "sha256": hashlib.sha256(resolved.read_bytes()).hexdigest(),
            "officialFixedVersionForSeries": ".".join(map(str, fixed)) if fixed else None,
            "upstreamVersionAssessment": assessment,
            "activation": "host-present-not-evidence-of-build-use",
        })
    return {
        "schemaVersion": 1,
        "scope": "CI host OS package database and bounded Ruby binary locations; not a full hosted-runner SDK SBOM",
        "producer": os.environ.get("GITHUB_SHA"),
        "runnerImageVersion": os.environ.get("ImageVersion"),
        "osPackages": sorted(packages, key=lambda value: value["name"]),
        "rubyBinaries": rubies,
        "rubyPackageBackports": [value for value in packages
                                  if re.match(r"(?:lib)?ruby|rubygems", value["name"])],
        "advisory": "https://www.ruby-lang.org/en/news/2026/10/23/regexp-fixes-for-gitlab-cves/",
        "claims": {"rubyAbsent": not rubies and not any(re.match(r"(?:lib)?ruby|rubygems", value["name"]) for value in packages), "hostPackagesAreBrowserRuntime": False,
                   "versionNumberProvesDistributionPatchStatus": False},
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: capture-ui-builder-inventory.py OUTPUT.json")
    output = capture()
    Path(sys.argv[1]).write_text(json.dumps(output, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "CAPTURED", "osPackages": len(output["osPackages"]),
                      "rubyBinaries": len(output["rubyBinaries"]), "noRuntimeSafetyClaim": True}))
