"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const vm = require("vm");
const crypto = require("crypto");
const childProcess = require("child_process");

function fail(message) {
  throw new Error(message);
}

function packageInfo(name) {
  let current = path.dirname(require.resolve(name));
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    }
    current = path.dirname(current);
  }
  fail(`package.json not found for ${name}`);
}

function packageInfoFromResolved(resolvedPath, name) {
  let current = path.dirname(resolvedPath);
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) {
      const info = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (info.version) {
        return info;
      }
    }
    current = path.dirname(current);
  }
  fail(`package.json with version not found for ${name}`);
}


function packageJsonInfo(name) {
  const packagePath = path.join(process.cwd(), "node_modules", ...name.split("/"), "package.json");
  if (!fs.existsSync(packagePath)) {
    fail(`package.json not found for ${name}`);
  }
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

function expectPackageJsonVersion(name, expected) {
  const info = packageJsonInfo(name);
  if (info.version !== expected) {
    fail(`${name} version ${info.version} != ${expected}`);
  }
}

function expectVersion(name, expected) {
  const info = packageInfo(name);
  if (info.version !== expected) {
    fail(`${name} version ${info.version} != ${expected}`);
  }
}

function expectMissing(name) {
  try {
    require.resolve(name);
  } catch (err) {
    console.log(`require-missing-ok ${name}`);
    return;
  }
  fail(`${name} should not be resolved in the current testem graph`);
}

function expectModernGlobDevServerPath() {
  expectPackageJsonVersion("glob", "13.0.6");
  const glob = require("glob");
  if (glob.__esModule) {
    fail("glob CJS compatibility wrapper must not expose __esModule");
  }
  if (glob.default !== glob) {
    fail("glob CJS compatibility wrapper default export is not self-referential");
  }
  const globSync = glob.globSync || glob.sync;
  if (typeof globSync !== "function") {
    fail("glob modern sync API is missing");
  }
  const matches = globSync("vendor/**/*.js", { cwd: process.cwd() });
  if (!Array.isArray(matches) || !matches.includes("vendor/novnc.js")) {
    fail("glob modern sync smoke did not find vendored UI files");
  }
  console.log("glob-dev-server-smoke-ok version=13.0.6");
}

function expectModuleResolverGlobCompat() {
  const ownerDir = path.dirname(require.resolve("babel-plugin-module-resolver/package.json"));
  const globPath = require.resolve("glob", { paths: [ownerDir] });
  const globInfo = packageInfoFromResolved(globPath, "babel-plugin-module-resolver glob");
  if (globInfo.version !== "9.3.5") {
    fail(`babel-plugin-module-resolver declared glob version ${globInfo.version} != 9.3.5`);
  }

  const glob = require(globPath);
  if (typeof glob.hasMagic !== "function" || typeof glob.sync !== "function") {
    fail("babel-plugin-module-resolver declared glob hasMagic/sync API is missing");
  }

  const normalizeMod = require("babel-plugin-module-resolver/lib/normalizeOptions");
  const normalizeOptions = normalizeMod.default || normalizeMod;
  if (typeof normalizeOptions !== "function") {
    fail("babel-plugin-module-resolver normalizeOptions export changed");
  }

  fs.mkdirSync(path.join(process.cwd(), "vendor", "rc16-glob-compat-smoke"), { recursive: true });
  const normalized = normalizeOptions(process.cwd(), { root: ["vendor/*"] });
  if (!normalized || !Array.isArray(normalized.root) || normalized.root.length < 1) {
    fail(`babel-plugin-module-resolver glob normalize smoke failed: ${JSON.stringify(normalized)}`);
  }

  console.log(`module-resolver-glob-smoke-ok version=9.3.5 roots=${normalized.root.length}`);
}

function expectBodyRawBodyOverride() {
  const bodyDir = path.dirname(require.resolve("body/package.json"));
  const rawBodyPath = require.resolve("raw-body", { paths: [bodyDir] });
  const rawBodyInfo = JSON.parse(fs.readFileSync(path.join(path.dirname(rawBodyPath), "package.json"), "utf8"));
  if (rawBodyInfo.version !== "2.5.3") {
    fail(`body raw-body version ${rawBodyInfo.version} != 2.5.3`);
  }
  if (rawBodyPath.includes(`${path.sep}body${path.sep}node_modules${path.sep}`)) {
    fail(`body still resolves nested raw-body path ${rawBodyPath}`);
  }
  if (typeof require("body") !== "function") {
    fail("body export changed");
  }
  console.log("body-raw-body-override-smoke-ok version=2.5.3");
}

function expectSaneWatcherOverride() {
  const sane = require("sane");
  expectVersion("sane", "5.0.1");
  expectMissing("fsevents");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sane-smoke-"));
  let watcher;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (watcher && typeof watcher.close === "function") {
        watcher.close();
      }
      fs.rmSync(dir, { recursive: true, force: true });
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("sane watcher smoke timeout"));
    }, 8000);

    watcher = sane(dir, { glob: ["**/*"] });
    watcher.on("error", (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    watcher.on("ready", () => {
      watcher.on("add", (filePath) => {
        clearTimeout(timer);
        cleanup();
        if (!String(filePath).includes("probe.txt")) {
          reject(new Error(`unexpected sane add path ${filePath}`));
          return;
        }
        console.log("sane-watcher-smoke-ok version=5.0.1");
        resolve();
      });
      fs.writeFileSync(path.join(dir, "probe.txt"), "ok");
    });
  });
}

function expectQuickTempRimrafOverride() {
  const quickTemp = require("quick-temp");

  const holder = {};
  quickTemp.makeOrRemake(holder, "tmp", "rc16-quick-temp-smoke");
  if (!holder.tmp || !fs.existsSync(holder.tmp)) {
    fail("quick-temp makeOrRemake did not create a temp directory");
  }
  fs.writeFileSync(path.join(holder.tmp, "probe.txt"), "ok");
  quickTemp.remove(holder, "tmp");
  if (holder.tmp) {
    fail("quick-temp remove did not clear the holder property");
  }
  console.log("quick-temp-cleanup-smoke-ok version=0.1.9");
}

function expectSyncDiskCacheRimrafOverride() {
  const Cache = require("sync-disk-cache");
  const cache = new Cache(`rc16-sync-disk-cache-smoke-${process.pid}`);
  cache.set("probe", "ok");
  const hit = cache.get("probe");
  const content = hit && (hit.content === undefined ? hit.value : hit.content);
  if (!hit || hit.isCached !== true || content !== "ok") {
    fail(`sync-disk-cache get smoke failed: ${JSON.stringify(hit)}`);
  }
  cache.remove("probe");
  const miss = cache.get("probe");
  if (!miss || miss.isCached !== false) {
    fail(`sync-disk-cache remove smoke failed: ${JSON.stringify(miss)}`);
  }
  cache.clear();
  console.log("sync-disk-cache-cleanup-smoke-ok version=2.1.0");
}

function expectBroccoliTerserRimrafOverride() {
  const terserPlugin = require("broccoli-terser-sourcemap");
  if (typeof terserPlugin !== "function") {
    fail("broccoli-terser-sourcemap export is no longer a build plugin function");
  }
  console.log("broccoli-terser-plugin-smoke-ok version=4.1.1");
}

function expectEmberCliBabelRimrafOverride() {
  const emberCliBabel = require("ember-cli-babel");
  if (!emberCliBabel || typeof emberCliBabel !== "object") {
    fail("ember-cli-babel export changed");
  }
  console.log("ember-cli-babel-export-smoke-ok version=8.3.1");
}

