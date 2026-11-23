import { RemotePackageBuildPlugin } from "./RemotePackageBuildPlugin";

@IEditorEnv.regBuildPlugin("alipaygame")
export class AlipayGameBuildPlugin extends RemotePackageBuildPlugin {
    onEnd(_task: IEditorEnv.IBuildTask): void {
        // TODO(xq-performance): 确认支付宝运行要求后，在此写入 iOS 高性能模式配置。
        // TODO(xq-worker): 引入支付宝 worker 子包后，在此搬运并改写 worker 入口。
        // TODO(xq-sdk): 接入渠道 SDK 后，在此规范化 SDK 文件名与 game.js 引用。
    }
}
