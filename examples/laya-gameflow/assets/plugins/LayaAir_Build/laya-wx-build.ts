import { RemotePackageBuildPlugin } from "./RemotePackageBuildPlugin";

@IEditorEnv.regBuildPlugin("wxgame")
export class WechatGameBuildPlugin extends RemotePackageBuildPlugin {
    onEnd(_task: IEditorEnv.IBuildTask): void {
        // TODO(xq-performance): 确认微信运行要求后，在此写入 iOS 高性能模式和基础库版本。
        // TODO(xq-worker): 引入微信 worker 子包后，在此搬运并改写 worker 入口。
        // TODO(xq-sdk): 接入渠道 SDK 后，在此规范化 SDK 文件名与 game.js 引用。
        // TODO(xq-fortify): 确定代码加固工具和清单契约后，在此追加需保护的产物。
    }
}
