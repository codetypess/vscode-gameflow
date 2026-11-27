import { version as buildVersion } from "../../package.json";

export function WorkbenchVersion() {
  const version = document.querySelector<HTMLMetaElement>('meta[name="gameflow-extension-version"]')?.content || buildVersion;
  return <span className="workbench-version" title={`当前插件版本 ${version}`} aria-label={`插件版本 ${version}`}>v{version}</span>;
}
