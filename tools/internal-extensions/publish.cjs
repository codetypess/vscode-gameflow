"use strict";
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { assert, readVsix } = require("./lib.cjs");
function option(name, fallback) { const index = process.argv.indexOf(`--${name}`); return index < 0 ? fallback : process.argv[index + 1]; }
function run(binary, args) { const result = cp.spawnSync(binary, args, { stdio: "inherit", windowsHide: true }); if (result.error) throw result.error; assert(result.status === 0, `${path.basename(binary)} exited ${result.status}`); }
async function main() {
  const file = path.resolve(option("file", ""));
  assert(fs.statSync(file).isFile(), "--file must point to a VSIX package");
  const metadata = await readVsix(file);
  const host = option("host", "bit@macmini.bitserver.wang");
  const root = option("root", "/Users/bit/services/vscode-extensions");
  const channel = option("channel", "stable");
  const replaceId = option("replace-id");
  assert(/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(host), "Invalid SSH host");
  assert(/^\/[A-Za-z0-9/_-]+$/.test(root), "Invalid remote root");
  assert(["stable", "beta"].includes(channel), "Invalid channel");
  assert(replaceId === undefined || require("./lib.cjs").ID_PATTERN.test(replaceId) && replaceId !== metadata.id && replaceId.split(".")[1] === metadata.manifest.name && channel === "stable", "Invalid publisher replacement");
  const ssh = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32/OpenSSH/ssh.exe") : "ssh";
  const scp = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32/OpenSSH/scp.exe") : "scp";
  const upload = `${root}/staging/${crypto.randomUUID()}.vsix`;
  const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
  run(ssh, [...args, host, `test -f ${root}/tools/publisher.cjs && mkdir -p ${root}/staging`]);
  run(scp, [...args, file, `${host}:${upload}`]);
  try {
    run(ssh, [...args, host, `/opt/homebrew/bin/node ${root}/tools/publisher.cjs publish --root ${root} --file ${upload} --channel ${channel}${process.argv.includes("--hidden") ? " --hidden" : ""}${replaceId ? ` --replace-id ${replaceId}` : ""}`]);
  } finally { run(ssh, [...args, host, `/bin/rm -f ${upload}`]); }
  console.log(`Published ${metadata.id}@${metadata.manifest.version}`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
