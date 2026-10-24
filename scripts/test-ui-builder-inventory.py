import importlib.util
from pathlib import Path
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("inventory", Path(__file__).with_name("capture-ui-builder-inventory.py"))
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


class BuilderInventoryTests(unittest.TestCase):
    def test_patched_supported_series(self):
        for version in [(3, 3, 13), (3, 4, 12), (4, 0, 9), (4, 0, 10)]:
            self.assertEqual(inventory.assess(version)[1], "contains-all-four-fixes")

    def test_old_supported_series(self):
        for version in [(3, 3, 12), (3, 4, 11), (4, 0, 7), (4, 0, 8)]:
            self.assertEqual(inventory.assess(version)[1], "below-official-fixed-version")

    def test_distribution_backport_not_guessed(self):
        self.assertEqual(inventory.assess((3, 2, 3)), (None, "distribution-backport-review-required"))

    def test_capture_does_not_claim_host_packages_are_runtime(self):
        response = types.SimpleNamespace(stdout="install ok installed\truby3.2\t3.2.3-1ubuntu0.24.04.8\tamd64\n")
        with patch.object(inventory.subprocess, "run", return_value=response), patch.object(inventory.Path, "glob", return_value=[]):
            result = inventory.capture()
        self.assertEqual(result["rubyPackageBackports"][0]["version"], "3.2.3-1ubuntu0.24.04.8")
        self.assertFalse(result["claims"]["rubyAbsent"])
        self.assertFalse(result["claims"]["hostPackagesAreBrowserRuntime"])
        self.assertFalse(result["claims"]["versionNumberProvesDistributionPatchStatus"])

    def test_removed_package_records_do_not_claim_an_installed_ruby(self):
        response = types.SimpleNamespace(stdout="deinstall ok config-files\truby3.2\t3.2.3\tamd64\n")
        with patch.object(inventory.subprocess, "run", return_value=response), patch.object(inventory.Path, "glob", return_value=[]):
            result = inventory.capture()
        self.assertEqual(result["osPackages"], [])
        self.assertTrue(result["claims"]["rubyAbsent"])

    def test_held_installed_ruby_is_still_inventoried(self):
        response = types.SimpleNamespace(stdout="hold ok installed\tlibruby3.2\t3.2.3\tamd64\n")
        with patch.object(inventory.subprocess, "run", return_value=response), patch.object(inventory.Path, "glob", return_value=[]):
            result = inventory.capture()
        self.assertFalse(result["claims"]["rubyAbsent"])
        self.assertEqual(result["rubyPackageBackports"][0]["name"], "libruby3.2")


if __name__ == "__main__":
    unittest.main()
