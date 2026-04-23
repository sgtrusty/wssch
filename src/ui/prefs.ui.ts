import inquirer from "inquirer";
import { getPreferences, updatePreferences } from "@db/pref.service.js";
import type { Preferences } from "@db/pref.service.js";
import {
  MCP_OPTIONS,
  OPTIMIZER_OPTIONS,
  AGENTIC_OPTIONS,
} from "@runtime/dependency.enum.js";
import { McpLocalAgentDependency } from "@runtime/dependency/mcp/localAgent.js";
import { LocalRagClient } from "@runtime/dependency/mcp/localRag.js";
import { LumenMcpDependency } from "@runtime/dependency/mcp/lumen.js";
import type { DepRef } from "@runtime/runtime.interface.js";
import { DepType, ProxyItem } from "@runtime/dependency.enum.js";

async function promptPreferences(
  current?: Preferences,
): Promise<Partial<Preferences>> {
  const prefs = current || {
    preferredMcpServer: "local",
    tokenOptimizatorAlgo: ["RAG"],
    toolkit: "bun",
    agentic: "opencode",
    ollamaUrl: "http://localhost:11434",
    embeddingModel: "all-minilm:l6-v2",
  };

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "preferredMcpServer",
      message: "Preferred MCP server:",
      choices: MCP_OPTIONS.map((o) => o.name),
      default: prefs.preferredMcpServer,
    },
    {
      type: "checkbox",
      name: "tokenOptimizatorAlgo",
      message: "Token optimizer algo:",
      choices: OPTIMIZER_OPTIONS.map((o) => ({
        name: o.name,
        value: o.name,
      })),
      default: prefs.tokenOptimizatorAlgo,
    },
    {
      type: "list",
      name: "agentic",
      message: "Agentic framework:",
      choices: AGENTIC_OPTIONS.map((o) => o.name),
      default: prefs.agentic,
    },
  ]);

  const MCP_DEP_CLASSES: Record<string, new () => any> = {
    localMcp: McpLocalAgentDependency,
    localRag: LocalRagClient,
    lumen: LumenMcpDependency,
  };

  function getPreDepPrefs(preDeps: DepRef[]): string[] {
    const prefs: string[] = [];
    for (const pred of preDeps) {
      if (pred.type === DepType.proxy && pred.item === ProxyItem.PROXY_OLLAMA) {
        prefs.push("ollamaUrl");
      }
    }
    return prefs;
  }

  const mcp = MCP_OPTIONS.find((o) => o.name === answers.preferredMcpServer);
  const mcpClass = mcp ? MCP_DEP_CLASSES[mcp.name] : undefined;
  const mcpInstance = mcpClass ? new mcpClass() : undefined;
  const preDeps = mcpInstance?.preDeps?.() || [];
  const preDepPrefs = getPreDepPrefs(preDeps);
  const suggestedPrefs = mcpInstance?.suggestedPrefs;
  const neededPrefs = new Set([
    ...(suggestedPrefs ? Object.keys(suggestedPrefs) : []),
    ...preDepPrefs,
  ]);

  let ollamaUrl = prefs.ollamaUrl;
  let embeddingModel = prefs.embeddingModel;

  if (neededPrefs.has("ollamaUrl")) {
    const urlAns = await inquirer.prompt([
      {
        type: "input",
        name: "ollamaUrl",
        message: "Ollama URL:",
        default: prefs.ollamaUrl,
      },
    ]);
    ollamaUrl = urlAns.ollamaUrl;
  }
  if (neededPrefs.has("embeddingModel")) {
    const embAns = await inquirer.prompt([
      {
        type: "input",
        name: "embeddingModel",
        message: "Embedding model:",
        default: suggestedPrefs?.embeddingModel ?? prefs.embeddingModel,
      },
    ]);
    embeddingModel = embAns.embeddingModel;
  }

  return {
    preferredMcpServer: answers.preferredMcpServer,
    ollamaUrl,
    embeddingModel,
    tokenOptimizatorAlgo: answers.tokenOptimizatorAlgo,
    toolkit: "bun",
    agentic: answers.agentic,
  };
}

export async function initPreferencesInteractive(): Promise<void> {
  const updates = await promptPreferences();
  await updatePreferences({
    ...updates,
    initialCheck: true,
  } as Partial<Preferences>);
}

export async function editPreferences(): Promise<void> {
  const current = await getPreferences();
  const updates = await promptPreferences(current);
  await updatePreferences(updates);
}
