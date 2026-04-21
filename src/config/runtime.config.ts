export type DepName = "rtk" | "bun" | "ollama" | "mcp-local-agent";

export type { RuntimeItem, DependencyType } from "@runtime/bridge.service.js";

export interface RuntimeConfig {
  ollamaUrl: string;
  embeddingModel: string;
  items: string[];
}
