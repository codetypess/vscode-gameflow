const esbuild = require("esbuild");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
async function main() {
  const root = path.resolve(__dirname, "..");
  const code = process.env.GAMEFLOW_VSCODE_PATH || path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "Code.exe");
  if (!fs.existsSync(code)) throw new Error("Set GAMEFLOW_VSCODE_PATH to an installed VS Code executable.");
  const output = path.join(root, "dist", "extension-psd-smoke.cjs"), report = path.join(root, "dist", "psd-native-report.json");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-psd-profile-"));
  fs.mkdirSync(path.join(profile, "User"), { recursive: true });
  fs.writeFileSync(path.join(profile, "User", "settings.json"), JSON.stringify({ "files.autoSave": "off", "workbench.startupEditor": "none" }));
  await esbuild.build({ entryPoints: [path.join(__dirname, "extension-psd-smoke.ts")], outfile: output, bundle: true, platform: "node", format: "cjs", external: ["vscode"], target: "node20" });
  if (fs.existsSync(report)) fs.unlinkSync(report);
  const interactive = process.env.GAMEFLOW_PSD_CLOSE_UI === "1";
  const child = spawn(code, ["--new-window", "--disable-extensions", "--skip-welcome", "--skip-release-notes", "--user-data-dir", profile, "--extensionDevelopmentPath", root, "--extensionTestsPath", output], { windowsHide: !interactive, stdio: "ignore", env: { ...process.env, GAMEFLOW_PSD_TEST_ROOT: root, GAMEFLOW_PSD_TEST_REPORT: report } });
  const timeout = setTimeout(() => { child.kill(); }, interactive ? 300000 : 120000);
  await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }); clearTimeout(timeout);
  if (!fs.existsSync(report)) throw new Error(`VS Code did not produce a report. Test profile: ${profile}`);
  const result = JSON.parse(fs.readFileSync(report, "utf8"));
  if (!result.ok) throw new Error(result.stack || result.error);
  console.log(`PASS native PSD: ${result.checks.join(", ")}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