async function expectRimrafCallbackCompat() {
  expectPackageJsonVersion("rimraf", "6.1.3");
  const rimraf = require("rimraf");
  if (rimraf.__esModule) {
    fail("rimraf compatibility wrapper must not expose __esModule");
  }
  if (rimraf.default !== rimraf) {
    fail("rimraf compatibility wrapper default export is not self-referential");
  }
  if (
    typeof rimraf !== "function" ||
    typeof rimraf.sync !== "function" ||
    typeof rimraf.rimraf !== "function" ||
    typeof rimraf.rimrafSync !== "function"
  ) {
    fail("rimraf compatibility wrapper callback/sync/modern API is missing");
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rc16-rimraf-compat-"));
  try {
    const syncTarget = path.join(dir, "sync");
    fs.mkdirSync(syncTarget);
    rimraf.sync(syncTarget);
    if (fs.existsSync(syncTarget)) {
      fail("rimraf compatibility sync API did not remove target");
    }

    const callbackTarget = path.join(dir, "callback");
    fs.mkdirSync(callbackTarget);
    await new Promise((resolve, reject) => {
      const ret = rimraf(callbackTarget, (err) => {
        if (err) {
          reject(err);
          return;
        }
        if (fs.existsSync(callbackTarget)) {
          reject(new Error("rimraf compatibility callback API did not remove target"));
          return;
        }
        if (ret !== undefined) {
          reject(new Error("rimraf compatibility callback API should return undefined"));
          return;
        }
        resolve();
      });
    });

    const promiseTarget = path.join(dir, "promise");
    fs.mkdirSync(promiseTarget);
    await rimraf(promiseTarget);
    if (fs.existsSync(promiseTarget)) {
      fail("rimraf compatibility promise API did not remove target");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log("rimraf-callback-compat-smoke-ok version=6.1.3");
}

function expectYamljsBuildGraph() {
  const yaml = require("yamljs");
  const yamlDir = path.dirname(require.resolve("yamljs/package.json"));
  const globPath = require.resolve("glob", { paths: [yamlDir] });
  const globInfo = packageInfoFromResolved(globPath, "yamljs glob");
  if (globInfo.version !== "7.2.3") {
    fail(`yamljs declared glob version ${globInfo.version} != 7.2.3`);
  }

  const parsed = yaml.parse("a: 1\nb:\n  - c\n");
  if (!parsed || parsed.a !== 1 || parsed.b[0] !== "c") {
    fail("yamljs parse smoke failed");
  }
  const serialized = yaml.stringify(parsed, 2);
  if (!serialized.includes("a: 1")) {
    fail(`yamljs stringify smoke failed: ${serialized}`);
  }
  const file = path.join(os.tmpdir(), `rc16-yamljs-smoke-${process.pid}.yml`);
  fs.writeFileSync(file, "hello: world\n");
  const loaded = yaml.load(file);
  fs.rmSync(file, { force: true });
  if (!loaded || loaded.hello !== "world") {
    fail("yamljs load smoke failed");
  }
  console.log("yamljs-build-graph-smoke-ok yamljs=0.3.0 glob=7.2.3");
}

async function expectMkdirpGraph() {
  expectPackageJsonVersion("mkdirp", "0.5.6");

  const ownerDir = path.dirname(require.resolve("broccoli-filter/package.json"));
  const mkdirpPath = require.resolve("mkdirp", { paths: [ownerDir] });
  const mkdirpInfo = packageInfoFromResolved(mkdirpPath, "mkdirp");
  if (mkdirpInfo.version !== "0.5.6") {
    fail(`broccoli-filter mkdirp resolved ${mkdirpInfo.version} instead of 0.5.6`);
  }

  const mkdirp = require(mkdirpPath);
  if (typeof mkdirp !== "function" || typeof mkdirp.sync !== "function") {
    fail("mkdirp 0.5.6 callback/sync API is missing");
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rc16-mkdirp-override-"));
  try {
    const syncTarget = path.join(dir, "sync", "nested");
    mkdirp.sync(syncTarget, 0o755);
    if (!fs.statSync(syncTarget).isDirectory()) {
      fail("mkdirp 0.5.6 sync API did not create a nested directory");
    }

    await new Promise((resolve, reject) => {
      const asyncTarget = path.join(dir, "async", "nested");
      mkdirp(asyncTarget, 0o755, (err) => {
        if (err) {
          reject(err);
          return;
        }
        if (!fs.statSync(asyncTarget).isDirectory()) {
          reject(new Error("mkdirp 0.5.6 callback API did not create a nested directory"));
          return;
        }
        resolve();
      });
    });

    const filter = require(ownerDir);
    if (typeof filter !== "function") {
      fail("broccoli-filter require smoke failed with its declared mkdirp graph");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log("mkdirp-graph-smoke-ok version=0.5.6");
}

function expectExistsSyncCompat() {
  expectVersion("exists-sync", "1.0.0-rc16.0");

  const existsSync = require("exists-sync");
  if (typeof existsSync !== "function") {
    fail("exists-sync compatibility wrapper no longer exports a function");
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rc16-exists-sync-smoke-"));
  try {
    const file = path.join(dir, "probe.txt");
    fs.writeFileSync(file, "ok");
    if (!existsSync(file)) {
      fail("exists-sync compatibility wrapper returned false for an existing file");
    }
    if (existsSync(path.join(dir, "missing.txt"))) {
      fail("exists-sync compatibility wrapper returned true for a missing file");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  require("ember-cli");
  console.log("exists-sync-compat-smoke-ok wrapper=1.0.0-rc16.0");
}

async function expectInflightCompat() {
  expectVersion("inflight", "1.1.0-rc16.0");

  const inflight = require("inflight");
  if (typeof inflight !== "function") {
    fail("inflight compatibility wrapper no longer exports a function");
  }

  const calls = [];
  const first = inflight("same", (...args) => calls.push(["first", ...args]));
  const second = inflight("same", (...args) => calls.push(["second", ...args]));
  if (typeof first !== "function") {
    fail("inflight compatibility wrapper did not return a resolver for the first request");
  }
  if (second !== null) {
    fail("inflight compatibility wrapper did not coalesce the second request");
  }
  first(null, "ok");
  const expectedCalls = [["first", null, "ok"], ["second", null, "ok"]];
  if (JSON.stringify(calls) !== JSON.stringify(expectedCalls)) {
    fail(`inflight compatibility wrapper callback order changed: ${JSON.stringify(calls)}`);
  }

  await new Promise((resolve, reject) => {
    const reentrantCalls = [];
    const resolver = inflight("reentrant", (...args) => {
      reentrantCalls.push(["outer", ...args]);
      const queued = inflight("reentrant", (...queuedArgs) => {
        reentrantCalls.push(["inner", ...queuedArgs]);
      });
      if (queued !== null) {
        reject(new Error("inflight compatibility wrapper did not coalesce a reentrant request"));
      }
    });
    resolver("value");
    setImmediate(() => {
      const expected = [["outer", "value"], ["inner", "value"]];
      if (JSON.stringify(reentrantCalls) !== JSON.stringify(expected)) {
        reject(new Error(`inflight compatibility wrapper reentrant semantics changed: ${JSON.stringify(reentrantCalls)}`));
      } else {
        resolve();
      }
    });
  });

  await new Promise((resolve, reject) => {
    const ownerDir = path.dirname(require.resolve("ember-cli/package.json"));
    const oldGlobPath = require.resolve("glob", { paths: [ownerDir] });
    const oldGlob = require(oldGlobPath);
    if (typeof oldGlob !== "function") {
      reject(new Error("legacy ember-cli glob is no longer the callback function API"));
      return;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rc16-inflight-glob-"));
    try {
      fs.mkdirSync(path.join(dir, "nested"));
      fs.writeFileSync(path.join(dir, "nested", "fixture.js"), "module.exports = true;\n");
      const syncHits = oldGlob.sync("**/*.js", { cwd: dir }).sort();
      if (JSON.stringify(syncHits) !== JSON.stringify(["nested/fixture.js"])) {
        reject(new Error(`legacy glob sync mismatch after inflight wrapper: ${JSON.stringify(syncHits)}`));
        return;
      }
      oldGlob("**/*.js", { cwd: dir }, (err, asyncHits) => {
        try {
          if (err) {
            reject(err);
            return;
          }
          asyncHits = asyncHits.sort();
          if (JSON.stringify(asyncHits) !== JSON.stringify(["nested/fixture.js"])) {
            reject(new Error(`legacy glob async mismatch after inflight wrapper: ${JSON.stringify(asyncHits)}`));
            return;
          }
          resolve();
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      });
    } catch (err) {
      fs.rmSync(dir, { recursive: true, force: true });
      reject(err);
    }
  });

  console.log("inflight-compat-smoke-ok wrapper=1.1.0-rc16.0");
}

function expectOsenvCompat() {
  expectVersion("osenv", "0.2.0-rc16.0");

  const osenv = require("osenv");
  for (const name of ["user", "prompt", "hostname", "tmpdir", "home", "path", "editor", "shell"]) {
    if (typeof osenv[name] !== "function") {
      fail(`osenv compatibility wrapper missing ${name} function`);
    }
  }
  if (!Array.isArray(osenv.path())) {
    fail("osenv compatibility wrapper path() did not return an array");
  }
  if (!osenv.tmpdir() || !osenv.home()) {
    fail("osenv compatibility wrapper tmpdir/home returned empty values");
  }
  osenv.home((err, home) => {
    if (err) {
      throw err;
    }
    if (home !== osenv.home()) {
      throw new Error("osenv compatibility wrapper callback value mismatch");
    }
  });

  expectMissing("bower-config");
  const npa = require("npm-package-arg");
  const parsed = npa("lodash@4.18.1");
  if (!parsed || parsed.name !== "lodash") {
    fail("npm-package-arg parse smoke failed in the modern Ember CLI graph");
  }
  console.log("osenv-compat-smoke-ok wrapper=0.2.0-rc16.0");
}

function expectSourceMapUrlCompat() {
  expectVersion("source-map-url", "0.4.0-rc16.0");

  const sourceMapUrl = require("source-map-url");
  const concat = require("fast-sourcemap-concat");
  for (const name of ["getFrom", "existsIn", "removeFrom", "insertBefore"]) {
    if (typeof sourceMapUrl[name] !== "function") {
      fail(`source-map-url compatibility wrapper missing ${name} function`);
    }
  }
  if (!(sourceMapUrl.regex instanceof RegExp) || !(sourceMapUrl._innerRegex instanceof RegExp)) {
    fail("source-map-url compatibility wrapper regex exports changed");
  }

  const lineComment = "console.log(1);\n//# sourceMappingURL=app.js.map\n";
  if (sourceMapUrl.getFrom(lineComment) !== "app.js.map") {
    fail("source-map-url getFrom line comment smoke failed");
  }
  if (!sourceMapUrl.existsIn(lineComment)) {
    fail("source-map-url existsIn line comment smoke failed");
  }
  if (sourceMapUrl.removeFrom(lineComment).includes("sourceMappingURL")) {
    fail("source-map-url removeFrom line comment smoke failed");
  }
  const inserted = sourceMapUrl.insertBefore(lineComment, "\n/* rc16 */\n");
  if (!inserted.includes("/* rc16 */\n//# sourceMappingURL=app.js.map")) {
    fail("source-map-url insertBefore line comment smoke failed");
  }

  const blockComment = "body{}\n/*# sourceMappingURL=style.css.map */\n";
  if (sourceMapUrl.getFrom(blockComment) !== "style.css.map") {
    fail("source-map-url getFrom block comment smoke failed");
  }
  if (!concat || typeof concat !== "function") {
    fail("fast-sourcemap-concat export changed after source-map-url compatibility wrapper");
  }
  console.log("source-map-url-compat-smoke-ok wrapper=0.4.0-rc16.0");
}

function expectSortPackageJsonCompat() {
  expectVersion("sort-package-json", "3.6.2-rc16.0");
  expectVersion("sort-package-json-upstream", "3.6.1");

  const sortPackageJson = require("sort-package-json");
  if (typeof sortPackageJson !== "function") {
    fail("sort-package-json compatibility wrapper no longer exports a CommonJS function");
  }

  const sorted = sortPackageJson({
    scripts: {
      z: "node z.js",
      a: "node a.js",
    },
    version: "1.0.0",
    name: "rc16-sort-smoke",
  });
  if (!sorted || sorted.name !== "rc16-sort-smoke") {
    fail("sort-package-json compatibility wrapper returned an invalid object");
  }
  if (Object.keys(sorted.scripts).join(",") !== "a,z") {
    fail("sort-package-json compatibility wrapper did not preserve upstream sorting semantics");
  }

  const emberCli = require("ember-cli");
  if (!emberCli) {
    fail("ember-cli require smoke failed after sort-package-json compatibility wrapper");
  }
  const emberBin = path.join(process.cwd(), "node_modules", ".bin", "ember");
  const addonWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc16-sort-addon-smoke-"));
  try {
    childProcess.execFileSync(emberBin, [
      "addon",
      "rc16-sort-compat-smoke",
      "--skip-npm",
      "--skip-git",
      "--skip-bower",
    ], {
      cwd: addonWorkDir,
      stdio: "pipe",
      timeout: 30000,
    });
    const addonPackagePath = path.join(addonWorkDir, "rc16-sort-compat-smoke", "package.json");
    const addonPackage = JSON.parse(fs.readFileSync(addonPackagePath, "utf8"));
    if (addonPackage.name !== "rc16-sort-compat-smoke") {
      fail("ember addon blueprint smoke produced an unexpected package name");
    }
    if (!Array.isArray(addonPackage.keywords) || !addonPackage.keywords.includes("ember-addon")) {
      fail("ember addon blueprint smoke did not preserve ember-addon keyword behavior");
    }
  } finally {
    fs.rmSync(addonWorkDir, { recursive: true, force: true });
  }
  console.log("sort-package-json-compat-smoke-ok wrapper=3.6.2-rc16.0 upstream=3.6.1");
}

function expectLodashTemplateCompat() {
  expectVersion("lodash.template", "4.18.1-rc16.0");
  expectVersion("lodash-real", "4.17.21");

  const ownerVersions = {
    "broccoli-templater": "4.18.1",
    "ember-cli": "4.18.1-rc16.0",
    "sourcemap-validator": "4.18.1",
  };
  for (const [owner, expectedVersion] of Object.entries(ownerVersions)) {
    const ownerDir = path.dirname(require.resolve(`${owner}/package.json`));
    const resolvedPath = require.resolve("lodash.template", { paths: [ownerDir] });
    const info = packageInfoFromResolved(resolvedPath, `${owner} lodash.template`);
    if (info.version !== expectedVersion) {
      fail(`${owner} lodash.template version ${info.version} != ${expectedVersion}`);
    }

    const template = require(resolvedPath);
    if (typeof template !== "function") {
      fail(`${owner} lodash.template wrapper is not a function`);
    }
    if (template("hi <%= name %>")({ name: "rc16" }) !== "hi rc16") {
      fail(`${owner} lodash.template interpolation changed`);
    }
    if (template("<%- value %>")({ value: "<tag>" }) !== "&lt;tag&gt;") {
      fail(`${owner} lodash.template escaping changed`);
    }
    if (template("<% var x = name.toUpperCase(); %><%= x %>")({ name: "rc16" }) !== "RC16") {
      fail(`${owner} lodash.template evaluation changed`);
    }
  }

  console.log("lodash-template-compat-smoke-ok wrapper=4.18.1-rc16.0 lodash-real=4.17.21 nested_build_only=2");
}

function expectCoreJsCompat() {
  expectVersion("core-js", "2.6.13-rc16.0");
  expectVersion("core-js-pure", "3.49.0");

  const assign = require("core-js/library/fn/object/assign");
  const keys = require("core-js/library/fn/object/keys");
  const arrayFrom = require("core-js/library/fn/array/from");
  const promise = require("core-js/library/fn/promise");
  const symbol = require("core-js/library/fn/symbol");
  const stringify = require("core-js/library/fn/json/stringify");
  const globalObject = require("core-js/library/fn/system/global");

  if (assign({ a: 1 }, { b: 2 }).b !== 2) {
    fail("core-js compat object/assign changed");
  }
  if (keys({ a: 1, b: 2 }).join(",") !== "a,b") {
    fail("core-js compat object/keys changed");
  }
  if (arrayFrom(new Set(["a", "b"])).join(",") !== "a,b") {
    fail("core-js compat array/from changed");
  }
  if (typeof promise.resolve !== "function") {
    fail("core-js compat promise export changed");
  }
  if (typeof symbol !== "function") {
    fail("core-js compat symbol export changed");
  }
  if (stringify({ ok: true }) !== "{\"ok\":true}") {
    fail("core-js compat json/stringify changed");
  }
  if (!globalObject || !globalObject.Math) {
    fail("core-js compat system/global changed");
  }

  const runtimeAssign = require("babel-runtime/core-js/object/assign");
  const runtimeStringify = require("babel-runtime/core-js/json/stringify");
  if (!runtimeAssign || runtimeAssign.default({ c: 1 }).c !== 1) {
    fail("babel-runtime core-js object/assign bridge changed");
  }
  if (!runtimeStringify || runtimeStringify.default({ ok: true }) !== "{\"ok\":true}") {
    fail("babel-runtime core-js json/stringify bridge changed");
  }

  require("babel-register");
  console.log("core-js-compat-smoke-ok wrapper=2.6.13-rc16.0 core-js-pure=3.49.0");
}

function expectEmberApiStoreFetchUpgrade() {
  expectPackageJsonVersion("ember-api-store", "2.8.5");
  expectPackageJsonVersion("ember-fetch", "5.1.3");
  expectPackageJsonVersion("broccoli-file-creator", "2.1.1");
  expectMissing("ember-network");

  const apiStoreDir = path.dirname(require.resolve("ember-api-store/package.json"));
  const apiStoreInfo = packageJsonInfo("ember-api-store");
  const emberFetchDir = path.dirname(require.resolve("ember-fetch/package.json"));
  const emberFetchInfo = packageJsonInfo("ember-fetch");
  if (apiStoreInfo.dependencies["ember-network"]) {
    fail("ember-api-store still depends on deprecated ember-network");
  }
  if (apiStoreInfo.dependencies["ember-fetch"] !== "^5.1.1") {
    fail(`ember-api-store ember-fetch dependency changed to ${apiStoreInfo.dependencies["ember-fetch"]}`);
  }
  if (apiStoreInfo.dependencies["broccoli-file-creator"] !== "^2.1.1") {
    fail(`ember-api-store broccoli-file-creator dependency changed to ${apiStoreInfo.dependencies["broccoli-file-creator"]}`);
  }
  if (!emberFetchInfo.pasturestackCompatibility || emberFetchInfo.pasturestackCompatibility.revision !== 2) {
    fail("ember-fetch browser-global compatibility revision is missing");
  }

  for (const filePath of [
    "addon/initializers/store.js",
    "addon/models/resource.js",
    "addon/services/store.js",
    "addon/utils/ajax-promise.js",
    "addon/utils/fetch.js",
    "addon/utils/denormalize.js",
    "addon/utils/normalize.js",
  ]) {
    if (!fs.existsSync(path.join(apiStoreDir, filePath))) {
      fail(`ember-api-store required API file missing: ${filePath}`);
    }
  }

  const fetchTemplatePath = path.join(emberFetchDir, "assets/browser-fetch.js.t");
  const fetchTemplate = fs.readFileSync(fetchTemplatePath, "utf8");
  if (!fetchTemplate.includes("function(exports)") || fetchTemplate.includes("function(self)")) {
    fail("ember-fetch AMD exports callback shadows the browser global self object");
  }

  const moduleBody = `
    var nativeClasses = (function(runtime) {
      return {
        NativeAbortSignal: runtime.AbortSignal,
        NativeAbortController: runtime.AbortController
      };
    })(typeof self !== 'undefined' ? self : global);
    class CompatAbortSignal extends nativeClasses.NativeAbortSignal {}
    class CompatAbortController extends nativeClasses.NativeAbortController {}
    global.AbortSignal = CompatAbortSignal;
    global.AbortController = CompatAbortController;
    global.fetch = function() { global.fetchCalls++; return Promise.resolve(); };
  `;
  const renderedFetch = fetchTemplate.replace("<%= moduleBody %>", moduleBody);
  const browserGlobal = {
    Ember: {
      RSVP: { Promise },
      Test: { registerWaiter() { fail("production fetch wrapper registered a legacy Ember.Test waiter"); } },
    },
    AbortSignal: class NativeAbortSignal {},
    AbortController: class NativeAbortController {},
    fetchCalls: 0,
  };
  const fetchModules = {};
  const sandbox = {
    window: browserGlobal,
    self: browserGlobal,
    preferNative: false,
    define(name, dependencies, factory) {
      if (name !== "fetch") {
        return;
      }
      const exports = {};
      factory(exports);
      fetchModules[name] = exports;
    },
  };
  vm.runInNewContext(renderedFetch, sandbox, { filename: fetchTemplatePath });
  const fetchPromise = fetchModules.fetch.default("/compatibility-smoke");
  if (typeof fetchModules.fetch.default !== "function" ||
      typeof fetchModules.fetch.fetch !== "function" ||
      typeof fetchModules.fetch.AbortController !== "function" ||
      !fetchPromise || typeof fetchPromise.then !== "function" ||
      browserGlobal.fetchCalls !== 1) {
    fail("ember-fetch browser-global production wrapper smoke failed");
  }

  console.log("ember-api-store-fetch-upgrade-smoke-ok version=2.8.5 ember-fetch=5.1.3 compat_revision=2 browser_global=ok production_waiter=absent broccoli-file-creator=2.1.1");
}

function expectBrowserGlobalBundle(file, globalName, expectedVersion) {
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file });
  const value = sandbox[globalName];
  if (!value || value.VERSION !== expectedVersion) {
    fail(`${file} global ${globalName} version smoke failed`);
  }
  if (globalName === "_") {
    console.log(`lodash-global-smoke-ok version=${value.VERSION}`);
  } else {
    console.log(`${globalName}-global-smoke-ok version=${value.VERSION}`);
  }
}

function expectMomentRuntime() {
  const moment = require("moment");
  expectVersion("moment", "2.30.1");
  const start = moment.utc("2026-05-08T00:00:00Z");
  const end = moment.utc("2026-05-08T00:01:30Z");
  if (end.diff(start, "seconds") !== 90) {
    fail("moment diff smoke failed");
  }
  if (moment.utc("1982-02-24T18:42:00Z").format("MMMM") !== "February") {
    fail("moment UTC format smoke failed");
  }

  const file = "node_modules/moment/moment.js";
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file });
  const browserMoment = sandbox.moment || sandbox.window.moment;
  if (!browserMoment || browserMoment.version !== "2.30.1") {
    fail("moment browser-global smoke failed");
  }
  if (browserMoment.utc("1982-02-24T18:42:00Z").format("MMMM") !== "February") {
    fail("moment browser-global UTC format smoke failed");
  }
  console.log("moment-runtime-smoke-ok version=2.30.1");
}

function expectQrCodeGeneratorRuntime() {
  expectPackageJsonVersion("qrcode-generator", "2.0.4");
  const file = "node_modules/qrcode-generator/dist/qrcode.js";
  const code = fs.readFileSync(file, "utf8");
  if (!code.includes("Licensed under the MIT license")) {
    fail("qrcode-generator MIT license header is missing");
  }
  const license = fs.readFileSync("public/licenses/qrcode-generator-MIT.txt", "utf8");
  if (!license.includes("Copyright (c) 2009 Kazuhiko Arase") ||
      !license.includes("Permission is hereby granted")) {
    fail("qrcode-generator distributable MIT notice is missing");
  }
  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file });
  if (typeof sandbox.qrcode !== "function") {
    fail("qrcode-generator browser global is missing");
  }
  const qr = sandbox.qrcode(0, "M");
  qr.addData("otpauth://totp/PastureStack:test?secret=JBSWY3DPEHPK3PXP", "Byte");
  qr.make();
  const svg = qr.createSvgTag({
    cellSize: 5,
    margin: 10,
    scalable: true,
    title: "Authenticator setup QR code",
    alt: "Authenticator setup QR code",
  });
  if (!svg.includes("<svg") || !svg.includes('role="img"') || !svg.includes("<path")) {
    fail("qrcode-generator accessible SVG output changed");
  }
  console.log("qrcode-generator-runtime-smoke-ok version=2.0.4 license=MIT output=svg");
}

function expectVendoredFileSha256(file, expected) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (actual !== expected) {
    fail(`${file} sha256 ${actual} != ${expected}`);
  }
}

function expectEmberLtsAndJQueryRuntime() {
  expectPackageJsonVersion("ember-source", "6.12.0");
  expectPackageJsonVersion("ember-cli", "6.12.0");
  expectPackageJsonVersion("ember-cli-htmlbars", "7.0.1");
  const expected = {
    "vendor/ember/LICENSE": "84e97eb6663fa5fa07f36661e6040ab8a557b165c13860e2e72c1a692ca3c2a0",
    "vendor/jquery/jquery.js": "78a85aca2f0b110c29e0d2b137e09f0a1fb7a8e554b499f740d6744dc8962cfe",
  };
  for (const [file, sha] of Object.entries(expected)) {
    expectVendoredFileSha256(file, sha);
  }
  for (const file of [
    "vendor/ember/ember.debug.js",
    "vendor/ember/ember.prod.js",
    "vendor/ember/ember-testing.js",
    "vendor/ember/ember-template-compiler.js",
    "vendor/ember/ember-module-shim.js",
  ]) {
    if (fs.existsSync(file)) {
      fail(`EOL Ember distribution file remains: ${file}`);
    }
  }
  const compat = fs.readFileSync("vendor/ember/ember-global-compat.js", "utf8");
  for (const marker of ["requireModule('@ember/runloop')", "Object.prototype.hasOwnProperty.call(Ember.run, name)", "Ember.NativeArray.apply", "Ember.Component.reopen", "root.find(selector)", "legacyTextInput"]) {
    if (!compat.includes(marker)) {
      fail(`Ember global compatibility marker missing: ${marker}`);
    }
  }
  const jquery = fs.readFileSync("vendor/jquery/jquery.js", "utf8");
  if (!jquery.includes("jQuery JavaScript Library v3.7.1")) {
    fail("vendored jQuery version header changed");
  }
  console.log("ember-lts-runtime-smoke-ok ember=6.12.0 ember-cli=6.12.0 jquery=3.7.1 vendored-runtime=absent");
}

function expectBrowserifyReplacementVendorGlobals() {
  const expected = {
    "vendor/ansi-up/ansi-up-global.js": "a50281fdb1fbe71cf638f09e897d4f5b153a418f731be2db410c796982f75682",
    "vendor/semver/semver-global.js": "d3c2df6e4e516f21e66e52675f1baf85ba753842fb3f603827f8815ecbc41e9b",
    "vendor/shell-quote/shell-quote-global.js": "cdfa04900aae1f1cf27d3c06e6658534eebf74c48edb11dec3b83f9b7dbd4fa8",
  };
  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const [file, sha] of Object.entries(expected)) {
    expectVendoredFileSha256(file, sha);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  const semver = sandbox.rc16Semver;
  const shellQuote = sandbox.rc16ShellQuote;
  const AnsiUp = sandbox.rc16AnsiUp && sandbox.rc16AnsiUp.AnsiUp;
  if (!semver || !semver.satisfies("1.2.3", ">=1.0.0 <2.0.0")) {
    fail("vendored semver global smoke failed");
  }
  const parsed = shellQuote && shellQuote.parse("echo 'hello world'");
  if (!parsed || parsed.length !== 2 || parsed[1] !== "hello world") {
    fail("vendored shell-quote parse smoke failed");
  }
  if (!shellQuote.quote(["hello world"]).includes("'hello world'")) {
    fail("vendored shell-quote quote smoke failed");
  }
  const ansiUp = new AnsiUp();
  ansiUp.escape_html = false;
  const ansiHtml = ansiUp.ansi_to_html("\u001b[31mred\u001b[0m &lt;x&gt;");
  if (!ansiHtml.includes("red") || ansiHtml.includes("&amp;lt;")) {
    fail(`vendored ansi_up smoke failed: ${ansiHtml}`);
  }
  console.log("browserify-replacement-vendor-smoke-ok semver=5.7.2 shell-quote=1.10.0 ansi_up=6.0.6");
}

function expectCommonmarkBrowserGlobal(file) {
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file });
  const value = sandbox.commonmark;
  if (!value || typeof value.Parser !== "function" || typeof value.HtmlRenderer !== "function") {
    fail(`${file} commonmark browser global smoke failed`);
  }
  const reader = new value.Parser();
  const writer = new value.HtmlRenderer();
  const html = writer.render(reader.parse("**bold**"));
  if (!html.includes("<strong>bold</strong>")) {
    fail(`${file} commonmark render smoke failed: ${html}`);
  }
  console.log("commonmark-global-smoke-ok parser=function html_renderer=function render=strong");
}

function expectAsyncBrowserGlobal(file) {
  const code = fs.readFileSync(file, "utf8");
  const sandbox = {
    window: {},
    self: {},
    exports: undefined,
    module: undefined,
    define: undefined,
    setTimeout,
    clearTimeout,
    setImmediate,
    clearImmediate,
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file });
  const value = sandbox.async;
  if (!value || typeof value.auto !== "function" || typeof value.queue !== "function" || typeof value.eachSeries !== "function") {
    fail(`${file} async browser global smoke failed`);
  }

  return new Promise((resolve, reject) => {
    const order = [];
    value.eachSeries([1, 2, 3], (item, cb) => {
      order.push(item);
      cb();
    }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      if (order.join(",") !== "1,2,3") {
        reject(new Error(`async eachSeries order failed: ${order.join(",")}`));
        return;
      }
      value.auto({
        first(cb) {
          cb(null, "a");
        },
        second: ["first", (results, cb) => cb(null, `${results.first}b`)],
      }, (autoErr, results) => {
        if (autoErr) {
          reject(autoErr);
          return;
        }
        if (!results || results.second !== "ab") {
          reject(new Error("async auto smoke failed"));
          return;
        }
        const q = value.queue((task, cb) => {
          order.push(task.name);
          cb();
        }, 1);
        q.error(reject);
        q.drain(() => {
          if (order.slice(-2).join(",") !== "q1,q2") {
            reject(new Error(`async queue order failed: ${order.join(",")}`));
            return;
          }
          console.log("async-global-smoke-ok version=3.2.6 eachSeries=ok auto=ok queue=ok");
          resolve();
        });
        q.push({ name: "q1" });
        q.push({ name: "q2" });
      });
    });
  });
}


