interface VsCodeApi<State = unknown> {
  postMessage(message: unknown): void;
  getState(): State | undefined;
  setState(newState: State): State;
}

declare function acquireVsCodeApi<State = unknown>(): VsCodeApi<State>;
