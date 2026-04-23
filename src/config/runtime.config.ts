export type DepName = "rtk" | "bun" | "ollama" | "mcp-local-agent";

export type { DepType, ToolkitItem, OptimizerItem, ProxyItem, McpItem, AgenticItem } from "@runtime/dependency.enum.js";

export interface RuntimeConfig {
  ollamaUrl: string;
  embeddingModel: string;
}
