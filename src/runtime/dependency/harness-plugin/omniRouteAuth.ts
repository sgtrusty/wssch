import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";

const PLUGIN_NAME = "opencode-omniroute-auth";

function getOpencodeConfigDir(): string {
  const { configDir } = configService.getHarnessPaths("opencode");
  if (process.env.WSS_IN_SANDBOX === "true") {
    return join(homedir(), configDir);
  }
  return join(configService.paths.wssConfigDir, "data", "config", "opencode");
}

function getOpencodeConfigPath(): string {
  return join(getOpencodeConfigDir(), "opencode.json");
}

export class OmniRouteAuthPlugin implements Dependency {
  readonly name = "OmniRoute Auth Plugin";
  readonly binPath = "";

  async isAvailable(): Promise<boolean> {
    const configPath = getOpencodeConfigPath();
    if (!existsSync(configPath)) {
      return false;
    }
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const plugins: string[] = config.plugin ?? [];
      return plugins.includes(PLUGIN_NAME);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("harness-plugin", `${PLUGIN_NAME} already registered`);
      return;
    }

    const configDir = getOpencodeConfigDir();
    const configPath = getOpencodeConfigPath();

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch {}
    }

    const plugins: string[] = Array.isArray(config.plugin)
      ? (config.plugin as string[])
      : [];

    if (!plugins.includes(PLUGIN_NAME)) {
      plugins.push(PLUGIN_NAME);
    }

    config.plugin = plugins;

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.check(
      "harness-plugin",
      `Registered ${PLUGIN_NAME} in ${configPath}`,
    );
  }
}

export function createOmniRouteAuthPlugin(): OmniRouteAuthPlugin {
  return new OmniRouteAuthPlugin();
}
