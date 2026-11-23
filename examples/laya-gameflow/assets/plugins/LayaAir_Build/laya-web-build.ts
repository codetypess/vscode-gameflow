import { BuildPlugin } from "./BuildPlugin";

@IEditorEnv.regBuildPlugin("web")
export class WebBuildPlugin extends BuildPlugin {
    onSetup(task: IEditorEnv.IBuildTask): void {
        task.logger.log("初始化 Web 构建插件");
    }

    onCreateManifest(task: IEditorEnv.IBuildTask): void {
        this.moveArchives(task.destPath, task.destPath);
    }

    onEnd(_task: IEditorEnv.IBuildTask): void {
        // TODO(xq-subpackage): Web 远程子包契约确定后，在此同步对应脚本目录。
    }
}
