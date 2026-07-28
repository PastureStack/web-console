"use strict";

const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const net = require("net");
const path = require("path");
const { URL } = require("url");

const root = process.env.UI_ROOT;
const base = process.env.UI_SMOKE_BASE || "http://127.0.0.1:8098";
const apiTarget = process.env.PASTURESTACK_API_TARGET || process.env.RANCHER_API_TARGET || "http://127.0.0.1:8080";
const username = process.env.PASTURESTACK_USER || process.env.RANCHER_USER;
const password = process.env.PASTURESTACK_PASS || process.env.RANCHER_PASS;
const totpSecret = process.env.PASTURESTACK_TOTP_SECRET || "";
const projectId = process.env.PASTURESTACK_PROJECT_ID || process.env.RANCHER_PROJECT_ID || "1a5";
const outDir = process.env.UI_SMOKE_OUT_DIR || path.join(process.cwd(), "tmp", "ui-browser-smoke");
const port = Number(new URL(base).port || 80);
const bindHost = process.env.UI_SMOKE_BIND || "127.0.0.1";
const serveOnly = process.env.UI_SMOKE_SERVE_ONLY === "1";
const managedMfaAccountId = process.env.PASTURESTACK_MFA_MANAGED_ACCOUNT_ID || "";
const exerciseTotpEnrollment = process.env.UI_SMOKE_EXERCISE_TOTP_ENROLLMENT === "1";
const exercisePasskeyEnrollment = process.env.UI_SMOKE_EXERCISE_PASSKEY_ENROLLMENT === "1";
const requireRecoveryEmailEnrollment = process.env.UI_SMOKE_REQUIRE_EMAIL_RECOVERY === "1";
const expectPasskeyLimit = process.env.UI_SMOKE_EXPECT_PASSKEY_LIMIT === "1";
const defaultRoutes = `/env/${projectId}/infra/hosts,/env/${projectId}/apps/stacks?which=infra`;
const routes = (process.env.UI_SMOKE_ROUTES || defaultRoutes).split(",").map((item) => item.trim()).filter(Boolean);
let wsUpgradeCount = 0;
let passkeyEnrollmentCompleted = false;
const visibleTranslationKeyPattern = /\b[a-z][A-Za-z0-9]*(?:Page|Partial|Settings|Config|Modal|Form|Table|Header|Footer|Tab|Tabs|Section)\.[A-Za-z0-9_.-]+\b/g;

function currentTotp(secret, timestamp = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = String(secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!normalized) {
    throw new Error("PASTURESTACK_TOTP_SECRET is required when the test account has TOTP enabled");
  }

  let bits = "";
  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("PASTURESTACK_TOTP_SECRET is not valid Base32");
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  }

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30000)));
  const digest = crypto.createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, "0");
}

async function completePasskeySecurityConfirmation(page) {
  const confirmationModal = page.locator(".modal-container:visible").last();
  await confirmationModal.waitFor({ state: "visible", timeout: 15000 });
  const passkeyMethod = confirmationModal.getByRole("button", {
    name: /Passkey|通行金鑰/,
  });
  if (await passkeyMethod.count()) {
    await passkeyMethod.click();
  }
  const confirm = confirmationModal.locator(".footer-actions .btn-primary");
  await confirm.waitFor({ state: "visible", timeout: 15000 });
  const confirmHandle = await confirm.elementHandle();
  await page.waitForFunction(
    (button) => Boolean(button && !button.disabled),
    confirmHandle,
    { timeout: 15000 }
  );

  const securityConfirmation = page.waitForResponse(
    (resp) => resp.url().toLowerCase().includes("/mfaoperation") &&
      resp.request().method() === "POST" &&
      (resp.request().postData() || "").includes("confirmSecurityConfirmation"),
    { timeout: 30000 }
  );
  await confirm.click();
  const confirmationResponse = await securityConfirmation;
  if (!confirmationResponse.ok()) {
    const body = await confirmationResponse.text().catch(() => "");
    throw new Error(`passkey step-up authentication failed status=${confirmationResponse.status()} body=${body.slice(0, 300)}`);
  }
}

