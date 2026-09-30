"use strict";

// Focused controls for the brace-expansion and Engine.IO security patch pins.
// Network checks bind only to an ephemeral loopback port, never the product API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function expansionAt(packagePath) {
  const exported = require(packagePath);
  return typeof exported === "function" ? exported : exported.expand;
}

function checkBraceCase(packagePath, name) {
  const expand = expansionAt(packagePath);
  const inputs = {
    commaRecursion: "{" + "{a},".repeat(8000) + "b}",
    argumentArray: "{{x}," + "a,".repeat(125000) + "b}",
    nestedMembers: "{a,".repeat(4000) + "z" + "}".repeat(4000),
    nestedSet: "{".repeat(3200) + "a,b" + "}".repeat(3200),
    rewrite: "{a}" + "}".repeat(32000) + ",z}",
  };
  assert.ok(Object.hasOwn(inputs, name));
  const result = expand(inputs[name]);
  assert.ok(Array.isArray(result) && result.length > 0);
}

function checkBraces() {
  const lock = require("../package-lock.json");
  const checkedVersions = new Set();
  let instances = 0;
  for (const [key, info] of Object.entries(lock.packages)) {
    if (!key.endsWith("node_modules/brace-expansion")) continue;
    const packagePath = path.resolve(__dirname, "..", key);
    const installed = JSON.parse(fs.readFileSync(path.join(packagePath, "package.json"), "utf8"));
    assert.equal(installed.version, info.version, "installed brace-expansion matches the release lock");
    const expand = expansionAt(packagePath);
    assert.deepEqual(expand("src/{app,test}-{1..2}.js"), [
      "src/app-1.js", "src/app-2.js", "src/test-1.js", "src/test-2.js",
    ]);
    assert.deepEqual(expand("file\\{a,b\\}.js"), ["file{a,b}.js"]);
    instances++;
    if (checkedVersions.has(info.version)) continue;
    checkedVersions.add(info.version);
    for (const name of ["commaRecursion", "argumentArray", "nestedMembers", "nestedSet", "rewrite"]) {
      const child = spawnSync(process.execPath, [__filename, "--brace-case", packagePath, name], {
        encoding: "utf8", timeout: 8000, maxBuffer: 8192,
      });
      assert.equal(child.status, 0, `${info.version} ${name} completed without stack exhaustion or timeout`);
    }
  }
  assert.ok(instances > 0);
  assert.deepEqual([...checkedVersions].sort(), ["1.1.21", "2.1.7", "5.0.12"]);
  console.log(`UI_SECURITY_BRACE_COMPAT_OK instances=${instances} release_lines=3 hostile_cases=15`);
}

function checkClient(url, transports, expectedTransport) {
  const { Socket } = require("engine.io-client");
  return new Promise((resolve, reject) => {
    const client = new Socket(url, { transports });
    const timer = setTimeout(() => finish(new Error("Engine.IO transport timeout")), 5000);
    function finish(error) {
      clearTimeout(timer);
      client.close();
      error ? reject(error) : resolve();
    }
    client.once("error", finish);
    client.once(expectedTransport === "websocket" && transports[0] === "polling" ? "upgrade" : "open", () => {
      try {
        assert.equal(client.transport.name, expectedTransport);
        client.send("synthetic-transport-control");
      } catch (error) { finish(error); }
    });
    client.once("message", (message) => {
      try { assert.equal(message, "synthetic-transport-control"); finish(); }
      catch (error) { finish(error); }
    });
  });
}

function rejectedUpgrade(url) {
  const WebSocket = require("ws");
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => finish(new Error("Engine.IO rejection timeout")), 5000);
    function finish(error, status) {
      clearTimeout(timer);
      ws.terminate();
      error ? reject(error) : resolve(status);
    }
    ws.once("open", () => finish(new Error("mismatched Engine.IO revision was accepted")));
    ws.on("error", () => {}); // termination after a rejected HTTP upgrade is expected
    ws.once("unexpected-response", (_request, response) => {
      response.resume();
      finish(null, response.statusCode);
    });
  });
}

async function checkEngine() {
  const { Server } = require("engine.io");
  const server = http.createServer();
  const engine = new Server();
  const mismatchNames = [];
  engine.on("connection", (socket) => socket.on("message", (message) => socket.send(message)));
  engine.on("connection_error", (error) => mismatchNames.push(error.context.name));
  engine.attach(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${url}/engine.io/?EIO=4&transport=polling`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const open = await response.text();
    assert.equal(open[0], "0");
    const sid = JSON.parse(open.slice(1)).sid;
    for (const revision of ["&EIO=3", ""]) {
      assert.equal(await rejectedUpgrade(`${url.replace("http:", "ws:")}/engine.io/?transport=websocket&sid=${encodeURIComponent(sid)}${revision}`), 400);
    }
    assert.deepEqual(mismatchNames, ["PROTOCOL_MISMATCH", "PROTOCOL_MISMATCH"]);
    assert.equal(engine.clients[sid].protocol, 4, "a rejected upgrade does not replace the active protocol");
    await checkClient(url, ["polling"], "polling");
    await checkClient(url, ["websocket"], "websocket");
    await checkClient(url, ["polling", "websocket"], "websocket");
    console.log("UI_SECURITY_ENGINE_COMPAT_OK mismatched_revision=400 omitted_revision=400 polling=ok websocket=ok upgrade=ok");
  } finally {
    engine.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[2] === "--brace-case") {
  checkBraceCase(process.argv[3], process.argv[4]);
} else {
  checkBraces();
  checkEngine().catch((error) => {
    console.error(`UI_SECURITY_PATCH_COMPAT_FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
