import * as path from "path";
import { BuildPlugin } from "./BuildPlugin";

export abstract class RemotePackageBuildPlugin extends BuildPlugin {
    protected override useSafeFileExtensions(): boolean {
        return true;
    }

    onCreateManifest(task: IEditorEnv.IBuildTask): void {
        this.moveArchives(task.destPath, path.join(task.remotePkgPath, "main"));
    }
}
