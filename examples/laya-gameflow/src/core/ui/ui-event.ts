/** UI 控件与界面管理器共用的事件。 */
export enum UIEvent {
    DATA_SOURCE_CHANGED = "dataSourceChanged",
    /** 单次背景快照已生成并绘制；下一帧通知，可由业务隐藏背景。 */
    BACKDROP_READY = "backdropReady",
    OPEN = "ui.open",
    CLOSE = "ui.close",
    LOADING = "ui.loading",
    LOADED = "ui.loaded",
}
