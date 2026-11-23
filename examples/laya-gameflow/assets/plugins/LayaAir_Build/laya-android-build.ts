import { BuildPlugin } from "./BuildPlugin";

@IEditorEnv.regBuildPlugin("android")
export class AndroidBuildPlugin extends BuildPlugin {
    onSetup(task: IEditorEnv.IBuildTask): void {
        task.logger.log("初始化 Android 构建插件");
        // TODO(xq-native): 原生模板、DCC 版本或签名流程确定后，在此校验并修改本次任务配置。
    }
}
