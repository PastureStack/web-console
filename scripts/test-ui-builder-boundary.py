"""Validate producer isolation without Docker, dependency installs or a UI build."""
import io
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts/build-ui-release-candidate"
WORKFLOW = ROOT / ".github/workflows/validate.yml"
IMAGE = "node:24.22.1-bookworm@sha256:6449e19d8184d84062525b6a7524def03146c2cb04a7f08b076680d0e8e4240a"
COMMIT = "0123456789abcdef0123456789abcdef01234567"


def shell_function(name, *args):
    return subprocess.run(
        ["bash", "-c", 'source "$1"; ' + name + ' "${@:2}"', "boundary-test", str(SCRIPT), *map(str, args)],
        check=True, capture_output=True, text=True,
    )


class BuilderBoundaryTests(unittest.TestCase):
    def test_shell_syntax_and_toolchain_baseline(self):
        for name in ["build-ui-release-candidate", "check-ui-node24-engine-baseline", "setup-ui-builder-brotli"]:
            subprocess.run(["bash", "-n", str(ROOT / "scripts" / name)], check=True)
        workflow = WORKFLOW.read_text(encoding="utf-8")
        blocks = re.findall(r"^        run: \|\n((?:          .*\n|\n)+)", workflow, re.M)
        self.assertGreater(len(blocks), 3)
        for block in blocks:
            subprocess.run(["bash", "-n"], input="\n".join(line[10:] for line in block.splitlines()), text=True, check=True)
        result = subprocess.run(["bash", "scripts/check-ui-node24-engine-baseline"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_source_copy_excludes_host_state_and_preserves_source(self):
        with tempfile.TemporaryDirectory(prefix="ui-builder-boundary-") as directory:
            root = Path(directory)
            source, copied = root / "source", root / "copy"
            files = {
                "package.json": "source-package",
                "scripts/source.js": "source-code",
                "tools/sbom-verifier/package-lock.json": "isolated-verifier-lock",
                ".git/config": "private-git-state",
                "node_modules/host-package/index.js": "host-installed-package",
                "vendor/local/node_modules/nested/index.js": "nested-installed-package",
                "tools/sbom-verifier/node_modules/ajv/index.js": "host-installed-verifier",
                "dist/assets/old.js": "old-build",
                "build/security-browser/old.json": "old-inventory",
            }
            for name, text in files.items():
                file = source / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(text, encoding="utf-8")
            shell_function("copy_release_source", source, copied)
            self.assertEqual({str(file.relative_to(copied)) for file in copied.rglob("*") if file.is_file()}, {
                "package.json", "scripts/source.js", "tools/sbom-verifier/package-lock.json",
            })
            for name, text in files.items():
                self.assertEqual((source / name).read_text(encoding="utf-8"), text)

    def test_canonical_tree_uses_packaged_files_and_version(self):
        with tempfile.TemporaryDirectory(prefix="ui-builder-artifact-") as directory:
            root = Path(directory)
            archive = root / "original.tar.gz"
            packaged = {"VERSION.txt": b"1.6.195\n", "assets/ui.js": b"production", "index.html": b"html"}
            # The raw Ember tree still has files intentionally removed by the
            # real packager. SBOM verification must use the archive tree.
            raw = root / "dist"
            for name, content in {**packaged, "assets/ui.js.map": b"map", "assets/chunk.test.js": b"test", "translations/none.json": b"{}"}.items():
                file = raw / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(content)
            (raw / "VERSION.txt").unlink()
            with tarfile.open(archive, "w:gz") as tar:
                for name, content in packaged.items():
                    info = tarfile.TarInfo("1.6.195/" + name)
                    info.size = len(content)
                    tar.addfile(info, io.BytesIO(content))
            original = archive.read_bytes()
            result = shell_function("packaged_release_tree", archive, root / "canonical", "1.6.195")
            canonical = Path(result.stdout.strip())
            self.assertEqual({str(file.relative_to(canonical)) for file in canonical.rglob("*") if file.is_file()}, set(packaged))
            for name, content in packaged.items():
                self.assertEqual((canonical / name).read_bytes(), content)
            self.assertTrue((raw / "assets/ui.js.map").is_file())
            self.assertFalse((raw / "VERSION.txt").exists())
            self.assertEqual(archive.read_bytes(), original)
            with self.assertRaises(subprocess.CalledProcessError):
                shell_function("packaged_release_tree", archive, root / "wrong-version", "1.6.194")

    def test_launcher_has_only_source_and_artifact_mounts(self):
        script = SCRIPT.read_text(encoding="utf-8")
        command = re.search(r"  docker run --rm \\\n(.*?)\n}", script, re.S).group(0).rstrip("\n}")
        tokens = shlex.split(command.replace("\\\n", ""))
        mounts = [tokens[i + 1] for i, token in enumerate(tokens) if token == "--mount"]
        self.assertEqual(mounts, ["type=bind,source=$repo_root,target=/source,readonly", "type=bind,source=$output_dir,target=/output"])
        environment = [tokens[i + 1].split("=")[0] for i, token in enumerate(tokens) if token == "--env"]
        self.assertEqual(environment, ["GITHUB_SHA", "SOURCE_DATE_EPOCH", "VALIDATION_SCOPE"])
        self.assertNotIn("--env-file", tokens)
        self.assertNotIn("--volume", tokens)
        self.assertNotIn("-v", tokens)
        for forbidden in ["docker.sock", "hostedtoolcache", "linuxbrew", "RUBYOPT", "GEM_HOME"]:
            self.assertNotIn(forbidden, command)
        self.assertIn("builder_image='" + IMAGE + "'", script)
        self.assertIn('test "$node_image" = "$builder_image"', script)
        self.assertIn("test -f /.dockerenv", script)

    def test_sbom_scope_skips_host_install_and_preserves_other_tests(self):
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("if: ${{ inputs.validation_scope != 'sbom' }}", workflow)
        host_tests = re.search(r'if \[\[ "\$VALIDATION_SCOPE" != sbom \]\]; then\n(.*?)\n          fi', workflow, re.S).group(1)
        self.assertIn("npm ci --ignore-scripts", host_tests)
        self.assertEqual(workflow.count("npm ci "), 1)
        self.assertIn('"$VALIDATION_SCOPE" = dependency-security || "$VALIDATION_SCOPE" = host-disk', host_tests)
        self.assertIn("test_filter='legacy context partial'", host_tests)
        self.assertIn("test_filter='Unit | Model | host'", host_tests)
        self.assertIn("bash scripts/ci", host_tests)
        self.assertIn('export SOURCE_DATE_EPOCH=$(git show -s --format=%ct "$GITHUB_SHA")', workflow)
        self.assertEqual(workflow.count("uses: actions/attest@"), 2)
        for name in ["builder-host-inventory.json", "builder-container-inventory-before.json", "builder-container-inventory-after.json"]:
            self.assertIn("${{ runner.temp }}/" + name, workflow)

    def test_double_build_schema_and_inventory_gates_precede_export(self):
        script = SCRIPT.read_text(encoding="utf-8")
        before = script.index('capture_builder_inventory "$output_dir/builder-container-inventory-before.json"')
        install = script.index("npm ci --ignore-scripts")
        first = script.index('build_candidate "$work_root/web-console-a.tar.gz"')
        second = script.index('build_candidate "$work_root/web-console-b.tar.gz"')
        compare = script.index('cmp "$work_root/web-console-a.tar.gz"')
        after = script.index('capture_builder_inventory "$output_dir/builder-container-inventory-after.json"')
        export = script.index('cp "$work_root/web-console-a.tar.gz" "$release_asset"')
        self.assertEqual(sorted([before, install, first, second, compare, after, export]), [before, install, first, second, compare, after, export])
        self.assertIn('--dist "$canonical_dist" --archive "$output"', script)
        self.assertIn('--source-commit "$GITHUB_SHA"', script)
        self.assertIn("node scripts/verify-ui-sbom-schema.js", script)
        self.assertIn("npm audit --prefix tools/sbom-verifier --audit-level=low", script)
        self.assertIn("--verifier-root tools/sbom-verifier", script)
        self.assertIn('--verifier-manifest-sha256 "$verifier_manifest_sha" --verifier-lock-sha256 "$verifier_lock_sha"', script)
        sbom_only = script.index('if [[ "$VALIDATION_SCOPE" = sbom ]]')
        for check in ["node --test scripts/test-ui-sbom.js scripts/test-ui-build-module-boundary.js scripts/test-ui-webpack-inventory.js",
                      "python3 -B scripts/test-ui-builder-inventory.py", "python3 -B scripts/test-ui-builder-boundary.py"]:
            self.assertLess(script.index(check), sbom_only)
        for digest in ["3e92dddbc30cf7f6a02b80f0942b1a4cfd4fb1c26f1dfc4310afa9d613cafb93", "baa9d3bd1ed57b6751b0887edead6b5063ff53ff7429cf85d476c6c94af0166e", "8bae002c25e723db7ee1f26afde680ae1a2b1a8f6b4b4b0fd65dc3becb090aae"]:
            self.assertIn(digest, script)

    def test_ruby_absence_gate_records_actual_container_and_rejects_drift(self):
        script = SCRIPT.read_text(encoding="utf-8")
        gate = re.search(r"<<'PY'\n(.*?)\nPY", script, re.S).group(1)
        with tempfile.TemporaryDirectory(prefix="ui-builder-inventory-") as directory:
            file = Path(directory) / "inventory.json"
            gate_environment = {**os.environ, "PATH": str(Path(directory) / "empty-path")}
            clean = {"producer": COMMIT, "claims": {"rubyAbsent": True}, "rubyBinaries": [], "rubyPackageBackports": []}
            file.write_text(json.dumps(clean), encoding="utf-8")
            result = subprocess.run([sys.executable, "-", str(file), IMAGE, COMMIT], input=gate, capture_output=True, text=True, env=gate_environment)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(file.read_text(encoding="utf-8"))
            self.assertEqual(data["producer"], COMMIT)
            self.assertEqual(data["producerEnvironment"], {"kind": "isolated-release-container", "image": IMAGE})
            for invalid in [
                {**clean, "claims": {"rubyAbsent": False}},
                {**clean, "rubyBinaries": [{"version": "3.3.12"}]},
                {**clean, "rubyPackageBackports": [{"name": "libruby3.2"}]},
                {**clean, "producer": "0" * 40},
            ]:
                file.write_text(json.dumps(invalid), encoding="utf-8")
                result = subprocess.run([sys.executable, "-", str(file), IMAGE, COMMIT], input=gate, capture_output=True, text=True, env=gate_environment)
                self.assertNotEqual(result.returncode, 0)
            ruby = Path(directory) / "ruby"
            ruby.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            ruby.chmod(0o755)
            file.write_text(json.dumps(clean), encoding="utf-8")
            result = subprocess.run([sys.executable, "-", str(file), IMAGE, COMMIT], input=gate, capture_output=True, text=True,
                                    env={**os.environ, "PATH": directory})
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