function requestBodyField(request, name) {
  const body = request.postData() || "";
  if (!body) {
    return null;
  }
  try {
    const parsed = JSON.parse(body);
    if (parsed && Object.prototype.hasOwnProperty.call(parsed, name)) {
      return parsed[name];
    }
  } catch (error) {
    // The compatible token endpoint can also receive form-encoded bodies.
  }
  return new URLSearchParams(body).get(name);
}

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
        if (res.headersSent) {
          if (!res.writableEnded) res.destroy();
          return;
        }
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
    await userLanguage.sideLoadLanguage("zh-tw");
    assertEqual("zh-tw locale", text(intl.t("generic.name")), "名稱");
    assertEqual("zh-tw MFA locale", text(intl.t("authPage.mfa.navigation")), "多重要素驗證");
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
  if (/\/admin\/accounts(?:[/?#]|$)/.test(route)) {
    await page.locator(".accounts-manage-my-mfa").waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.locator(".accounts-manage-account-mfa").waitFor({
      state: "visible",
      timeout: 15000,
    });
    if (await page.locator(".account-row-manage-mfa").count() < 1) {
      throw new Error("account administration does not expose per-account MFA management");
    }
  }

  if (/\/account\/security(?:[/?#]|$)/.test(route)) {
    await page.locator('[data-testid="mfa-self-service-summary"]').waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.locator('[data-testid="mfa-factor-management"]').waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.locator('[data-testid="mfa-recovery-management"]').waitFor({
      state: "visible",
      timeout: 15000,
    });
    if (await page.locator('[data-testid="mfa-managed-account-warning"]').count()) {
      throw new Error("the current-account security page rendered as an administrator-managed account");
    }
    if (await page.locator('[data-testid="mfa-system-settings"]').count()) {
      throw new Error("the current-account security page exposed system-wide SMTP settings");
    }
    if (requireRecoveryEmailEnrollment) {
      await page.locator('[data-testid="mfa-recovery-management"] input[type="email"]').waitFor({
        state: "visible",
        timeout: 15000,
      });
      await page.locator('[data-testid="mfa-begin-recovery-email"]').waitFor({
        state: "visible",
        timeout: 15000,
      });
      console.log("recovery-email-self-service-smoke-ok smtp=available enrollment=visible");
    }

    if (exerciseTotpEnrollment) {
      const begin = page.locator('[data-testid="mfa-begin-totp"]');
      if (await begin.count() !== 1) {
        throw new Error("TOTP enrollment exercise requires an account without an existing TOTP factor");
      }
      await begin.click();
      const qr = page.locator('[data-testid="mfa-totp-qr"] svg');
      await qr.waitFor({ state: "visible", timeout: 15000 });
      const qrContract = await qr.evaluate((element) => ({
        role: element.getAttribute("role"),
        viewBox: element.getAttribute("viewBox"),
        paths: element.querySelectorAll("path").length,
        title: element.querySelector("title") ? element.querySelector("title").textContent.trim() : "",
      }));
      if (qrContract.role !== "img" || !qrContract.viewBox || qrContract.paths < 1 || !qrContract.title) {
        throw new Error(`TOTP QR accessibility/rendering contract failed: ${JSON.stringify(qrContract)}`);
      }
      const secret = (await page.locator(".mfa-secret-value code").innerText()).trim();
      if (!/^[A-Z2-7]{16,}$/.test(secret)) {
        throw new Error("TOTP manual setup secret is missing or malformed");
      }
      await page.getByRole("button", { name: /Cancel|取消/ }).click();
      if (await page.locator('[data-testid="mfa-totp-qr"]').count()) {
        throw new Error("canceling TOTP enrollment did not clear the pending setup UI");
      }
    }

    if (exercisePasskeyEnrollment) {
      const begin = page.locator('[data-testid="mfa-begin-passkey"]');
      if (await begin.count() !== 1) {
        throw new Error("passkey enrollment exercise requires configured WebAuthn policy and a supported secure context");
      }
      const confirmation = page.waitForResponse(
        (resp) => resp.url().toLowerCase().includes("/mfaoperation") &&
          resp.request().method() === "POST" &&
          (resp.request().postData() || "").includes("confirmPasskeyEnrollment"),
        { timeout: 30000 }
      );
      await begin.click();
      const response = await confirmation;
      if (!response.ok()) {
        const body = await response.text().catch(() => "");
        throw new Error(`passkey confirmation failed status=${response.status()} body=${body.slice(0, 300)}`);
      }
      const recovery = page.locator('[data-testid="mfa-recovery-codes"]');
      await recovery.waitFor({ state: "visible", timeout: 15000 });
      if (await recovery.locator("code").count() < 1) {
        throw new Error("first passkey enrollment did not display one-time recovery codes");
      }
      await page.locator('[data-testid="mfa-factor-row"]').waitFor({
        state: "visible",
        timeout: 15000,
      });
      passkeyEnrollmentCompleted = true;
      console.log("passkey-enrollment-smoke-ok recoveryCodes=displayed factor=registered");

      if (expectPasskeyLimit) {
        await page.locator('[data-testid="mfa-recovery-codes-saved"]').click();
        const reauthenticationRequired = page.waitForResponse(
          (resp) => resp.url().toLowerCase().includes("/mfaoperation") &&
            resp.request().method() === "POST" &&
            (resp.request().postData() || "").includes("beginPasskeyEnrollment"),
          { timeout: 30000 }
        );
        await begin.click();
        const reauthenticationResponse = await reauthenticationRequired;
        const reauthenticationBody = await reauthenticationResponse.text().catch(() => "");
        if (reauthenticationResponse.status() !== 401 ||
            !reauthenticationBody.includes("MfaReauthenticationRequired")) {
          throw new Error(`second passkey enrollment did not require step-up authentication status=${reauthenticationResponse.status()} body=${reauthenticationBody.slice(0, 300)}`);
        }

        const rejected = page.waitForResponse(
          (resp) => resp.url().toLowerCase().includes("/mfaoperation") &&
            resp.request().method() === "POST" &&
            (resp.request().postData() || "").includes("beginPasskeyEnrollment"),
          { timeout: 30000 }
        );
        await completePasskeySecurityConfirmation(page);
        const limitResponse = await rejected;
        const limitBody = await limitResponse.text().catch(() => "");
        if (limitResponse.status() !== 409 || !limitBody.includes("PasskeyLimitReached")) {
          throw new Error(`passkey limit was not enforced status=${limitResponse.status()} body=${limitBody.slice(0, 300)}`);
        }
        console.log("passkey-limit-smoke-ok configured=1 stepUp=passed secondEnrollment=rejected");
      }
    }
  }

  if (/\/admin\/access\/mfa(?:[/?#]|$)/.test(route) && managedMfaAccountId) {
    const systemSettings = page.locator('[data-testid="mfa-system-settings"]');
    const accountManagement = page.locator('[data-testid="mfa-account-management"]');
    await systemSettings.waitFor({ state: "visible", timeout: 15000 });
    await accountManagement.waitFor({ state: "visible", timeout: 15000 });
    const systemBox = await systemSettings.boundingBox();
    const accountBox = await accountManagement.boundingBox();
    if (!systemBox || !accountBox || systemBox.y >= accountBox.y) {
      throw new Error("system-wide sign-in and SMTP settings are not visually separated before account management");
    }
    await page.locator('[data-testid="mfa-managed-account-warning"]').waitFor({
      state: "visible",
      timeout: 15000,
    });
    if (await page.locator('[data-testid="mfa-begin-totp"], [data-testid="mfa-begin-passkey"], [data-testid="mfa-recovery-management"]').count()) {
      throw new Error("administrator-managed account exposed account-holder enrollment or recovery controls");
    }

    const authorization = await page.evaluate(async ({ managedMfaAccountId }) => {
      const app = window.Ui;
      const store = app && app.__container__ && app.__container__.lookup("service:user-store");
      if (!store || typeof store.rawRequest !== "function") {
        throw new Error("service:user-store is unavailable");
      }
      try {
        await store.rawRequest({
          url: "mfaOperation",
          method: "POST",
          data: {
            accountId: managedMfaAccountId,
            operation: "beginTotpEnrollment",
          },
        });
        return { allowed: true };
      } catch (err) {
        const body = err && (err.body || err.responseJSON || err.errors);
        return {
          allowed: false,
          status: err && (err.status || err.statusCode),
          body: body || null,
          message: err && err.message,
        };
      }
    }, { managedMfaAccountId });
    const authorizationText = JSON.stringify(authorization);
    if (authorization.allowed || !/(403|MfaAccountHolderRequired)/.test(authorizationText)) {
      throw new Error(`administrator enrollment boundary failed: ${authorizationText}`);
    }
  }

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

async function assertPasskeyLogin(page) {
  if (!exercisePasskeyEnrollment) {
    return;
  }
  if (!passkeyEnrollmentCompleted) {
    throw new Error("passkey login exercise cannot start before successful enrollment");
  }

  await page.goto(`${base}/logout`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator('input[type="password"]').waitFor({ state: "visible", timeout: 30000 });

  await page.locator(".login-user").fill(username);
  await page.locator(".login-pass").fill(password);
  let challengeResponse;
  try {
    const challengePromise = page.waitForResponse(
      (resp) => resp.url().includes("/token") &&
        resp.request().method() === "POST" &&
        requestBodyField(resp.request(), "mfaMethod") === null,
      { timeout: 30000 }
    );
    const loginButton = page.locator(".login-user")
      .locator("xpath=ancestor::form[1]").locator(".btn-primary");
    await loginButton.evaluate((button) => button.click());
    challengeResponse = await challengePromise;
  } catch (error) {
    const state = await page.evaluate(() => {
      const app = window.Ui;
      const controller = app && app.__container__ &&
        app.__container__.lookup("controller:login/index");
      const usernameInput = document.querySelector(".login-user");
      const passwordInput = document.querySelector(".login-pass");
      const button = usernameInput && usernameInput.form &&
        usernameInput.form.querySelector(".btn-primary");
      return {
        url: window.location.href,
        usernameLength: usernameInput ? usernameInput.value.length : null,
        passwordLength: passwordInput ? passwordInput.value.length : null,
        buttonDisabled: button ? button.disabled : null,
        waiting: controller ? controller.get("waiting") : null,
        error: controller ? controller.get("errorMsg") : null,
        pending: controller ? controller.get("isMfaPending") : null,
      };
    });
    throw new Error(`passkey primary login did not issue a token request state=${JSON.stringify(state)} cause=${error.message}`);
  }
  const challengeBody = await challengeResponse.json().catch(() => ({}));
  if (challengeResponse.status() !== 201 || !challengeBody.mfaRequired ||
      !Array.isArray(challengeBody.mfaMethods) ||
      !challengeBody.mfaMethods.includes("webauthn")) {
    throw new Error(`passkey login challenge failed status=${challengeResponse.status()} body=${JSON.stringify(challengeBody).slice(0, 500)}`);
  }

  const passkeyButton = page.locator('[data-testid="mfa-login-passkey"]');
  await passkeyButton.waitFor({ state: "visible", timeout: 15000 });
  const completionPromise = page.waitForResponse(
    (resp) => resp.url().includes("/token") &&
      resp.request().method() === "POST" &&
      requestBodyField(resp.request(), "mfaMethod") === "webauthn",
    { timeout: 30000 }
  );
  await passkeyButton.evaluate((button) => button.click());
  const completion = await completionPromise;
  const completionBody = await completion.json().catch(() => ({}));
  if (completion.status() !== 201 || completionBody.mfaRequired) {
    throw new Error(`passkey login completion failed status=${completion.status()} body=${JSON.stringify(completionBody).slice(0, 500)}`);
  }
  await fetchProjectsStatus(page);
  console.log("passkey-login-smoke-ok challenge=webauthn credential=accepted");

  await page.goto(`${base}/account/security`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.locator('[data-testid="mfa-revoke-factor"]').waitFor({
    state: "visible",
    timeout: 15000,
  });
  const revoked = page.waitForResponse(
    (resp) => resp.url().toLowerCase().includes("/mfaoperation") &&
      resp.request().method() === "POST" &&
      (resp.request().postData() || "").includes("revokeFactor"),
    { timeout: 30000 }
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-testid="mfa-revoke-factor"]').click();
  const reauthenticationResponse = await revoked;
  const reauthenticationBody = await reauthenticationResponse.text().catch(() => "");
  if (reauthenticationResponse.status() !== 401 ||
      !reauthenticationBody.includes("MfaReauthenticationRequired")) {
    throw new Error(`passkey revocation did not require step-up authentication status=${reauthenticationResponse.status()} body=${reauthenticationBody.slice(0, 300)}`);
  }
  const revokedAfterConfirmation = page.waitForResponse(
    (resp) => resp.url().toLowerCase().includes("/mfaoperation") &&
      resp.request().method() === "POST" &&
      (resp.request().postData() || "").includes("revokeFactor"),
    { timeout: 30000 }
  );
  await completePasskeySecurityConfirmation(page);
  const revokeResponse = await revokedAfterConfirmation;
  if (!revokeResponse.ok()) {
    const body = await revokeResponse.text().catch(() => "");
    throw new Error(`passkey self-revocation failed status=${revokeResponse.status()} body=${body.slice(0, 300)}`);
  }
  await page.locator('[data-testid="mfa-reauthentication-required"]').waitFor({
    state: "visible",
    timeout: 15000,
  });
  console.log("passkey-revocation-smoke-ok factor=revoked session=reauthentication-required");
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
  const browser = await chromium.launch({
    headless: process.env.UI_SMOKE_HEADFUL !== "1",
    executablePath: process.env.CHROME_BIN || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let webAuthnSession = null;
  let virtualAuthenticatorId = null;
  if (exercisePasskeyEnrollment) {
    webAuthnSession = await page.context().newCDPSession(page);
    await webAuthnSession.send("WebAuthn.enable");
    const created = await webAuthnSession.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    virtualAuthenticatorId = created.authenticatorId;
  }
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
      await page.locator(".login-user").fill(username);
      await page.locator(".login-pass").fill(password);
      const submit = page.locator(".login-user").locator("xpath=ancestor::form[1]").locator(".btn-primary");
      if (await submit.count()) {
        await submit.click();
      } else {
        await page.keyboard.press("Enter");
      }
      await tokenPromise;
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

      const mfaCode = page.locator("#mfa-code");
      if (await mfaCode.isVisible({ timeout: 5000 }).catch(() => false)) {
        const verifyButton = mfaCode.locator("xpath=following-sibling::button[1]");
        if (await verifyButton.count() !== 1) {
          throw new Error("TOTP verification button is missing or ambiguous");
        }
        const verifyButtonHandle = await verifyButton.elementHandle();
        await page.waitForFunction((button) => Boolean(button && !button.disabled),
          verifyButtonHandle, { timeout: 10000 }).catch(async () => {
          const buttonMarkup = await verifyButton.evaluate((button) => button.outerHTML.slice(0, 500));
          const state = await page.evaluate(() => {
            const app = window.Ui;
            const controller = app && app.__container__ && app.__container__.lookup("controller:login/index");
            const challenge = controller && controller.get("mfaChallenge");
            return {
              waiting: controller ? controller.get("waiting") : null,
              pending: controller ? controller.get("isMfaPending") : null,
              methods: challenge && Array.isArray(challenge.mfaMethods) ? challenge.mfaMethods : [],
            };
          });
          throw new Error(`TOTP verification button remained disabled after the primary login challenge state=${JSON.stringify(state)} button=${buttonMarkup}`);
        });
        const completionPromise = page.waitForResponse(
          (resp) => resp.url().includes("/token") && resp.request().method() === "POST",
          { timeout: 30000 }
        );
        await mfaCode.fill(currentTotp(totpSecret));
        await verifyButton.evaluate((button) => button.click());
        let completion;
        try {
          completion = await completionPromise;
        } catch (err) {
          const state = await page.evaluate(() => {
            const input = document.querySelector("#mfa-code");
            const button = input && input.parentElement ? input.parentElement.querySelector("button.btn-primary") : null;
            const alert = document.querySelector(".alert-danger");
            return {
              inputLength: input ? input.value.length : 0,
              buttonDisabled: button ? button.disabled : null,
              alert: alert ? alert.textContent.trim().slice(0, 200) : "",
            };
          });
          throw new Error(`TOTP completion did not issue a token request state=${JSON.stringify(state)}`);
        }
        if (completion.status() !== 201) {
          const body = await completion.json().catch(() => ({}));
          throw new Error(`TOTP completion failed status=${completion.status()} code=${body.code || "unknown"}`);
        }
        await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      }
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
    await assertPasskeyLogin(page);

    await page.screenshot({ path: path.join(outDir, "ui-candidate-browser-smoke-final.png"), fullPage: true });
    const filteredFailures = failedRequests.filter((line) => !line.includes("favicon") && !line.includes("net::ERR_ABORTED"));
    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
    if (filteredFailures.length) throw new Error(`request failures: ${filteredFailures.join(" | ")}`);
    console.log(`ui-candidate-browser-smoke-ok routes=${routes.join(",")} wsUpgrades=${wsUpgradeCount}`);
  } finally {
    if (webAuthnSession && virtualAuthenticatorId) {
      await webAuthnSession.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId: virtualAuthenticatorId,
      }).catch(() => {});
    }
    if (webAuthnSession) {
      await webAuthnSession.send("WebAuthn.disable").catch(() => {});
      await webAuthnSession.detach().catch(() => {});
    }
    await browser.close().catch(() => {});
    server.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
