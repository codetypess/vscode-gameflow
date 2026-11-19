"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const https = require("node:https");
const semver = require("semver");
const yauzl = require("yauzl");

const MAX_VSIX = 256 * 1024 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;
function assert(condition, message) { if (!condition) throw new Error(message); }
function sameExtensionRoot(first, second, platform = process.platform) {
  const api = platform === "win32" ? path.win32 : path.posix;
  const left = api.dirname(api.resolve(first));
  const right = api.dirname(api.resolve(second));
  return platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function releasePath(id, version) { return `releases/${id}/${version}/universal.vsix`; }

function validateCatalog(catalog) {
  assert(catalog && catalog.schemaVersion === 1, "Unsupported catalog schema");
  assert(Number.isSafeInteger(catalog.revision) && catalog.revision >= 1, "Invalid catalog revision");
  assert(typeof catalog.generatedAt === "string" && Number.isFinite(Date.parse(catalog.generatedAt)), "Invalid catalog timestamp");
  assert(catalog.extensions && typeof catalog.extensions === "object" && !Array.isArray(catalog.extensions), "Invalid extension catalog");
  assert(Object.keys(catalog.extensions).length <= 256, "Too many catalog extensions");
  for (const [id, entry] of Object.entries(catalog.extensions)) {
    assert(ID_PATTERN.test(id), `Invalid extension ID: ${id}`);
    assert(entry && typeof entry.displayName === "string" && entry.displayName.length <= 160, `Invalid name: ${id}`);
    assert(Array.isArray(entry.releases) && entry.releases.length <= 2048, `Invalid releases: ${id}`);
    const versions = new Set();
    for (const release of entry.releases) {
      assert(release && typeof release.version === "string" && semver.valid(release.version) === release.version, `Invalid version: ${id}`);
      assert(!versions.has(release.version), `Duplicate release: ${id}`);
      versions.add(release.version);
      assert(release.targetPlatform === "universal", "Only universal VSIX packages are supported");
      assert(release.path === releasePath(id, release.version), `Unsafe release path: ${id}`);
      assert(typeof release.sha256 === "string" && /^[a-f0-9]{64}$/.test(release.sha256), `Invalid digest: ${id}`);
      assert(Number.isSafeInteger(release.size) && release.size > 0 && release.size <= MAX_VSIX, `Invalid package size: ${id}`);
      assert(typeof release.engines?.vscode === "string" && semver.validRange(release.engines.vscode), `Invalid VS Code engine: ${id}`);
    }
    assert(entry.channels && typeof entry.channels === "object", `Missing channels: ${id}`);
    for (const [channel, version] of Object.entries(entry.channels)) {
      assert(channel === "stable" || channel === "beta", "Unsupported release channel");
      assert(versions.has(version), `Channel points to missing release: ${id}`);
      if (channel === "stable") assert(!semver.prerelease(version), "Stable cannot contain prereleases");
    }
  }
  return catalog;
}

function signCatalog(catalog, privateKey) {
  const payload = JSON.stringify(validateCatalog(catalog));
  const signature = crypto.sign(null, Buffer.from(payload), privateKey).toString("base64");
  return JSON.stringify({ payload, signature }) + "\n";
}
function verifyCatalog(bytes, publicKey, minimumRevision = 0) {
  assert(bytes.length <= 2 * 1024 * 1024, "Catalog exceeds size limit");
  const envelope = JSON.parse(bytes.toString("utf8"));
  assert(typeof envelope.payload === "string" && typeof envelope.signature === "string", "Unsigned catalog");
  const signature = Buffer.from(envelope.signature, "base64");
  assert(signature.length === 64 && crypto.verify(null, Buffer.from(envelope.payload), publicKey, signature), "Catalog signature verification failed");
  const catalog = validateCatalog(JSON.parse(envelope.payload));
  assert(catalog.revision >= minimumRevision, "Catalog rollback/replay rejected");
  return catalog;
}

function readVsix(file) {
  return new Promise((resolve, reject) => {
    const size = fs.statSync(file).size;
    if (size <= 0 || size > MAX_VSIX) { reject(new Error("VSIX exceeds size limit")); return; }
    yauzl.open(file, { lazyEntries: true, autoClose: true }, (error, zip) => {
      if (error) { reject(error); return; }
      const parts = new Map();
      let done = false;
      function fail(problem) { if (!done) { done = true; zip.close(); reject(problem); } }
      zip.on("error", fail);
      zip.on("entry", (entry) => {
        if (!["extension/package.json", "extension.vsixmanifest"].includes(entry.fileName)) { zip.readEntry(); return; }
        if (parts.has(entry.fileName) || entry.uncompressedSize > 1024 * 1024) { fail(new Error("Invalid or duplicate VSIX metadata")); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) { fail(streamError); return; }
          const chunks = [];
          let length = 0;
          stream.on("data", (chunk) => { length += chunk.length; if (length > 1024 * 1024) { stream.destroy(new Error("VSIX metadata too large")); return; } chunks.push(chunk); });
          stream.on("error", fail);
          stream.on("end", () => { if (!done) { parts.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); } });
        });
      });
      zip.on("end", () => {
        if (done) return;
        try {
          assert(parts.has("extension/package.json") && parts.has("extension.vsixmanifest"), "Missing VSIX metadata");
          const manifest = JSON.parse(parts.get("extension/package.json").toString("utf8"));
          const id = `${manifest.publisher}.${manifest.name}`;
          assert(ID_PATTERN.test(id), "Invalid VSIX publisher/name");
          assert(semver.valid(manifest.version) === manifest.version, "Invalid VSIX version");
          assert(typeof manifest.engines?.vscode === "string" && semver.validRange(manifest.engines.vscode), "Missing VS Code engine");
          const xml = parts.get("extension.vsixmanifest").toString("utf8");
          const identity = xml.match(/<Identity\b[^>]*>/);
          assert(identity, "Missing VSIX identity");
          function attribute(name) { return identity[0].match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]; }
          assert(attribute("Id") === manifest.name && attribute("Publisher") === manifest.publisher && attribute("Version") === manifest.version, "VSIX identity mismatch");
          assert(!attribute("TargetPlatform") || attribute("TargetPlatform") === "universal", "Only universal packages are supported");
          assert(!manifest.extensionDependencies?.length && !manifest.extensionPack?.length, "Dependency/extension packs are not supported in v1");
          done = true;
          resolve({ id, manifest, size, sha256: sha256(fs.readFileSync(file)), targetPlatform: "universal" });
        } catch (problem) { fail(problem); }
      });
      zip.readEntry();
    });
  });
}

