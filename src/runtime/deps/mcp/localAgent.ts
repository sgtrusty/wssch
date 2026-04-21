import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../../../lib/config.js";
import type { Dependency } from "../base.js";

interface OpencodeJson {
  mcp?: Record<string, unknown>;
}

export class McpLocalAgentDependency implements Dependency {
  readonly name = "MCP Local Agent";
  readonly binPath: string;

  constructor(private readonly config: Config) {
    this.binPath = "";
  }

  async isAvailable(): Promise<boolean> {
    const opencodeJsonPath = join(
      this.config.wssOpencodeConfigDir,
      "opencode.json",
    );

    if (!existsSync(opencodeJsonPath)) {
      return false;
    }

    try {
      const content = readFileSync(opencodeJsonPath, "utf-8");
      const config: OpencodeJson = JSON.parse(content);
      return !!(config.mcp && config.mcp["mcp-local-agent"]);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    const opencodeJsonPath = join(
      this.config.wssOpencodeConfigDir,
      "opencode.json",
    );

    let config: OpencodeJson = {};

    if (existsSync(opencodeJsonPath)) {
      try {
        config = JSON.parse(readFileSync(opencodeJsonPath, "utf-8"));
      } catch {}
    }

    if (!config.mcp) {
      config.mcp = {};
    }

    if (!config.mcp["mcp-local-agent"]) {
      config.mcp["mcp-local-agent"] = {
        type: "local",
        command: ["bun", "x", "mcp-local-rag"],
        enabled: true,
        environment: {
          BASE_DIR: "/home/user/project",
          DB_PATH: "/home/user/.localdata/rag.db",
          CACHE_DIR: "/home/user/.localdata/cache/models",
        },
      };
    }

    writeFileSync(opencodeJsonPath, JSON.stringify(config, null, 2));
  }

  preDeps(): string[] {
    return ["ollama"];
  }
}

export function createMcpLocalAgentDependency(
  config: Config,
): McpLocalAgentDependency {
  return new McpLocalAgentDependency(config);
}
