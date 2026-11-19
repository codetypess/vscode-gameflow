"use strict";
function sizeLabel(bytes) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function text(tag, value, className) { const element = document.createElement(tag); element.textContent = value; if (className) element.className = className; return element; }
function download(release, label) {
  if (!/^releases\/[a-z0-9-]+\.[a-z0-9-]+\/[0-9A-Za-z.+-]+\/universal\.vsix$/.test(release.path)) throw new Error("版本目录路径无效");
  const link = text("a", label); link.href = "/" + release.path; link.setAttribute("download", ""); return link;
}
async function load() {
  const response = await fetch("/catalog.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`版本目录暂时不可用 (${response.status})`);
  const envelope = await response.json();
  const data = JSON.parse(envelope.payload);
  if (data.schemaVersion !== 1) throw new Error("版本目录格式不支持");
  document.getElementById("revision").textContent = `更新于 ${new Date(data.generatedAt).toLocaleString("zh-CN")} · #${data.revision}`;
  for (const [id, entry] of Object.entries(data.extensions)) {
    if (entry.hidden) continue;
    const latest = entry.releases.find((release) => release.version === entry.channels.stable);
    if (!latest) continue;
    if (id === "codetypes.internal-updater") {
      const button = document.getElementById("updater");
      button.href = download(latest, "").href; button.textContent = `下载统一更新器 v${latest.version}`; button.removeAttribute("aria-disabled"); button.setAttribute("download", "");
    }
    const card = text("article", "", "card");
    card.append(text("h3", entry.displayName), text("div", id, "id"), text("p", `v${latest.version} · ${sizeLabel(latest.size)} · VS Code ${latest.engines.vscode}`, "version"), download(latest, "下载 VSIX ↗"));
    if (entry.releases.length > 1) {
      const details = text("details", ""); details.append(text("summary", "历史版本")); const list = text("ul", "");
      for (const release of [...entry.releases].reverse()) { const item = text("li", ""); item.append(download(release, `v${release.version}`)); list.append(item); }
      details.append(list); card.append(details);
    }
    document.getElementById("catalog").append(card);
  }
}
load().catch((error) => { const target = document.getElementById("error"); target.hidden = false; target.textContent = `${error.message}。请稍后刷新，或联系内部插件维护者。`; });