function selectRelease(entry, vscodeVersion, installedVersion, pin) {
  if (!entry) return undefined;
  if (pin) return entry.releases.find((release) => release.version === pin && semver.satisfies(vscodeVersion, release.engines.vscode));
  const stable = entry.channels.stable;
  if (!stable) return undefined;
  return [...entry.releases].filter((release) => !semver.prerelease(release.version)
    && semver.lte(release.version, stable)
    && semver.satisfies(vscodeVersion, release.engines.vscode)
    && (!installedVersion || (semver.valid(installedVersion) && semver.gt(release.version, installedVersion))))
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];
}
function sourceUrl(value) {
  const url = new URL(value);
  assert(["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, "Invalid update source URL");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
function resolveReleaseUrl(base, relative) {
  const match = typeof relative === "string" && relative.match(/^releases\/[a-z0-9-]+\.[a-z0-9-]+\/([0-9A-Za-z.+-]+)\/universal\.vsix$/);
  assert(match && semver.valid(match[1]) === match[1], "Unsafe package path");
  const source = sourceUrl(base);
  const target = new URL(relative, source);
  assert(target.origin === source.origin && target.pathname.startsWith(source.pathname), "Cross-origin package URL rejected");
  return target;
}
function requestBuffer(value, maxBytes, timeoutMs) {
  const url = new URL(value);
  assert(["http:", "https:"].includes(url.protocol), "Unsupported URL");
  return new Promise((resolve, reject) => {
    let timer;
    const request = (url.protocol === "https:" ? https : http).get(url, { headers: { "User-Agent": "Bit-Internal-Updater/0.1", "Cache-Control": "no-cache" } }, (response) => {
      if (response.statusCode !== 200) { response.resume(); request.destroy(new Error(`HTTP ${response.statusCode}; redirects are not followed`)); return; }
      const chunks = []; let length = 0;
      if (Number(response.headers["content-length"]) > maxBytes) { request.destroy(new Error("Download exceeds size limit")); return; }
      response.on("data", (chunk) => { length += chunk.length; if (length > maxBytes) { request.destroy(new Error("Download exceeds size limit")); return; } chunks.push(chunk); });
      response.on("error", reject);
      response.on("end", () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    });
    timer = setTimeout(() => request.destroy(new Error("Download timed out")), timeoutMs);
    request.on("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

module.exports = { MAX_VSIX, ID_PATTERN, assert, sameExtensionRoot, sha256, releasePath, validateCatalog, signCatalog, verifyCatalog, readVsix, selectRelease, sourceUrl, resolveReleaseUrl, requestBuffer };