function expectJGrowlBrowserGlobal(file) {
  const code = fs.readFileSync(file, "utf8");

  function JQuery() {
    return {
      length: 0,
      addClass() { return this; },
      appendTo() { return this; },
      jGrowl() { return this; },
      data() { return undefined; },
      each() { return this; },
    };
  }
  JQuery.fn = {};
  JQuery.extend = function(target, ...sources) { return Object.assign(target, ...sources); };
  JQuery.isPlainObject = function(value) {
    return !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
  };
  JQuery.isFunction = function(value) { return typeof value === "function"; };
  JQuery.makeArray = function(value) { return Array.prototype.slice.call(value); };

  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined, jQuery: JQuery, $: JQuery };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file });
  if (typeof JQuery.jGrowl !== "function" || typeof JQuery.fn.jGrowl !== "function" || !JQuery.jGrowl.defaults) {
    fail(`${file} jGrowl browser global smoke failed`);
  }
  console.log(`jgrowl-global-smoke-ok position=${JQuery.jGrowl.defaults.position} pool=${JQuery.jGrowl.defaults.pool}`);
}


function expectMd5IdenticonBrowserGlobals() {
  const sandbox = { window: {}, self: {}, exports: undefined, module: undefined, define: undefined, navigator: {} };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const file of [
    "node_modules/identicon.js/pnglib.js",
    "node_modules/identicon.js/identicon.js",
    "node_modules/md5-jkmyers/md5.js",
  ]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  if (typeof sandbox.PNGlib !== "function" || typeof sandbox.Identicon !== "function" || typeof sandbox.md5 !== "function") {
    fail("md5/identicon browser global smoke failed");
  }
  const digest = sandbox.md5("Unknown");
  if (digest !== "88183b946cc5f0e8c96b2e66e1c74a7e") {
    fail(`md5 digest changed: ${digest}`);
  }
  const icon = new sandbox.Identicon(digest, 80, 0.01).toString();
  if (typeof icon !== "string" || icon.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(icon)) {
    fail("identicon base64 output smoke failed");
  }
  console.log(`md5-identicon-global-smoke-ok digest=${digest} iconLength=${icon.length}`);
}

