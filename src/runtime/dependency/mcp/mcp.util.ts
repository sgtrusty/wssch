import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { configService } from "@config/index.js";
import { getActiveHarness } from "@db/pref.service.js";
import { HarnessItem, HARNESS_OPTIONS } from "@runtime/dependency.enum.js";
import { logger } from "@lib/logger.js";

const OPENCODE_NAME = HARNESS_OPTIONS[HarnessItem.HARNESS_OPENCODE].name;

export type HarnessType = string;

export interface LumenMcpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

function getMcpConfigPath(agent: HarnessType): string {
  const inSandbox = process.env.WSS_IN_SANDBOX === "true";
  const { configDir: relConfigDir } = configService.getHarnessPaths(agent);
  const configDir = inSandbox ? `/home/user/${relConfigDir}` : join(process.env.HOME || "/home/user", relConfigDir);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (agent === OPENCODE_NAME) {
    return join(configDir, "opencode.json");
  }

  return join(configDir, ".mcp.json");
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

    if (agent === OPENCODE_NAME) {
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

  if (agent === OPENCODE_NAME) {
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
