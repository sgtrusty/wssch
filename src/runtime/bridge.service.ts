import { configService } from "@config/index.js";
import { Dependency } from "./dependency/dependency.interface.js";
import { createMcpLocalAgentDependency } from "./dependency/mcp/localAgent.js";
import { createRtkDependency } from "./dependency/optimizer/rtk.js";
import { createOllamaProxyDependency } from "./dependency/proxy/ollamaProxy.js";
import { createBunDependency } from "./dependency/toolkit/bun.js";
import { createOpencodeComponent } from "./dependency/agentic/opencode.js";

export enum DependencyType {
  toolkit = "toolkit",
  proxy = "proxy",
  mcp = "mcp",
  agentic = "agentic",
}

export enum RuntimeItem {
  ALGO_RTK = "ALGO_RTK",
  TOOLKIT_BUN = "TOOLKIT_BUN",
  PROXY_OLLAMA = "PROXY_OLLAMA",
  MCP_LOCAL_AGENT = "MCP_LOCAL_AGENT",
  AGENTIC_OPENCODE = "AGENTIC_OPENCODE",
}

interface RuntimeItemConfig {
  type: DependencyType;
  creator: () => Dependency;
}

const RUNTIME_ITEMS: Record<RuntimeItem, RuntimeItemConfig> = {
  [RuntimeItem.ALGO_RTK]: {
    type: DependencyType.toolkit,
    creator: createRtkDependency,
  },
  [RuntimeItem.TOOLKIT_BUN]: {
    type: DependencyType.toolkit,
    creator: createBunDependency,
  },
  [RuntimeItem.PROXY_OLLAMA]: {
    type: DependencyType.proxy,
    creator: createOllamaProxyDependency,
  },
  [RuntimeItem.MCP_LOCAL_AGENT]: {
    type: DependencyType.mcp,
    creator: createMcpLocalAgentDependency,
  },
  [RuntimeItem.AGENTIC_OPENCODE]: {
    type: DependencyType.agentic,
    creator: createOpencodeComponent,
  },
};

export class BridgeService {
  createDep(item: RuntimeItem): Dependency {
    return RUNTIME_ITEMS[item].creator();
  }

  getDeps(): Dependency[] {
    const runtime = configService.runtime;
    return runtime.items.map((item) => this.createDep(item as RuntimeItem));
  }
}

export const bridgeService = new BridgeService();