function createMinimalBrowserSandbox() {
  function Element() {
    this.style = {};
    this.childNodes = [];
  }
  Element.prototype.setAttribute = function() {};
  Element.prototype.setAttributeNS = function() {};
  Element.prototype.appendChild = function(child) { this.childNodes.push(child); return child; };
  Element.prototype.removeChild = function(child) {
    this.childNodes = this.childNodes.filter((item) => item !== child);
    return child;
  };
  function CSSStyleDeclaration() {}
  CSSStyleDeclaration.prototype.setProperty = function() {};
  const document = {
    documentElement: new Element(),
    body: new Element(),
    createElementNS() { return new Element(); },
    createElement() { return new Element(); },
    querySelector() { return new Element(); },
    querySelectorAll() { return []; },
  };
  function SVGPathElement() {}
  SVGPathElement.prototype = {};
  const sandbox = { console, window: {}, self: {}, exports: undefined, module: undefined, define: undefined, Element, CSSStyleDeclaration, SVGPathElement, document, navigator: { userAgent: "node" } };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.window.Element = Element;
  sandbox.window.CSSStyleDeclaration = CSSStyleDeclaration;
  sandbox.window.SVGPathElement = SVGPathElement;
  sandbox.window.document = document;
  sandbox.window.navigator = sandbox.navigator;
  return sandbox;
}

