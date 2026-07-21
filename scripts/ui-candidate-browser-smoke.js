"use strict";

const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { URL } = require("url");

const root = process.env.UI_ROOT;
const base = process.env.UI_SMOKE_BASE || "http://127.0.0.1:8098";
const apiTarget = process.env.PASTURESTACK_API_TARGET || process.env.RANCHER_API_TARGET || "http://127.0.0.1:8080";
const username = process.env.PASTURESTACK_USER || process.env.RANCHER_USER;
const password = process.env.PASTURESTACK_PASS || process.env.RANCHER_PASS;
const projectId = process.env.PASTURESTACK_PROJECT_ID || process.env.RANCHER_PROJECT_ID || "1a5";
const outDir = process.env.UI_SMOKE_OUT_DIR || path.join(process.cwd(), "tmp", "ui-browser-smoke");
const port = Number(new URL(base).port || 80);
const bindHost = process.env.UI_SMOKE_BIND || "127.0.0.1";
const serveOnly = process.env.UI_SMOKE_SERVE_ONLY === "1";
const defaultRoutes = `/env/${projectId}/infra/hosts,/env/${projectId}/apps/stacks?which=infra`;
const routes = (process.env.UI_SMOKE_ROUTES || defaultRoutes).split(",").map((item) => item.trim()).filter(Boolean);
let wsUpgradeCount = 0;
const visibleTranslationKeyPattern = /\b[a-z][A-Za-z0-9]*(?:Page|Partial|Settings|Config|Modal|Form|Table|Header|Footer|Tab|Tabs|Section)\.[A-Za-z0-9_.-]+\b/g;

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function shouldProxy(urlPath) {
  return /^\/(v1|v2-beta|v1-auth|v1-catalog|v1-telemetry|v1-webhooks|r)(\/|$)/.test(urlPath);
}

function rawHeaderBlock(req, targetPath) {
  const lines = [`${req.method} ${targetPath} HTTP/${req.httpVersion}`];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
  }
  return `${lines.join("\r\n")}\r\n\r\n`;
}

function proxyUpgrade(req, socket, head) {
  const parsed = new URL(req.url, base);
  if (!shouldProxy(parsed.pathname)) {
    socket.destroy();
    return;
  }

  const targetBase = new URL(apiTarget);
  const targetPort = Number(targetBase.port || (targetBase.protocol === "https:" ? 443 : 80));
  if (targetBase.protocol !== "http:") {
    socket.destroy(new Error("websocket smoke proxy only supports http compatible API targets"));
    return;
  }

  const targetPath = parsed.pathname + parsed.search;
  const upstream = net.connect(targetPort, targetBase.hostname, () => {
    wsUpgradeCount += 1;
    upstream.write(rawHeaderBlock(req, targetPath));
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  const closeBoth = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on("error", closeBoth);
  socket.on("error", closeBoth);
  upstream.on("end", () => socket.end());
  socket.on("end", () => upstream.end());
}

function startServer() {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, base);
    if (shouldProxy(parsed.pathname)) {
      const target = new URL(parsed.pathname + parsed.search, apiTarget);
      // Preserve the browser-facing Host header. The compatible server uses Host while
      // generating absolute API links; replacing it with the upstream socket
      // host creates false CORS/auth failures in same-origin smoke tests.
      const headers = { ...req.headers };
      const proxy = http.request(target, { method: req.method, headers, timeout: 30000 }, (upstream) => {
        res.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(res);
      });
      proxy.on("timeout", () => proxy.destroy(new Error("upstream timeout")));
      proxy.on("error", (err) => {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        res.end(`proxy error: ${err.message}`);
      });
      req.pipe(proxy);
      return;
    }

    const rel = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || "index.html";
    let file = path.resolve(root, rel);
    if (!file.startsWith(resolvedRoot)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, "index.html");
    }
    res.writeHead(200, { "content-type": contentType(file) });
    fs.createReadStream(file).pipe(res);
  });
  server.on("upgrade", proxyUpgrade);
  return new Promise((resolve) => {
    server.listen(port, bindHost, () => resolve(server));
  });
}

async function fetchProjectsStatus(page) {
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const status = await page.evaluate(async () => {
        const res = await fetch("/v2-beta/projects", { credentials: "same-origin" });
        return res.status;
      });
      if (status === 200) return status;
      lastError = new Error(`status ${status}`);
    } catch (err) {
      lastError = err;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(`projects API did not authenticate: ${lastError ? lastError.message : "unknown"}`);
}

