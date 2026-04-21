export type DepName = "rtk" | "bun" | "ollama" | "mcp-local-agent";

export interface RuntimeConfig {
  ollamaUrl: string;
  embeddingModel: string;
  deps: DepName[];
}