function expectC3D3BrowserGlobals() {
  const sandbox = createMinimalBrowserSandbox();
  vm.runInNewContext(fs.readFileSync("node_modules/d3/d3.js", "utf8"), sandbox, { filename: "node_modules/d3/d3.js" });
  vm.runInNewContext(fs.readFileSync("node_modules/c3/c3.js", "utf8"), sandbox, { filename: "node_modules/c3/c3.js" });
  if (!sandbox.d3 || sandbox.d3.version !== "3.5.17" || typeof sandbox.d3.behavior.zoom !== "function" || typeof sandbox.d3.svg.area !== "function") {
    fail("d3 browser global smoke failed");
  }
  if (!sandbox.c3 || sandbox.c3.version !== "0.4.24" || typeof sandbox.c3.generate !== "function") {
    fail("c3 browser global smoke failed");
  }
  console.log("c3-d3-global-smoke-ok d3=3.5.17 c3=0.4.24");
}






function expectShortcutManagerSemantics() {
  function normalizeEventKey(event) {
    let key = (event.key || "").toLowerCase();
    if (!key && event.which) {
      key = String.fromCharCode(event.which).toLowerCase();
    }
    return key;
  }
  function shortcutMatches(shortcut, event) {
    let parts = shortcut.toLowerCase().split("+");
    let key = parts.pop();
    let wanted = {
      shift: parts.indexOf("shift") >= 0,
      ctrl: parts.indexOf("ctrl") >= 0 || parts.indexOf("control") >= 0,
      alt: parts.indexOf("alt") >= 0,
      meta: parts.indexOf("meta") >= 0 || parts.indexOf("cmd") >= 0 || parts.indexOf("command") >= 0,
    };
    return normalizeEventKey(event) === key &&
      event.shiftKey === wanted.shift &&
      event.ctrlKey === wanted.ctrl &&
      event.altKey === wanted.alt &&
      event.metaKey === wanted.meta;
  }
  if (!shortcutMatches("shift+l", { key: "L", shiftKey: true, ctrlKey: false, altKey: false, metaKey: false })) {
    fail("shift+l shortcut matching failed");
  }
  if (shortcutMatches("shift+l", { key: "l", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })) {
    fail("shift+l shortcut matched without shift");
  }
  console.log("shortcut-manager-semantics-smoke-ok shortcut=shift+l");
}

