import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "@lib/logger.js";
import type { Dependency } from "@runtime/runtime.interface.js";

const PLUGIN_NAME = "opencode-omniroute-auth";
const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
const OPENCODE_CONFIG_PATH = join(OPENCODE_CONFIG_DIR, "opencode.json");

export class OmniRouteAuthPlugin implements Dependency {
  readonly name = "OmniRoute Auth Plugin";
  readonly binPath = "";

  async isAvailable(): Promise<boolean> {
    if (!existsSync(OPENCODE_CONFIG_PATH)) {
      return false;
    }
    try {
      const config = JSON.parse(readFileSync(OPENCODE_CONFIG_PATH, "utf-8"));
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

    if (!existsSync(OPENCODE_CONFIG_DIR)) {
      mkdirSync(OPENCODE_CONFIG_DIR, { recursive: true });
    }

    let config: Record<string, unknown> = {};
    if (existsSync(OPENCODE_CONFIG_PATH)) {
      try {
        config = JSON.parse(readFileSync(OPENCODE_CONFIG_PATH, "utf-8"));
      } catch {}
    }

    const plugins: string[] = Array.isArray(config.plugin)
      ? (config.plugin as string[])
      : [];

    if (!plugins.includes(PLUGIN_NAME)) {
      plugins.push(PLUGIN_NAME);
    }

    config.plugin = plugins;

    writeFileSync(OPENCODE_CONFIG_PATH, JSON.stringify(config, null, 2));
    logger.check(
      "harness-plugin",
      `Registered ${PLUGIN_NAME} in ${OPENCODE_CONFIG_PATH}`,
    );
  }
}

export function createOmniRouteAuthPlugin(): OmniRouteAuthPlugin {
  return new OmniRouteAuthPlugin();
}
