export interface WssConfig {
  targetDir: string;
  handlerDir: string;
  wssConfigDir: string;
  wssOpencodeConfigDir: string;
  wssBinDir: string;
  rtkBin: string | null;
  ollamaUrl: string;
  embeddingModel: string;
  noRtk: boolean;
  noRag: boolean;
  noOllama: boolean;
  opencodeManagesMcp: boolean;
  deps: ("rtk" | "bun" | "ollama" | "mcp-local-agent")[];
}

export interface ProcessHandle {
  pid: number;
  proc: unknown;
  startedAt: number;
}

export interface Session {
  id: string;
  createdAt: number;
  messages: SessionMessage[];
}

export interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export type ComponentStatus = "stopped" | "starting" | "running" | "error";

export interface ComponentState {
  mcp: ComponentStatus;
  rtk: ComponentStatus;
  opencode: ComponentStatus;
}

export interface RagQueryResult {
  chunks: string[];
  sources: string[];
}

export interface RagIngestResult {
  fileCount: number;
  chunkCount: number;
}
