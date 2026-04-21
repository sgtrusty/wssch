import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { configService } from "@config/index.js";
import type { Dependency } from "../dep.interface.js";

interface OpencodeJson {
  mcp?: Record<string, unknown>;
}

export class McpLocalAgentDependency implements Dependency {
  readonly name = "MCP Local Agent";
  readonly binPath: string;

  constructor() {
    this.binPath = "";
  }

  async isAvailable(): Promise<boolean> {
    const paths = configService.paths;
    const opencodeJsonPath = join(
      paths.wssOpencodeConfigDir,
      "opencode.json",
    );

    if (!existsSync(opencodeJsonPath)) {
      return false;
    }

    try {
      const content = readFileSync(opencodeJsonPath, "utf-8");
      const opencodeJson: OpencodeJson = JSON.parse(content);
      return !!(opencodeJson.mcp && opencodeJson.mcp["mcp-local-agent"]);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    const paths = configService.paths;
    const opencodeJsonPath = join(
      paths.wssOpencodeConfigDir,
      "opencode.json",
    );

    let opencodeJson: OpencodeJson = {};

    if (existsSync(opencodeJsonPath)) {
      try {
        opencodeJson = JSON.parse(readFileSync(opencodeJsonPath, "utf-8"));
      } catch {}
    }

    if (!opencodeJson.mcp) {
      opencodeJson.mcp = {};
    }

    if (!opencodeJson.mcp["mcp-local-agent"]) {
      opencodeJson.mcp["mcp-local-agent"] = {
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

    writeFileSync(opencodeJsonPath, JSON.stringify(opencodeJson, null, 2));
  }

  preDeps(): string[] {
    return ["ollama"];
  }
}

export function createMcpLocalAgentDependency(): McpLocalAgentDependency {
  return new McpLocalAgentDependency();
}