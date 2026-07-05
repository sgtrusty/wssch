import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { configService } from "@config/index.js";
import { getPreferences } from "@db/pref.service.js";
import { logger } from "@lib/logger.js";

export type HarnessType = "opencode" | "forgecode";

export async function getActiveHarness(): Promise<HarnessType> {
  const prefs = await getPreferences();
  return (prefs.harness as HarnessType) || "opencode";
}

export interface LumenMcpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

function getMcpConfigPath(agent: HarnessType): string {
  const paths = configService.paths;

  const opencodeDir = join(homedir(), ".config/opencode");
  if (agent === "opencode") {
    if (!existsSync(opencodeDir)) {
      mkdirSync(opencodeDir, { recursive: true });
    }
    return join(opencodeDir, "opencode.json");
  }

  const forgeDir = join(homedir(), ".forge");
  if (!existsSync(forgeDir)) {
    mkdirSync(forgeDir, { recursive: true });
  }

  return join(forgeDir, ".mcp.json");
}

export function checkMcpEnabled(
  agent: HarnessType,
  serverName: string,
): boolean {
  const configPath = getMcpConfigPath(agent);

  if (!existsSync(configPath)) {
    return false;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    if (agent === "opencode") {
      return !!(
        (config as { mcp?: Record<string, unknown> }).mcp &&
        (config.mcp as Record<string, unknown>)[serverName]
      );
    }

    return !!(
      (config as { mcpServers?: Record<string, LumenMcpConfig> }).mcpServers &&
      config.mcpServers[serverName]
    );
  } catch {
    return false;
  }
}

export function writeMcpConfig(
  agent: HarnessType,
  serverName: string,
  serverConfig: LumenMcpConfig,
): void {
  const configPath = getMcpConfigPath(agent);
  let config: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {}
  }

  if (agent === "opencode") {
    if (!config.mcp) {
      config.mcp = {};
    }
    (config.mcp as Record<string, unknown>)[serverName] = {
      type: "local",
      command: serverConfig.command
        ? [serverConfig.command, ...(serverConfig.args || [])]
        : undefined,
      enabled: true,
      environment: serverConfig.env,
    };
  } else {
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    (config.mcpServers as Record<string, LumenMcpConfig>)[serverName] = {
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env,
      url: serverConfig.url,
    };
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  logger.info("mcp", `Wrote ${agent} MCP config to ${configPath}`);
}