async function fetchJson(page, urlPath, label) {
  const result = await page.evaluate(async ({ urlPath }) => {
    const res = await fetch(urlPath, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (err) {
      return { ok: false, status: res.status, parseError: err.message, text: text.slice(0, 300) };
    }
    return { ok: res.ok, status: res.status, body };
  }, { urlPath });

  if (!result.ok) {
    throw new Error(`API store contract ${label} failed status=${result.status} parse=${result.parseError || ""} body=${JSON.stringify(result.body || result.text || "").slice(0, 300)}`);
  }
  return result.body;
}

function assertCollection(body, label) {
  if (!body || !Array.isArray(body.data)) {
    throw new Error(`API store contract ${label} expected collection data array`);
  }
  return body.data;
}

async function assertApiStoreContract(page) {
  const projects = assertCollection(await fetchJson(page, "/v2-beta/projects", "projects"), "projects");
  const schemas = assertCollection(await fetchJson(page, "/v2-beta/schemas", "schemas"), "schemas");
  const settings = assertCollection(await fetchJson(page, "/v2-beta/settings", "settings"), "settings");
  const hosts = assertCollection(await fetchJson(page, `/v2-beta/projects/${projectId}/hosts`, "project-hosts"), "project-hosts");
  const stacks = assertCollection(await fetchJson(page, `/v2-beta/projects/${projectId}/stacks`, "project-stacks"), "project-stacks");

  if (!projects.some((item) => item && item.id === projectId)) {
    throw new Error(`API store contract projects missing projectId=${projectId}`);
  }
  if (!schemas.some((item) => item && item.id === "host")) {
    throw new Error("API store contract schemas missing host schema");
  }
  if (!settings.some((item) => item && (item.id || item.name))) {
    throw new Error("API store contract settings returned no identifiable settings");
  }
  if (process.env.UI_SMOKE_REQUIRE_HOSTS === "1" && hosts.length === 0) {
    throw new Error(`API store contract project ${projectId} returned zero hosts`);
  }

  console.log(`api-store-contract-smoke-ok projects=${projects.length} schemas=${schemas.length} settings=${settings.length} hosts=${hosts.length} stacks=${stacks.length}`);
}

async function failOnRenderedError(page, route) {
  const body = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 6000);
  if (/HTTP ERROR 404|Problem accessing|Application Error|fail whale|Template version not found|Error check update/i.test(body)) {
    throw new Error(`route ${route} rendered error body: ${body.slice(0, 400)}`);
  }
}

async function assertI18nHealth(page, route, warningStartIndex, i18nWarnings) {
  const body = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 12000);
  if (/\*%MISSING%\*/i.test(body)) {
    throw new Error(`route ${route} rendered missing translation marker`);
  }

  const keyLeaks = Array.from(new Set(body.match(visibleTranslationKeyPattern) || []));
  if (keyLeaks.length) {
    throw new Error(`route ${route} rendered translation keys: ${keyLeaks.slice(0, 10).join(", ")}`);
  }

  const newWarnings = i18nWarnings.slice(warningStartIndex);
  if (newWarnings.length) {
    throw new Error(`route ${route} emitted i18n warnings: ${newWarnings.slice(0, 10).join(" | ")}`);
  }

  console.log(`i18n-smoke-ok route=${route} warnings=0 keyLeaks=0`);
}

async function assertI18nFormatterContract(page, i18nWarnings) {
  const warningStartIndex = i18nWarnings.length;
  const result = await page.evaluate(async () => {
    function fail(message) {
      throw new Error(message);
    }

    function text(value) {
      return value === undefined || value === null ? "" : String(value);
    }

    function assertEqual(label, actual, expected) {
      if (actual !== expected) {
        fail(`${label} expected=${expected} actual=${actual}`);
      }
    }

    function assertContains(label, actual, expected) {
      if (!actual.includes(expected)) {
        fail(`${label} expected to contain ${expected} actual=${actual}`);
      }
    }

    const app = window.Ui;
    if (!app || !app.__container__ || typeof app.__container__.lookup !== "function") {
      fail("window.Ui container is unavailable");
    }

    const intl = app.__container__.lookup("service:intl");
    const userLanguage = app.__container__.lookup("service:user-language");
    if (!intl || typeof intl.t !== "function" || typeof intl.formatMessage !== "function") {
      fail("service:intl formatter API is unavailable");
    }

    assertEqual("plain translation", text(intl.t("generic.name")), "Name");
    assertEqual(
      "parameter translation",
      text(intl.t("containerChoices.containerOptionWithState", { name: "web", state: "running" })),
      "web (running)"
    );
    assertEqual(
      "plural singular",
      text(intl.t("validation.stringLength.exactly", { key: "Name", count: 1 })),
      "\"Name\" should be 1 character"
    );
    assertEqual(
      "plural plural",
      text(intl.t("validation.stringLength.exactly", { key: "Name", count: 2 })),
      "\"Name\" should be 2 characters"
    );
    assertContains(
      "nested plural/select singular",
      text(intl.t("pagination.multi", { pages: 1, count: 1, from: 1, to: 1 })).replace(/\s+/g, " ").trim(),
      "1 Item"
    );
    assertContains(
      "nested plural/select range",
      text(intl.t("pagination.multi", { pages: 3, count: 30, from: 1, to: 10 })).replace(/\s+/g, " ").trim(),
      "1 - 10 of 30"
    );

    const html = typeof intl.tHtml === "function"
      ? text(intl.tHtml("apiPage.content", { displayName: "Prod" }))
      : text(intl.formatHtmlMessage(intl.findTranslationByKey("apiPage.content"), { displayName: "Prod" }));
    assertContains("html message", html, "<code>Prod</code>");
    if (html.includes("&lt;code&gt;")) {
      fail(`html message was escaped: ${html}`);
    }

    if (!userLanguage || typeof userLanguage.sideLoadLanguage !== "function") {
      fail("service:user-language sideLoadLanguage is unavailable");
    }
    await userLanguage.sideLoadLanguage("zh-hans");
    assertEqual("zh-hans locale", text(intl.t("generic.name")), "名称");
    await userLanguage.sideLoadLanguage("en-us");
    assertEqual("en-us locale reset", text(intl.t("generic.name")), "Name");

    return {
      locale: intl.get && intl.get("_locale"),
      htmlLength: html.length,
    };
  });

  const newWarnings = i18nWarnings.slice(warningStartIndex);
  if (newWarnings.length) {
    throw new Error(`i18n formatter emitted warnings: ${newWarnings.slice(0, 10).join(" | ")}`);
  }
  console.log(`i18n-formatter-smoke-ok locale=${Array.isArray(result.locale) ? result.locale.join(",") : result.locale} htmlLength=${result.htmlLength}`);
}

