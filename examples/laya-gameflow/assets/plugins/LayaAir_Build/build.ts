import * as fs from "fs";
import * as path from "path";
import { normalizeBuildPlatform } from "./build-logic";

@IEditorEnv.regClass()
class Build {
    static async start(platform: string): Promise<IEditorEnv.BuildTaskStatus> {
        const targetPlatform = normalizeBuildPlatform(platform);
        const releasePath = path.join(EditorEnv.projectPath, "release");
        const successMarker = path.join(releasePath, "BUILD_SUCCESS");

        fs.mkdirSync(releasePath, { recursive: true });
        fs.rmSync(successMarker, { force: true });

        const zipMarker = path.join(releasePath, "SUPPORT_ZIP");
        if (["wxgame", "ttgame", "bytedancegame", "androidgame", "iosgame"].includes(platform)) {
            fs.writeFileSync(zipMarker, "", "utf8");
        } else if (platform === "web") {
            fs.rmSync(zipMarker, { force: true });
        }

        const status = await IEditorEnv.BuildTask.start(targetPlatform).waitForCompletion();
        if (status !== IEditorEnv.BuildTaskStatus.Success) {
            throw new Error(`LayaAir 构建失败: ${targetPlatform} (status=${status})`);
        }

        fs.writeFileSync(successMarker, "", "utf8");
        return status;
    }
}
