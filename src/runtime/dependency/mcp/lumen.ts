import { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { configService } from "@config/index.js";
import { installerService } from "@runtime/installer/installer.service.js";
import type { Dependency, DepRef } from "@runtime/runtime.interface.js";
import { ProxyItem, DepType } from "@runtime/dependency.enum.js";
import { checkMcpEnabled, writeMcpConfig, getActiveAgent } from "./mcp.util.js";

const SERVER_NAME = "lumen";

export class LumenMcpDependency implements Dependency {
  readonly name = "Lumen MCP";
  readonly binPath: string;
  readonly suggestedPrefs = { embeddingModel: "ordis/jina-embeddings-v2-base-code" };
  private lumenDataDir: string;

  constructor() {
    const paths = configService.paths;
    this.binPath = join(paths.wssBinDir, "lumen");
    this.lumenDataDir = join(paths.wssDataDir, "mcp", "lumen");
  }

  async initFromPrefs(): Promise<void> {
    await mkdir(this.lumenDataDir, { recursive: true });
  }

  async isAvailable(): Promise<boolean> {
    const agent = await getActiveAgent();
    return checkMcpEnabled(agent, SERVER_NAME);
  }

  async install(): Promise<void> {
    const agent = await getActiveAgent();
    const paths = configService.paths;

    const strategy = installerService.direct(
      "https://github.com/ory/lumen/releases/download/v0.0.36/lumen-0.0.36-linux-amd64",
      "lumen",
      true,
    );
    await installerService.install(strategy, this.binPath);

    await mkdir(this.lumenDataDir, { recursive: true });

    writeMcpConfig(agent, SERVER_NAME, {
      command: this.binPath,
      args: ["stdio"],
      env: {
        XDG_DATA_HOME: this.lumenDataDir,
      },
    });
  }

  preDeps(): DepRef[] {
    return [{ type: DepType.proxy, item: ProxyItem.PROXY_OLLAMA }];
  }
}

export function createLumenMcpDependency(): LumenMcpDependency {
  return new LumenMcpDependency();
}
