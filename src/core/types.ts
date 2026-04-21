export interface ProcessHandle {
  pid: number;
  proc: unknown;
  startedAt: number;
}

export type ComponentStatus = "stopped" | "starting" | "running" | "error";

export interface ComponentState {
  mcp: ComponentStatus;
  rtk: ComponentStatus;
  opencode: ComponentStatus;
}