function expectPositionCalculatorVendorGlobal() {
  function JQuery() {
    return { length: 0 };
  }
  JQuery.extend = function(target, ...sources) { return Object.assign(target, ...sources); };
  JQuery.isWindow = function(value) { return value === sandbox.window; };
  const sandbox = {
    console,
    jQuery: JQuery,
    $: JQuery,
    document: { documentElement: {}, body: {} },
    exports: undefined,
    module: undefined,
    define: undefined,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("vendor/position-calculator.js", "utf8"), sandbox, { filename: "vendor/position-calculator.js" });
  if (typeof JQuery.PositionCalculator !== "function") {
    fail("PositionCalculator browser global smoke failed");
  }
  const calculator = new JQuery.PositionCalculator({});
  if (!calculator || typeof calculator.calculate !== "function" || calculator.calculate() !== null) {
    fail("PositionCalculator empty-options compatibility smoke failed");
  }
  console.log("position-calculator-vendor-smoke-ok version=1.1.2");
}

function expectNoVNCVendorGlobal() {
  function Element() {
    this.style = {};
    this.childNodes = [];
  }
  Element.prototype.addEventListener = function() {};
  Element.prototype.removeEventListener = function() {};
  Element.prototype.appendChild = function(child) { this.childNodes.push(child); return child; };
  const document = {
    createElement() { return new Element(); },
    getElementById() { return new Element(); },
    addEventListener() {},
    removeEventListener() {},
    body: new Element(),
  };
  const sandbox = {
    console,
    document,
    navigator: { userAgent: "node-novnc-smoke" },
    WebSocket: function() {},
    Image: function() {},
    atob(input) { return Buffer.from(input, "base64").toString("binary"); },
    btoa(input) { return Buffer.from(input, "binary").toString("base64"); },
    setTimeout() { return 0; },
    clearTimeout() {},
    exports: undefined,
    module: undefined,
    define: undefined,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("vendor/novnc.js", "utf8"), sandbox, { filename: "vendor/novnc.js" });
  if (!sandbox.NoVNC || typeof sandbox.NoVNC.RFB !== "function" || typeof sandbox.NoVNC.WebUtil !== "object") {
    fail("NoVNC vendor browser global smoke failed");
  }
  console.log(`novnc-vendor-global-smoke-ok rfb=${typeof sandbox.NoVNC.RFB} webutil=${typeof sandbox.NoVNC.WebUtil}`);
}



