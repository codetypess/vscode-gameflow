import { RemotePackageBuildPlugin } from "./RemotePackageBuildPlugin";

@IEditorEnv.regBuildPlugin("bytedancegame")
export class BytedanceGameBuildPlugin extends RemotePackageBuildPlugin {
    onEnd(_task: IEditorEnv.IBuildTask): void {
        // TODO(xq-performance): 确认抖音运行要求后，在此写入 iOS 高性能模式和基础库版本。
        // TODO(xq-worker): 引入抖音 worker 子包后，在此生成 workers/index.js 并搬运脚本。
        // TODO(xq-sdk): 接入渠道 SDK 后，在此规范化 SDK 文件名与 game.js 引用。
        // TODO(xq-sourcemap): 明确发布包调试策略后，再决定是否在此删除 source map。
    }
}
