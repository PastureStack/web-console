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


VERSION = "0.2.29"
SOURCE_FILES = (
    "LICENSE",
    "app/utils/ai-command-context.js",
    "app/utils/ai-command-contract.js",
    "app/utils/ai-command-engine.js",
    "app/utils/ai-container-logs.js",
    "app/utils/ai-resource-registry.js",
    "app/utils/ai-external-service.js",
    "app/utils/ai-alias-service.js",
    "app/utils/ai-audit-reader.js",
    "app/utils/ai-resource-review-labels.js",
    "app/utils/ai-catalog-reader.js",
    "app/utils/ai-catalog-launch.js",
    "bridge/README.md",
    "bridge/core.mjs",
    "bridge/package-lock.json",
    "bridge/package.json",
    "bridge/server.mjs",
    "bridge/bind-profile.mjs",
    "bridge/shared-modules.mjs",
    "bridge/test/core.test.mjs",
    "bridge/test/profile-binding.test.mjs",
    "bridge/test/audit-detail.test.mjs",
    "bridge/test/manual-scale.test.mjs",
    "bridge/test/resources.test.mjs",
    "bridge/test/stdio.test.mjs",
    "scripts/test-webmcp-resources.mjs",
    "scripts/test-webmcp-volume-usage.mjs",
    "scripts/test-webmcp-service-create.mjs",
    "scripts/test-webmcp-manual-scale.mjs",
    "scripts/test-webmcp-lb-scale.mjs",
    "bridge/test/catalog.test.mjs",
    "scripts/test-ai-catalog-reader.mjs",
    "scripts/test-webmcp-catalog.mjs",
    "scripts/test-webmcp-catalog-launch.mjs",
    "bridge/test/archive.test.mjs",
    "scripts/test-webmcp-archive.mjs",
    "scripts/test-webmcp-external-service.mjs",
    "scripts/test-webmcp-alias-service.mjs",
    "scripts/test-webmcp-service-links.mjs",
    "scripts/test-webmcp-registry-lifecycle.mjs",
    "scripts/test-webmcp-certificate-metadata.mjs",
    "scripts/test-webmcp-host-metadata.mjs",
    "scripts/test-webmcp-container-network.mjs",
    "scripts/test-webmcp-project-metadata.mjs",
    "scripts/test-webmcp-lb-metadata.mjs",
    "scripts/test-webmcp-process-diagnostics.mjs",
    "scripts/test-webmcp-stack-parent-detail.mjs",
    "scripts/test-webmcp-stack-group.mjs",
    "scripts/test-webmcp-preview-help.mjs",
    "scripts/test-webmcp-reference-unavailable.mjs",
    "scripts/test-webmcp-service-upgrade-lifecycle.mjs",
    "scripts/test-webmcp-service-upgrade-config.mjs",
    "scripts/test-webmcp-volume-create.mjs",
    "scripts/test-webmcp-container-logs.mjs",
    "scripts/test-webmcp-complete-cohort-overlap.mjs",
    "scripts/test-webmcp-project-profile-binding.mjs",
    "scripts/test-webmcp-host-workloads.mjs",
    "scripts/test-webmcp-stack-ref-guidance.mjs",
    "scripts/test-webmcp-audit.mjs",
    "scripts/test-webmcp-audit-extension.mjs",
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


def verify_install_versions(web_version, bridge_version, readme):
    """Keep the active install block bound to both source package versions."""
    readme = readme.replace("\r\n", "\n")
    blocks = [part.split("```", 1)[0] for part in readme.split("```sh\n")[1:]]
    installs = [block for block in blocks if "WEB_CONSOLE_VERSION=" in block or "BRIDGE_VERSION=" in block]
    if len(installs) != 1:
        raise ValueError("Exactly one version-bound Bridge install block is required")
    lines = [line.strip() for line in installs[0].splitlines() if line.strip()]
    for name, version in (("WEB_CONSOLE_VERSION", web_version), ("BRIDGE_VERSION", bridge_version)):
        if [line for line in lines if line.startswith(name + "=")] != [name + "=" + version]:
            raise ValueError("Bridge install versions must match the source packages")
    archive = "pasturestack-webmcp-bridge-${BRIDGE_VERSION}.zip"
    url = "https://github.com/PastureStack/web-console/releases/download/${WEB_CONSOLE_VERSION}/" + archive
    expected = [f'curl --fail --location --remote-name "{url}"',
                f'curl --fail --location --remote-name "{url}.sha256"',
                f'sha256sum --check "{archive}.sha256"', f'unzip "{archive}"',
                'cd "pasturestack-webmcp-bridge-${BRIDGE_VERSION}/bridge"']
    commands = [line for line in lines if line.startswith(("curl ", "sha256sum ", "unzip ", "cd "))]
    if commands != expected:
        raise ValueError("Download, checksum, extraction and cd must use the source-version variables")
    return {"webVersion": web_version, "bridgeVersion": bridge_version}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="Destination .zip file; its parent is created if needed")
    parser.add_argument("--sbom", required=True, type=Path, help="Previously generated webmcp-bridge.cdx.json")
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[1], help="Web Console checkout (default: this script's repository)")
    parser.add_argument("--version", default=VERSION, choices=[VERSION], help="Expected bridge source version")
    args = parser.parse_args()
    root = args.source_root.resolve(strict=True)
    verify_install_versions(json.loads(checked_source(root, "package.json"))["version"],
                            json.loads(checked_source(root, "bridge/package.json"))["version"],
                            checked_source(root, "bridge/README.md").decode("utf-8"))
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
