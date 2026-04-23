import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { configService } from "@config/index.js";
import { installerService } from "@runtime/installer/installer.service.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import { checkMcpEnabled, writeMcpConfig, getActiveAgent } from "./mcp.util.js";

const SERVER_NAME = "mcp-local-agent";

export class McpLocalAgentDependency implements Dependency {
  readonly name = "Shinpr MCP LocalDB";
  readonly binPath: string;

  constructor() {
    this.binPath = join(configService.paths.wssBinDir, "mcp-local-rag");
  }

  async isAvailable(): Promise<boolean> {
    const agent = await getActiveAgent();
    return checkMcpEnabled(agent, SERVER_NAME);
  }

  async install(): Promise<void> {
    const agent = await getActiveAgent();
    const paths = configService.paths;

    const strategy = installerService.esbuild({
      repoUrl: "https://github.com/shinpr/mcp-local-rag",
      binName: "mcp-local-rag",
      entryPoint: "src/index.ts",
      externals: [
        "@lancedb/lancedb",
        "onnxruntime-node",
        "@huggingface/transformers",
        "mupdf",
        "jsdom",
        "canvas",
      ],
    });
    await installerService.install(strategy, this.binPath);

    const mcpShinprDir = join(paths.wssDataDir, "mcp/shinpr");
    await mkdir(mcpShinprDir, { recursive: true });

    writeMcpConfig(agent, SERVER_NAME, {
      command: this.binPath,
      args: agent === "forgecode" ? ["stdio"] : undefined,
      env: {
        BASE_DIR: paths.wssDataDir,
        DB_PATH: join(mcpShinprDir, "rag.db"),
        CACHE_DIR: join(mcpShinprDir, "models"),
      },
    });
  }
}

export function createMcpLocalAgentDependency(): McpLocalAgentDependency {
  return new McpLocalAgentDependency();
}
