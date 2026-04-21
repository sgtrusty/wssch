export type DepName = "rtk" | "bun" | "ollama" | "mcp-local-agent";

export type ComponentName = "rtk" | "mcp" | "opencode";

export interface RuntimeConfig {
  ollamaUrl: string;
  embeddingModel: string;
  deps: DepName[];
  components: ComponentName[];
}