function expectDagreGraphlibBrowserGlobals() {
  const sandbox = { console, window: {}, self: {}, exports: undefined, module: undefined, define: undefined };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of [
    "node_modules/lodash/lodash.js",
    "node_modules/graphlib/dist/graphlib.core.js",
    "node_modules/dagre/dist/dagre.core.js",
  ]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  if (!sandbox._ || sandbox._.VERSION !== "4.18.1") {
    fail("dagre/graphlib smoke lost lodash global");
  }
  if (!sandbox.graphlib || typeof sandbox.graphlib.Graph !== "function") {
    fail("graphlib browser global smoke failed");
  }
  if (!sandbox.dagre || typeof sandbox.dagre.layout !== "function") {
    fail("dagre browser global smoke failed");
  }
  const graph = new sandbox.graphlib.Graph({ multigraph: true, compound: true }).setGraph({
    rankdir: "TB",
  });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setNode("a", { width: 10, height: 10 });
  graph.setNode("b", { width: 10, height: 10 });
  graph.setEdge("a", "b", { weight: 1, minlen: 1 });
  if (!graph.hasNode("a")) {
    fail("graphlib Graph smoke failed");
  }
  sandbox.dagre.layout(graph);
  const a = graph.node("a");
  const b = graph.node("b");
  if (!a || !b || typeof a.x !== "number" || typeof a.y !== "number" || typeof b.x !== "number" || typeof b.y !== "number") {
    fail("dagre layout smoke failed");
  }
  if (sandbox.dagre.version !== "0.8.5" || sandbox.graphlib.version !== "2.1.8") {
    fail(`dagre/graphlib version mismatch dagre=${sandbox.dagre.version} graphlib=${sandbox.graphlib.version}`);
  }

  for (const file of [
    "node_modules/d3/d3.js",
    "vendor/dagre-d3/dagre-d3.core.js",
  ]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  if (!sandbox.dagreD3 || sandbox.dagreD3.version !== "0.4.11-pre") {
    fail("dagre-d3 browser global smoke failed");
  }
  const renderGraph = new sandbox.dagreD3.graphlib.Graph().setGraph({ rankdir: "TB" });
  renderGraph.setDefaultEdgeLabel(() => ({}));
  renderGraph.setNode("service-a", { width: 40, height: 20 });
  renderGraph.setNode("service-b", { width: 40, height: 20 });
  renderGraph.setEdge("service-a", "service-b", {});
  sandbox.dagreD3.dagre.layout(renderGraph);
  if (typeof renderGraph.node("service-a").x !== "number" || typeof renderGraph.node("service-b").y !== "number") {
    fail("dagre-d3 stack graph layout smoke failed");
  }
  console.log(`dagre-graphlib-browser-global-smoke-ok dagre=${sandbox.dagre.version} graphlib=${sandbox.graphlib.version} layout=ok ax=${a.x} bx=${b.x}`);
}

function expectBootstrapMultiselectVendorGlobal() {
  function JQuery() {
    return {
      each() { return this; },
      data() { return undefined; },
    };
  }
  JQuery.fn = {};
  JQuery.extend = function(target, ...sources) { return Object.assign(target, ...sources); };
  const sandbox = {
    console,
    jQuery: JQuery,
    $: JQuery,
    window: {},
    document: {},
    exports: undefined,
    module: undefined,
    define: undefined,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("vendor/bootstrap-multiselect/bootstrap-multiselect.js", "utf8"), sandbox, { filename: "vendor/bootstrap-multiselect/bootstrap-multiselect.js" });
  if (typeof JQuery.fn.multiselect !== "function" || typeof JQuery.fn.multiselect.Constructor !== "function") {
    fail("bootstrap-multiselect vendor browser global smoke failed");
  }
  console.log("bootstrap-multiselect-vendor-smoke-ok tag=v0.9.10");
}

function expectBootstrapSassAssets() {
  const packagePath = "vendor/bootstrap-sass/package.json";
  const jsPath = "vendor/bootstrap-sass/assets/javascripts/bootstrap.js";
  const transitionPath = "vendor/bootstrap-sass/assets/javascripts/bootstrap/transition.js";
  const collapsePath = "vendor/bootstrap-sass/assets/javascripts/bootstrap/collapse.js";
  const dropdownPath = "vendor/bootstrap-sass/assets/javascripts/bootstrap/dropdown.js";
  const scssPath = "vendor/bootstrap-sass/assets/stylesheets/_bootstrap.scss";
  const variablesPath = "vendor/bootstrap-sass/assets/stylesheets/bootstrap/_variables.scss";
  const fontPath = "vendor/bootstrap-sass/assets/fonts/bootstrap/glyphicons-halflings-regular.woff2";
  for (const file of [packagePath, jsPath, transitionPath, collapsePath, dropdownPath, scssPath, variablesPath, fontPath]) {
    if (!fs.existsSync(file)) {
      fail(`bootstrap-sass asset missing: ${file}`);
    }
  }
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (packageJson.version !== "3.4.3" || packageJson.license !== "MIT") {
    fail(`bootstrap-sass vendor metadata changed: version=${packageJson.version} license=${packageJson.license}`);
  }
  const js = fs.readFileSync(jsPath, "utf8");
  const transition = fs.readFileSync(transitionPath, "utf8");
  const collapse = fs.readFileSync(collapsePath, "utf8");
  const dropdown = fs.readFileSync(dropdownPath, "utf8");
  const scss = fs.readFileSync(scssPath, "utf8");
  if (!js.includes("VERSION  = '3.4.1'") || !js.includes("$.fn.modal") || !js.includes("$.fn.dropdown")) {
    fail("bootstrap-sass JavaScript asset does not look like Bootstrap 3.4.x");
  }
  if (!transition.includes("emulateTransitionEnd") || !collapse.includes("bs.collapse") || !dropdown.includes("bs.dropdown")) {
    fail("bootstrap-sass runtime allowlist modules lost expected behavior");
  }
  if (!scss.includes("bootstrap/variables") || !scss.includes("bootstrap/mixins")) {
    fail("bootstrap-sass SCSS entrypoint lost expected imports");
  }
  console.log("bootstrap-sass-assets-smoke-ok vendor=3.4.3 bootstrap-js=3.4.1 runtime=transition,collapse,dropdown");
}

function expectEmberPowerSelectSassAssets() {
  const packagePath = "vendor/ember-power-select/package.json";
  const scssPath = "vendor/ember-power-select/app/styles/ember-power-select.scss";
  const variablesPath = "vendor/ember-power-select/app/styles/ember-power-select/variables.scss";
  const powerSelectLicensePath = "vendor/ember-power-select/LICENSE.md";
  const powerSelectUpstreamPath = "vendor/ember-power-select/UPSTREAM.md";
  const basicDropdownScssPath = "vendor/ember-basic-dropdown/app/styles/ember-basic-dropdown.scss";
  const basicDropdownLicensePath = "vendor/ember-basic-dropdown/LICENSE.md";
  const basicDropdownUpstreamPath = "vendor/ember-basic-dropdown/UPSTREAM.md";
  for (const file of [
    packagePath,
    scssPath,
    variablesPath,
    powerSelectLicensePath,
    powerSelectUpstreamPath,
    basicDropdownScssPath,
    basicDropdownLicensePath,
    basicDropdownUpstreamPath,
  ]) {
    if (!fs.existsSync(file)) {
      fail(`ember-power-select style asset missing: ${file}`);
    }
  }
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scss = fs.readFileSync(scssPath, "utf8");
  const powerSelectUpstream = fs.readFileSync(powerSelectUpstreamPath, "utf8");
  const basicDropdownScss = fs.readFileSync(basicDropdownScssPath, "utf8");
  const basicDropdownUpstream = fs.readFileSync(basicDropdownUpstreamPath, "utf8");
  if (packageJson.version !== "1.0.0-beta.19" || packageJson.license !== "MIT") {
    fail(`ember-power-select vendor metadata changed: version=${packageJson.version} license=${packageJson.license}`);
  }
  if (!scss.includes('@use "sass:math";') || !scss.includes("math.is-unitless($ember-power-select-line-height)")) {
    fail("ember-power-select vendored Sass lost math.is-unitless maintenance patch");
  }
  if (!scss.includes("../../../ember-basic-dropdown/app/styles/ember-basic-dropdown")) {
    fail("ember-power-select vendored Sass lost explicit ember-basic-dropdown import path");
  }
  if (!basicDropdownScss.includes(".ember-basic-dropdown-content")) {
    fail("ember-basic-dropdown vendored Sass lost expected content styles");
  }
  if (!powerSelectUpstream.includes("Upstream version: `1.0.0-beta.19`")) {
    fail("ember-power-select provenance version drifted");
  }
  if (!basicDropdownUpstream.includes("Upstream version: `0.16.0-beta.4`") ||
      !basicDropdownUpstream.includes("sha512-MuPZEeMw/r6EOHgoCokY/BjRuzwS7HLGZ0BaFomM0/7tcbZYFJ4g5zj1PIoGQW1Kxpe9rhYdLKOIg3JKmYbPpw==")) {
    fail("ember-basic-dropdown provenance version or integrity drifted");
  }
  console.log("ember-power-select-sass-assets-smoke-ok vendor=1.0.0-beta.19 basic_dropdown=0.16.0-beta.4");
}

function expectPrismBrowserGlobals() {
  function Element() {}
  Element.prototype.matches = function() { return false; };
  Element.prototype.querySelectorAll = function() { return []; };
  Element.prototype.classList = { add() {}, remove() {}, contains() { return false; } };
  const document = {
    readyState: "loading",
    currentScript: null,
    addEventListener() {},
    removeEventListener() {},
    getElementsByTagName() { return []; },
    querySelectorAll() { return []; },
    createElement() { return new Element(); },
  };
  const sandbox = {
    console,
    setTimeout() { return 0; },
    clearTimeout() {},
    Element,
    document,
    navigator: { userAgent: "node-prism-smoke" },
    Prism: { manual: true },
    exports: undefined,
    module: undefined,
    define: undefined,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.Prism = sandbox.Prism;
  vm.createContext(sandbox);
  for (const file of [
    "node_modules/prismjs/prism.js",
    "node_modules/prismjs/components/prism-yaml.js",
    "node_modules/prismjs/components/prism-bash.js",
  ]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  const Prism = sandbox.Prism;
  if (!Prism || typeof Prism.highlight !== "function" || !Prism.languages.yaml || !Prism.languages.bash) {
    fail("prismjs browser global smoke failed");
  }
  const yamlOut = Prism.highlight("name: value\nitems:\n  - one\n", Prism.languages.yaml, "yaml");
  const bashOut = Prism.highlight("#!/bin/bash\necho hello && exit 0\n", Prism.languages.bash, "bash");
  if (!yamlOut.includes("token") || !bashOut.includes("token")) {
    fail("prismjs highlight output lost token markup");
  }
  console.log(`prism-global-smoke-ok yamlLength=${yamlOut.length} bashLength=${bashOut.length}`);
}

const sass = require("sass");
const ansiUpModule = require("ansi_up");
const serialize = require("serialize-javascript");
const xterm = require("@xterm/xterm");
const fit = require("@xterm/addon-fit");
if (!sass.info || !sass.info.includes("dart-sass")) {
  fail("Dart Sass smoke failed");
}
if (!xterm.Terminal || !fit.FitAddon) {
  fail("@xterm smoke failed");
}
const ansiUp = new ansiUpModule.AnsiUp();
ansiUp.escape_html = false;
const ansiHtml = ansiUp.ansi_to_html("\u001b[31mred\u001b[0m &lt;x&gt;");
if (!ansiHtml.includes('style="color:rgb(187,0,0)"') && !ansiHtml.includes('style="color:rgb(187, 0, 0)"')) {
  fail(`ansi_up color conversion failed: ${ansiHtml}`);
}
if (!ansiHtml.includes("&lt;x&gt;")) {
  fail(`ansi_up escaped-text preservation failed: ${ansiHtml}`);
}
if (ansiHtml.includes("&amp;lt;")) {
  fail(`ansi_up double escaped log text: ${ansiHtml}`);
}
const serialized = serialize({ html: "</script><x>", re: /abc/gi });
if (typeof serialize !== "function") {
  fail("serialize-javascript is not a CommonJS function export");
}
if (!serialized.includes("\\u003C\\u002Fscript\\u003E")) {
  fail(`serialize-javascript script escaping changed: ${serialized}`);
}
if (!serialized.includes('new RegExp("abc", "gi")')) {
  fail(`serialize-javascript RegExp serialization changed: ${serialized}`);
}

expectMissing("dompurify");
expectMissing("xmldom");
expectVersion("xmlhttprequest-ssl", "4.0.0");
expectPackageJsonVersion("ember-cli", "6.12.0");
expectPackageJsonVersion("ember-resolver", "13.2.0");
expectPackageJsonVersion("ember-intl", "8.4.0");
expectPackageJsonVersion("@formatjs/icu-messageformat-parser", "3.5.16");
expectVersion("ember-cli-babel", "8.3.1");
expectMissing("ember-cli-htmlbars-inline-precompile");
expectPackageJsonVersion("lacsso", "0.0.60-rc16.1");
expectPackageJsonVersion("ember-cli-pagination", "2.2.4-rc16.0");
expectPackageJsonVersion("ember-rl-dropdown", "0.8.1-rc16.0");
expectVersion("ansi_up", "6.0.6");
expectVersion("serialize-javascript", "7.0.5");
expectMissing("clean-css");
expectMissing("clean-css-promise");
expectVersion("raw-body", "2.5.3");
expectPackageJsonVersion("uuid", "11.1.1");
expectVersion("testem", "3.20.0");
expectVersion("socket.io", "4.8.3");
expectVersion("socket.io-client", "4.8.3");
expectVersion("websocket-driver", "0.7.5");
expectPackageJsonVersion("jgrowl", "1.4.2");
expectPackageJsonVersion("identicon.js", "2.3.3");
expectPackageJsonVersion("md5-jkmyers", "0.0.1");
expectVersion("async", "3.2.6");
expectVersion("prismjs", "1.30.0");
expectVersion("lodash", "4.18.1");
expectVersion("shell-quote", "1.10.0");
expectVersion("dagre", "0.8.5");
expectVersion("graphlib", "2.1.8");
expectVersion("commonmark", "0.31.2");
expectVersion("c3", "0.4.24");
expectVersion("d3", "3.5.17");
expectVersion("merge", "2.1.1");
expectVersion("yamljs", "0.3.0");
expectMissing("request");
expectMissing("forever-agent");
expectMissing("jsdom");
expectVersion("ws", "8.21.1");

require("ember-cli");
require("testem");
require("engine.io");
if (typeof require("uuid").v4 !== "function") {
  fail("uuid v4 CommonJS export missing");
}
console.log("require-smoke-ok");

function runSocketSmoke(label, transport) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    const socketio = require("socket.io");
    const client = require("socket.io-client");
    const io = socketio(server);
    let done = false;

    function finish(err) {
      if (done) {
        return;
      }
      done = true;
      server.close(() => (err ? reject(err) : resolve()));
    }

    io.on("connection", (sock) => {
      sock.on("probe", (msg) => sock.emit("probe-result", `${msg}-ok`));
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const c = client(`http://127.0.0.1:${port}`, {
        transports: [transport],
        forceNew: true,
        reconnection: false,
        timeout: 3000,
      });
      c.on("connect", () => c.emit("probe", label));
      c.on("probe-result", (msg) => {
        c.close();
        if (msg !== `${label}-ok`) {
          finish(new Error(`unexpected ${transport} result ${msg}`));
        } else {
          finish();
        }
      });
      c.on("connect_error", finish);
      c.on("error", finish);
    });

    setTimeout(() => finish(new Error(`socket.io ${transport} smoke timeout`)), 5000);
  }).then(() => console.log(`socketio-${transport}-smoke-ok`));
}

