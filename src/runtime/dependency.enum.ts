export enum DepType {
  toolkit = 0,
  optimizer = 1,
  proxy = 2,
  mcp = 3,
  agentic = 4,
}

export enum ToolkitItem {
  TOOLKIT_BUN = 0,
}

export enum OptimizerItem {
  ALGO_RTK = 0,
}

export enum ProxyItem {
  PROXY_OLLAMA = 0,
}

export enum McpItem {
  MCP_LOCAL_AGENT = 0,
  MCP_LOCAL_RAG = 1,
  MCP_LUMEN = 2,
}

export enum AgenticItem {
  AGENTIC_OPENCODE = 0,
}

export type PrefKey = "ollamaUrl" | "embeddingModel";

export interface DepOption<T extends number> {
  id: T;
  name: string;
  description: string;
  type: DepType;
  prefs?: PrefKey[];
}

export const TOOLKIT_OPTIONS: DepOption<ToolkitItem>[] = [
  {
    id: ToolkitItem.TOOLKIT_BUN,
    name: "bun",
    description: "Bun JS runtime",
    type: DepType.toolkit,
  },
];

export const OPTIMIZER_OPTIONS: DepOption<OptimizerItem>[] = [
  {
    id: OptimizerItem.ALGO_RTK,
    name: "RAG",
    description: "RTK Token optimizer",
    type: DepType.optimizer,
  },
];

export const PROXY_OPTIONS: DepOption<ProxyItem>[] = [
  {
    id: ProxyItem.PROXY_OLLAMA,
    name: "ollama",
    description: "Ollama local LLM",
    type: DepType.proxy,
    prefs: ["ollamaUrl"],
  },
];

export const MCP_OPTIONS: DepOption<McpItem>[] = [
  {
    id: McpItem.MCP_LOCAL_AGENT,
    name: "localMcp",
    description: "Local MCP",
    type: DepType.mcp,
  },
  {
    id: McpItem.MCP_LOCAL_RAG,
    name: "localRag",
    description: "Local RAG",
    type: DepType.mcp,
    prefs: ["embeddingModel"],
  },
  {
    id: McpItem.MCP_LUMEN,
    name: "lumen",
    description: "Lumen semantic search",
    type: DepType.mcp,
    prefs: ["embeddingModel"],
  },
];

export const AGENTIC_OPTIONS: DepOption<AgenticItem>[] = [
  {
    id: AgenticItem.AGENTIC_OPENCODE,
    name: "opencode",
    description: "OpenCode agent",
    type: DepType.agentic,
  },
];

export function getMcpItem(name: string): McpItem | undefined {
  return MCP_OPTIONS.find((o) => o.name === name)?.id;
}

export function getOptimizerItem(name: string): OptimizerItem | undefined {
  return OPTIMIZER_OPTIONS.find((o) => o.name === name)?.id;
}

export function getAgenticItem(name: string): AgenticItem | undefined {
  return AGENTIC_OPTIONS.find((o) => o.name === name)?.id;
}
