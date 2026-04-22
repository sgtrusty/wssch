import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import { createMcpLocalAgentDependency } from "./dependency/mcp/localAgent.js";
import { createRtkDependency } from "./dependency/optimizer/rtk.js";
import { createOllamaProxyDependency } from "./dependency/proxy/ollamaProxy.js";
import { createBunDependency } from "./dependency/toolkit/bun.js";
import { createOpencodeComponent } from "./dependency/agentic/opencode.js";
import {
  DepType,
  ToolkitItem,
  OptimizerItem,
  ProxyItem,
  McpItem,
  AgenticItem,
  getMcpItem,
  getOptimizerItem,
  getAgenticItem,
} from "@runtime/dependency.enum.js";
import { createLocalRagClient } from "./dependency/mcp/localRag.js";

const TOOLKIT_DEPS: Record<ToolkitItem, () => Dependency> = {
  [ToolkitItem.TOOLKIT_BUN]: createBunDependency,
};

const OPTIMIZER_DEPS: Record<OptimizerItem, () => Dependency> = {
  [OptimizerItem.ALGO_RTK]: createRtkDependency,
};

const PROXY_DEPS: Record<ProxyItem, () => Dependency> = {
  [ProxyItem.PROXY_OLLAMA]: createOllamaProxyDependency,
};

const MCP_DEPS: Record<McpItem, () => Dependency> = {
  [McpItem.MCP_LOCAL_AGENT]: createMcpLocalAgentDependency,
  [McpItem.MCP_LOCAL_RAG]: createLocalRagClient,
};

const AGENTIC_DEPS: Record<AgenticItem, () => Dependency> = {
  [AgenticItem.AGENTIC_OPENCODE]: createOpencodeComponent,
};

export class BridgeService {
  getDepsFromConfig(): Dependency[] {
    return [];
  }

  async getDepsFromPreferences(): Promise<Dependency[]> {
    const { getPreferences } = await import("@db/pref.service.js");
    const prefs = await getPreferences();
    const deps: Dependency[] = [];

    deps.push(TOOLKIT_DEPS[ToolkitItem.TOOLKIT_BUN]());

    for (const algo of prefs.tokenOptimizatorAlgo) {
      const item = getOptimizerItem(algo);
      if (item !== undefined && OPTIMIZER_DEPS[item]) {
        deps.push(OPTIMIZER_DEPS[item]());
      }
    }

    const mcp = getMcpItem(prefs.preferredMcpServer);
    if (mcp !== undefined && MCP_DEPS[mcp]) {
      const mcpDep = MCP_DEPS[mcp]();
      if (
        "initFromPrefs" in mcpDep &&
        typeof mcpDep.initFromPrefs === "function"
      ) {
        await (
          mcpDep as { initFromPrefs: () => Promise<void> }
        ).initFromPrefs();
      }
      deps.push(mcpDep);
    }

    const agentic = getAgenticItem(prefs.agentic);
    if (agentic !== undefined && AGENTIC_DEPS[agentic]) {
      deps.push(AGENTIC_DEPS[agentic]());
    }

    return deps;
  }
}

export const bridgeService = new BridgeService();

