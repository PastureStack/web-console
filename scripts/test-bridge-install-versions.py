"""Focused release install-version controls; no package build, network or install."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bridge_packager", ROOT / "scripts/package-webmcp-bridge.py")
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)


class BridgeInstallVersionTest(unittest.TestCase):
    def setUp(self):
        self.web = json.loads((ROOT / "package.json").read_bytes())["version"]
        self.bridge = json.loads((ROOT / "bridge/package.json").read_bytes())["version"]
        self.readme = (ROOT / "bridge/README.md").read_bytes().decode("utf-8")

    def check(self, text):
        return owner.verify_install_versions(self.web, self.bridge, text)

    def test_current_install_matches_both_package_versions(self):
        self.assertEqual(self.check(self.readme), {"webVersion": self.web, "bridgeVersion": self.bridge})
        self.assertEqual(owner.VERSION, self.bridge)
        crlf = self.readme.replace("\r\n", "\n").replace("\n", "\r\n")
        self.assertEqual(self.check(crlf), {"webVersion": self.web, "bridgeVersion": self.bridge})
        with self.assertRaises(ValueError):
            self.check(crlf.replace("BRIDGE_VERSION=" + self.bridge, "BRIDGE_VERSION=0.0.0"))

    def test_stale_web_or_bridge_assignment_is_rejected(self):
        for name, value in (("WEB_CONSOLE_VERSION", self.web), ("BRIDGE_VERSION", self.bridge)):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.check(self.readme.replace(name + "=" + value, name + "=0.0.0"))

    def test_literal_download_or_cd_cannot_bypass_current_assignments(self):
        for old, new in (("releases/download/${WEB_CONSOLE_VERSION}", "releases/download/1.6.207"),
                         ('cd "pasturestack-webmcp-bridge-${BRIDGE_VERSION}/bridge"', 'cd "pasturestack-webmcp-bridge-0.2.9/bridge"')):
            with self.subTest(command=old), self.assertRaises(ValueError):
                changed = self.readme.replace(old, new)
                self.assertNotEqual(changed, self.readme)
                self.check(changed)

    def test_checksum_and_unique_version_block_are_required(self):
        changed = self.readme.replace('sha256sum --check "pasturestack-webmcp-bridge-${BRIDGE_VERSION}.zip.sha256"', "")
        with self.assertRaises(ValueError):
            self.check(changed)
        with self.assertRaises(ValueError):
            self.check(self.readme + "\n```sh\nWEB_CONSOLE_VERSION=" + self.web + "\n```\n")


if __name__ == "__main__":
    unittest.main()