(async () => {
  expectShortcutManagerSemantics();
  expectPositionCalculatorVendorGlobal();
  expectNoVNCVendorGlobal();
  expectBootstrapSassAssets();
  expectEmberPowerSelectSassAssets();
  expectBootstrapMultiselectVendorGlobal();
  expectDagreGraphlibBrowserGlobals();
  expectEmberLtsAndJQueryRuntime();
  expectBrowserifyReplacementVendorGlobals();
  expectJGrowlBrowserGlobal("node_modules/jgrowl/jquery.jgrowl.js");
  expectMd5IdenticonBrowserGlobals();
  expectPrismBrowserGlobals();
  await expectAsyncBrowserGlobal("node_modules/async/dist/async.js");
  expectMomentRuntime();
  expectQrCodeGeneratorRuntime();
  expectBrowserGlobalBundle("node_modules/lodash/lodash.js", "_", "4.18.1");
  expectCommonmarkBrowserGlobal("node_modules/commonmark/dist/commonmark.js");
  expectC3D3BrowserGlobals();
  expectModernGlobDevServerPath();
  expectModuleResolverGlobCompat();
  expectBodyRawBodyOverride();
  await expectSaneWatcherOverride();
  expectQuickTempRimrafOverride();
  expectSyncDiskCacheRimrafOverride();
  expectBroccoliTerserRimrafOverride();
  expectEmberCliBabelRimrafOverride();
  await expectRimrafCallbackCompat();
  expectYamljsBuildGraph();
  await expectMkdirpGraph();
  expectExistsSyncCompat();
  await expectInflightCompat();
  expectOsenvCompat();
  expectSourceMapUrlCompat();
  expectSortPackageJsonCompat();
  expectLodashTemplateCompat();
  expectCoreJsCompat();
  expectEmberApiStoreFetchUpgrade();
  await runSocketSmoke("websocket", "websocket");
  await runSocketSmoke("polling", "polling");
  console.log("node24-lock-baseline-smoke-ok");
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
