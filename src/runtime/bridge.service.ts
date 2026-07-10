import type { Dependency } from "@runtime/runtime.interface.js";
import { createMcpLocalAgentDependency } from "./dependency/mcp/localAgent.js";
import { createRtkDependency } from "./dependency/optimizer/rtk.js";
import { createOllamaProxyDependency } from "./dependency/proxy/ollamaProxy.js";
import { createBunDependency } from "./dependency/toolkit/bun.js";
import { createOpencodeComponent } from "./dependency/harness/opencode.js";
import { createForgecodeDependency } from "./dependency/harness/forgecode.js";
import { createQwencodeDependency } from "./dependency/harness/qwencode.js";
import { createKilocodeDependency } from "./dependency/harness/kilocode.js";
import { createGooseDependency } from "./dependency/harness/goose.js";
import { createCrushDependency } from "./dependency/harness/crush.js";
import { createOmniRouteAuthPlugin } from "./dependency/harness-plugin/omniRouteAuth.js";
import {
  DepType,
  ToolkitItem,
  OptimizerItem,
  ProxyItem,
  McpItem,
  HarnessItem,
  HarnessPluginItem,
  getMcpItem,
  getOptimizerItem,
  getHarnessItem,
  getHarnessPluginItem,
} from "@runtime/dependency.enum.js";
import { createLocalRagClient } from "./dependency/mcp/localRag.js";
import { createLumenMcpDependency } from "./dependency/mcp/lumen.js";

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
  [McpItem.MCP_LUMEN]: createLumenMcpDependency,
};

const HARNESS_DEPS: Record<HarnessItem, () => Dependency> = {
  [HarnessItem.HARNESS_OPENCODE]: createOpencodeComponent,
  [HarnessItem.HARNESS_FORGECODE]: createForgecodeDependency,
  [HarnessItem.HARNESS_QWENCODE]: createQwencodeDependency,
  [HarnessItem.HARNESS_KILOCODE]: createKilocodeDependency,
  [HarnessItem.HARNESS_GOOSE]: createGooseDependency,
  [HarnessItem.HARNESS_CRUSH]: createCrushDependency,
};

const HARNESS_PLUGIN_DEPS: Record<HarnessPluginItem, () => Dependency> = {
  [HarnessPluginItem.PLUGIN_OMNIROUTE_AUTH]: createOmniRouteAuthPlugin,
};

export class BridgeService {
  getDepsFromConfig(): Dependency[] {
    return [];
  }

  async getDepsFromPreferences(): Promise<Dependency[]> {
    const { getPreferences, getActiveHarness } = await import("@db/pref.service.js");
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

      const mcpPreDeps = mcpDep.preDeps?.() || [];
      for (const pred of mcpPreDeps) {
        const predDep = this.resolvePreDep(pred.type, pred.item);
        if (predDep) {
          if (predDep.initFromPrefs) {
            await predDep.initFromPrefs();
          }
          deps.push(predDep);
        }
      }

      deps.push(mcpDep);
    }

    const activeHarness = await getActiveHarness();
    const harness = getHarnessItem(activeHarness);
    if (harness !== undefined && HARNESS_DEPS[harness]) {
      deps.push(HARNESS_DEPS[harness]());
    }

    for (const pluginName of prefs.harnessPlugins ?? []) {
      const plugin = getHarnessPluginItem(pluginName);
      if (plugin !== undefined && HARNESS_PLUGIN_DEPS[plugin]) {
        deps.push(HARNESS_PLUGIN_DEPS[plugin]());
      }
    }

    return deps;
  }

  private resolvePreDep(type: DepType, item: number): Dependency | undefined {
    switch (type) {
      case DepType.toolkit:
        return TOOLKIT_DEPS[item as ToolkitItem]?.();
      case DepType.optimizer:
        return OPTIMIZER_DEPS[item as OptimizerItem]?.();
      case DepType.proxy:
        return PROXY_DEPS[item as ProxyItem]?.();
      case DepType.mcp:
        return MCP_DEPS[item as McpItem]?.();
      case DepType.harness:
        return HARNESS_DEPS[item as HarnessItem]?.();
      case DepType.harnessPlugin:
        return HARNESS_PLUGIN_DEPS[item as HarnessPluginItem]?.();
      default:
        return undefined;
    }
  }
}

export const bridgeService = new BridgeService();
