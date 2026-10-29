#!/usr/bin/env python3
"""Build and verify the standalone bridge source ZIP using only stdlib."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import tempfile
import zipfile


VERSION = "0.2.0"
SOURCE_FILES = (
    "LICENSE",
    "app/utils/ai-command-context.js",
    "app/utils/ai-command-contract.js",
    "app/utils/ai-command-engine.js",
    "app/utils/ai-resource-registry.js",
    "bridge/README.md",
    "bridge/core.mjs",
    "bridge/package-lock.json",
    "bridge/package.json",
    "bridge/server.mjs",
    "bridge/shared-modules.mjs",
    "bridge/test/core.test.mjs",
    "bridge/test/resources.test.mjs",
    "bridge/test/stdio.test.mjs",
    "scripts/test-webmcp-resources.mjs",
)
FORBIDDEN_PARTS = {"node_modules", ".git", "credentials", "credential", "secrets"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def checked_source(root, name):
    path = root / name
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root) or not path.is_file() or path.is_symlink():
        raise ValueError(f"Source must be a regular in-repository file: {name}")
    return path.read_bytes()


def verify_archive(path, prefix, payloads):
    expected = {prefix + name for name in payloads}
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)) or set(names) != expected:
            raise ValueError("Archive entries differ from the exact allowlist")
        for info in infos:
            parts = PurePosixPath(info.filename).parts
            if (info.filename.startswith("/") or ".." in parts or
                    any(part.lower() in FORBIDDEN_PARTS or part.lower().startswith(".qa") for part in parts) or
                    stat.S_ISLNK(info.external_attr >> 16)):
                raise ValueError(f"Unexpected private or unsafe archive path: {info.filename}")
            relative = info.filename[len(prefix):]
            if archive.read(info) != payloads[relative]:
                raise ValueError(f"Archive bytes differ from source: {relative}")
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC verification failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="Destination .zip file; its parent is created if needed")
    parser.add_argument("--sbom", required=True, type=Path, help="Previously generated webmcp-bridge.cdx.json")
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[1], help="Web Console checkout (default: this script's repository)")
    parser.add_argument("--version", default=VERSION, choices=[VERSION], help="Expected bridge source version")
    args = parser.parse_args()
    root = args.source_root.resolve(strict=True)
    output = args.output.resolve()
    if output.suffix.lower() != ".zip":
        raise ValueError("--output must name a .zip file")

    payloads = {name: checked_source(root, name) for name in SOURCE_FILES}
    package = json.loads(payloads["bridge/package.json"])
    lock = json.loads(payloads["bridge/package-lock.json"])
    if package.get("version") != args.version or lock.get("version") != args.version or lock.get("packages", {}).get("", {}).get("version") != args.version:
        raise ValueError("package.json and package-lock.json must match the requested version")

    sbom_path = args.sbom.resolve(strict=True)
    if not sbom_path.is_file() or args.sbom.is_symlink():
        raise ValueError("--sbom must be a regular JSON file")
    sbom_bytes = sbom_path.read_bytes()
    sbom = json.loads(sbom_bytes)
    component = sbom.get("metadata", {}).get("component", {})
    if sbom.get("bomFormat") != "CycloneDX" or component.get("name") != package.get("name") or component.get("version") != args.version:
        raise ValueError("SBOM identity must match the bridge package and version")
    payloads["webmcp-bridge.cdx.json"] = sbom_bytes
    payloads["source-manifest.json"] = json_bytes({
        "format": "pasturestack-bridge-source-v1",
        "package": package["name"], "version": args.version,
        "installDirectory": "bridge", "entryPoint": "bridge/server.mjs",
        "files": [{"path": name, "bytes": len(data), "sha256": digest(data)} for name, data in sorted(payloads.items())],
    })
    prefix = f"pasturestack-webmcp-bridge-{args.version}/"
    output.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=output.name + ".", suffix=".tmp", dir=output.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED) as archive:
            for name, data in sorted(payloads.items()):
                info = zipfile.ZipInfo(prefix + name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                archive.writestr(info, data)
        verify_archive(temporary, prefix, payloads)
        os.replace(temporary, output)
    finally:
        if temporary.exists():
            temporary.unlink()
    checksum = digest(output.read_bytes())
    sidecar = output.with_name(output.name + ".sha256")
    sidecar.write_text(f"{checksum}  {output.name}\n", encoding="ascii")
    verification = {"archive": str(output), "sha256": checksum, "version": args.version,
                    "entries": len(payloads), "sourceBytesMatch": True, "exactAllowlist": True,
                    "privatePathsAbsent": True, "reproducibility": "sorted entries, fixed timestamp and mode, uncompressed ZIP; source and SBOM bytes are preserved"}
    output.with_name(output.name + ".verification.json").write_bytes(json_bytes(verification))
    print(json.dumps(verification, ensure_ascii=False))


if __name__ == "__main__":
    main()
