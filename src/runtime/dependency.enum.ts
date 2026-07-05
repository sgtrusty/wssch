export enum DepType {
  toolkit = 0,
  optimizer = 1,
  proxy = 2,
  mcp = 3,
  harness = 4,
  harnessPlugin = 5,
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

export enum HarnessItem {
  HARNESS_OPENCODE = 0,
  HARNESS_FORGECODE = 1,
  HARNESS_QWENCODE = 2,
  HARNESS_KILOCODE = 3,
  HARNESS_GOOSE = 4,
  HARNESS_CRUSH = 5,
}

export enum HarnessPluginItem {
  PLUGIN_OMNIROUTE_AUTH = 0,
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
  },
  {
    id: McpItem.MCP_LUMEN,
    name: "lumen",
    description: "Lumen semantic search",
    type: DepType.mcp,
  },
];

export const HARNESS_OPTIONS: DepOption<HarnessItem>[] = [
  {
    id: HarnessItem.HARNESS_OPENCODE,
    name: "opencode",
    description: "OpenCode agent",
    type: DepType.harness,
  },
  {
    id: HarnessItem.HARNESS_FORGECODE,
    name: "forgecode",
    description: "ForgeCode agent",
    type: DepType.harness,
  },
  {
    id: HarnessItem.HARNESS_QWENCODE,
    name: "qwencode",
    description: "Qwencode agent",
    type: DepType.harness,
  },
  {
    id: HarnessItem.HARNESS_KILOCODE,
    name: "kilocode",
    description: "Kilo Code agent",
    type: DepType.harness,
  },
  {
    id: HarnessItem.HARNESS_GOOSE,
    name: "goose",
    description: "Goose agent",
    type: DepType.harness,
  },
  {
    id: HarnessItem.HARNESS_CRUSH,
    name: "crush",
    description: "Crush agent",
    type: DepType.harness,
  },
];

export const HARNESS_PLUGIN_OPTIONS: DepOption<HarnessPluginItem>[] = [
  {
    id: HarnessPluginItem.PLUGIN_OMNIROUTE_AUTH,
    name: "omniroute-auth",
    description: "OmniRoute authentication plugin for OpenCode",
    type: DepType.harnessPlugin,
  },
];

export interface HarnessPathConfig {
  configDir: string;
  cacheDir: string;
}

export const HARNESS_PATHS: Record<string, HarnessPathConfig> = {
  opencode: { configDir: ".config/opencode", cacheDir: ".local/share/opencode" },
  forgecode: { configDir: ".forge", cacheDir: ".forge/cache" },
  qwencode: { configDir: ".config/qwen", cacheDir: ".local/share/qwen" },
  kilocode: { configDir: ".config/kilocode", cacheDir: ".local/share/kilocode" },
  goose: { configDir: ".config/goose", cacheDir: ".local/share/goose" },
  crush: { configDir: ".config/crush", cacheDir: ".local/share/crush" },
};

export const HARNESS_BINARIES: Record<string, string> = {
  opencode: "opencode",
  forgecode: "forge",
  qwencode: "qwen-code",
  kilocode: "kilo",
  goose: "goose",
  crush: "crush",
};

export function getMcpItem(name: string): McpItem | undefined {
  return MCP_OPTIONS.find((o) => o.name === name)?.id;
}

export function getOptimizerItem(name: string): OptimizerItem | undefined {
  return OPTIMIZER_OPTIONS.find((o) => o.name === name)?.id;
}

export function getHarnessItem(name: string): HarnessItem | undefined {
  return HARNESS_OPTIONS.find((o) => o.name === name)?.id;
}

export function getHarnessPluginItem(
  name: string,
): HarnessPluginItem | undefined {
  return HARNESS_PLUGIN_OPTIONS.find((o) => o.name === name)?.id;
}
