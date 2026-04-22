import { spawn, ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { configService } from "@config/index.js";
import { logger } from "@lib/logger.js";
import { installerService } from "@runtime/installer/installer.service.js";
import type { Dependency, DepRef } from "@runtime/runtime.interface.js";
import type { OpencodeJson } from "./mcp.interface.js";
import { getPreferences } from "@db/pref.service.js";
import { ProxyItem, DepType } from "@runtime/dependency.enum.js";

export class LumenMcpDependency implements Dependency {
  readonly name = "Lumen MCP";
  readonly binPath: string;
  private process: ChildProcess | null = null;
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
    const paths = configService.paths;
    const opencodeJsonPath = join(paths.wssOpencodeConfigDir, "opencode.json");

    if (!existsSync(opencodeJsonPath)) {
      return false;
    }

    try {
      const content = readFileSync(opencodeJsonPath, "utf-8");
      const opencodeJson = JSON.parse(content);
      return !!(opencodeJson.mcp && opencodeJson.mcp["lumen"]);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    const paths = configService.paths;
    const opencodeJsonPath = join(paths.wssOpencodeConfigDir, "opencode.json");

    const strategy = installerService.direct(
      "https://github.com/ory/lumen/releases/download/v0.0.36/lumen-0.0.36-linux-amd64",
      "lumen",
      true,
    );
    await installerService.install(strategy, this.binPath);

    let opencodeJson: OpencodeJson = {};
    if (existsSync(opencodeJsonPath)) {
      try {
        opencodeJson = JSON.parse(readFileSync(opencodeJsonPath, "utf-8"));
      } catch {}
    }

    if (!opencodeJson.mcp) {
      opencodeJson.mcp = {};
    }

    if (!opencodeJson.mcp["lumen"]) {
      await mkdir(this.lumenDataDir, { recursive: true });
      opencodeJson.mcp["lumen"] = {
        type: "local",
        command: [this.binPath, "stdio"],
        enabled: true,
        environment: {
          XDG_DATA_HOME: this.lumenDataDir,
        },
      };
    }

    writeFileSync(opencodeJsonPath, JSON.stringify(opencodeJson, null, 2));
  }

  preDeps(): DepRef[] {
    return [{ type: DepType.proxy, item: ProxyItem.PROXY_OLLAMA }];
  }
}

export function createLumenMcpDependency(): LumenMcpDependency {
  return new LumenMcpDependency();
}