async function assertRouteSpecificBehavior(page, route, beforeWsUpgradeCount) {
  if (route.includes("/container-log")) {
    await page.locator(".log-body").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1500);
    if (wsUpgradeCount <= beforeWsUpgradeCount) {
      throw new Error(`route ${route} did not open a proxied WebSocket`);
    }
  }

  if (route.includes("/console")) {
    await page.locator(".shell-body").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1500);
    if (wsUpgradeCount <= beforeWsUpgradeCount) {
      throw new Error(`route ${route} did not open a proxied WebSocket`);
    }
  }
}

async function main() {
  if (!root) {
    throw new Error("UI_ROOT is required");
  }
  if (!serveOnly && (!username || !password)) {
    throw new Error("PASTURESTACK_USER and PASTURESTACK_PASS are required for automated browser smoke");
  }
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startServer();
  if (serveOnly) {
    console.log(`ui-candidate-preview-ready base=${base} bind=${bindHost} api=${apiTarget}`);
    await new Promise((resolve) => {
      const stop = () => server.close(resolve);
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return;
  }
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: process.env.UI_SMOKE_HEADFUL !== "1" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  const failedRequests = [];
  const i18nWarnings = [];

  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    const text = msg.text();
    if (/translation not found|\*%MISSING%\*/i.test(text)) {
      i18nWarnings.push(`${msg.type()}: ${text}`);
    }
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    failedRequests.push(`${req.method()} ${req.url()} ${failure ? failure.errorText : ""}`);
  });

  try {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const passwordInputs = await page.locator('input[type="password"]').count();
    if (passwordInputs > 0) {
      const tokenPromise = page.waitForResponse(
        (resp) => resp.url().includes("/token") && resp.request().method() === "POST" && resp.status() === 201,
        { timeout: 30000 }
      );
      await page.locator('input[type="text"], input[type="email"], input:not([type])').first().fill(username);
      await page.locator('input[type="password"]').first().fill(password);
      const submit = page.locator('button, input[type="submit"]').first();
      if (await submit.count()) {
        await submit.click();
      } else {
        await page.keyboard.press("Enter");
      }
      await tokenPromise;
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    }

    await fetchProjectsStatus(page);
    await assertApiStoreContract(page);
    await assertI18nHealth(page, "post-login", 0, i18nWarnings);
    await assertI18nFormatterContract(page, i18nWarnings);
    for (const route of routes) {
      const beforeWsUpgradeCount = wsUpgradeCount;
      const beforeI18nWarningCount = i18nWarnings.length;
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await failOnRenderedError(page, route);
      await assertI18nHealth(page, route, beforeI18nWarningCount, i18nWarnings);
      await assertRouteSpecificBehavior(page, route, beforeWsUpgradeCount);
    }

    await page.screenshot({ path: path.join(outDir, "ui-candidate-browser-smoke-final.png"), fullPage: true });
    const filteredFailures = failedRequests.filter((line) => !line.includes("favicon") && !line.includes("net::ERR_ABORTED"));
    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
    if (filteredFailures.length) throw new Error(`request failures: ${filteredFailures.join(" | ")}`);
    console.log(`ui-candidate-browser-smoke-ok routes=${routes.join(",")} wsUpgrades=${wsUpgradeCount}`);
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
