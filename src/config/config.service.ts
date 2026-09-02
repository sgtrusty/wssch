import { resolve, join, dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { cwd } from "node:process";
import { createHash } from "node:crypto";

import { logger } from "@lib/logger.js";
import type { ArgConfig, Command } from "./arg.config.js";
import type { PathsConfig } from "./paths.config.js";
import { HARNESS_OPTIONS, HarnessItem, HARNESS_PATHS } from "@runtime/dependency.enum.js";
import type { HarnessPathConfig } from "@runtime/dependency.enum.js";

export interface LumenMcpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

function loadEnv(targetDir: string): void {
  const envPath = resolve(targetDir, ".env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {}
}

const DEFAULTS = {};

function printHelp(): void {
  console.log(`wssch - Workspace Sandbox for AI

Usage: wssch [command] [options]

Commands:
  run         Start sandbox and run orchestrator (default)
  orchestrate Run orchestrator inside current environment
  init        Scaffold project without sandbox
  database    Edit preferences in the database (alias: db)
  status     Show wssch status

Options:
  --rtk-bin <path>     Path to RTK binary
  --no-rtk            Disable RTK
  --no-rag            Disable RAG (MCP)
  --verbose, -v       Verbose output
  --force             Force overwrite
  --harness <name>    Harness override (opencode, goose, etc.)
  --trust-hours <n>   Whitelist trust hours (default: 24)
  --help, -h           Show this help

Examples:
  wssch run
  wssch run /path/to/project
  wssch init --no-rtk`);
}

interface FullConfig {
  args: ArgConfig;
  paths: PathsConfig;
}

class ConfigService {
  private config: FullConfig | null = null;
  private pendingPatches = new Map<string, Record<string, unknown>>();

  private getProjectChecksum(projectPath: string): string {
    return createHash("sha256").update(resolve(projectPath)).digest("hex").slice(0, 16);
  }

  init(argv: string[]): void {
    const args = this.parseArgs(argv);
    loadEnv(args.targetDir);

    const wssConfigDir =
      process.env.WSS_CONFIG_DIR || `${process.env.HOME}/.config/wssch`;
    const inSandbox = process.env.WSS_IN_SANDBOX === "true";
    const projectChecksum = this.getProjectChecksum(args.targetDir);

    const paths: PathsConfig = {
      wssConfigDir,
      wssBinDir: `${wssConfigDir}/bin`,
      wssDataDir: `${wssConfigDir}/projects/${projectChecksum}`,
    };

    this.config = { args, paths };
  }

  private parseArgs(args: string[]): ArgConfig {
    let cmd: Command = "run";
    let targetDir = cwd();
    let rtkBin: string | null = null;
    let whitelistHours = 24;
    let verbose = false;
    let force = false;
    let harnessOverride: string | null = process.env.WSS_HARNESS || null;

    const processed: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const next = args[i + 1];

      switch (arg) {
        case "run":
        case "init":
        case "status":
        case "deps":
        case "database":
        case "db":
        case "orchestrate":
        case "orcs":
          cmd = arg;
          break;
        case "--rtk-bin":
          if (next) {
            rtkBin = next;
            i++;
          }
          break;
        case "--no-rtk":
          process.env.NO_RTK = "true";
          break;
        case "--no-rag":
          process.env.NO_RAG = "true";
          break;
        case "--no-ollama":
          process.env.NO_OLLAMA = "true";
          break;
        case "--verbose":
        case "-v":
          verbose = true;
          break;
        case "--force":
          force = true;
          break;
        case "--harness":
          if (next) {
            harnessOverride = next;
            i++;
          }
          break;
        case "--trust-hours":
          if (next) {
            whitelistHours = parseInt(next);
            i++;
          }
          break;
        case "--help":
        case "-h":
          printHelp();
          process.exit(0);
        default:
          if (!arg.startsWith("-") && !processed.includes(arg)) {
            targetDir = resolve(arg);
          }
          processed.push(arg);
          break;
      }
    }

    return {
      cmd,
      targetDir,
      verbose,
      force,
      whitelistHours,
      rtkBin,
      debug: process.env.DEBUG === "1",
      harnessOverride,
    };
  }

  get args(): ArgConfig {
    if (!this.config) throw new Error("Config not initialized");
    return this.config.args;
  }

  get paths(): PathsConfig {
    if (!this.config) throw new Error("Config not initialized");
    return this.config.paths;
  }

  get isInitialized(): boolean {
    return this.config !== null;
  }

  getHarnessPaths(harnessName: string): HarnessPathConfig {
    const name = harnessName.toLowerCase();
    return HARNESS_PATHS[name] ?? {
      configDir: `.config/${name}`,
      cacheDir: `.local/share/${name}`,
    };
  }

  getHarnessConfigDir(harnessName: string): string {
    const inSandbox = process.env.WSS_IN_SANDBOX === "true";
    const { configDir: relConfigDir } = this.getHarnessPaths(harnessName);
    const configDir = inSandbox
      ? `/home/user/${relConfigDir}`
      : join(this.paths.wssConfigDir, "data", "config", harnessName);

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    return configDir;
  }

  getMcpConfigPath(agent: string): string {
    const configDir = this.getHarnessConfigDir(agent);
    const opencodeName = HARNESS_OPTIONS[HarnessItem.HARNESS_OPENCODE].name;

    return join(configDir, agent === opencodeName ? "opencode.json" : ".mcp.json");
  }

  checkMcpEnabled(agent: string, serverName: string): boolean {
    const configPath = this.getMcpConfigPath(agent);

    if (!existsSync(configPath)) {
      return false;
    }

    const opencodeName = HARNESS_OPTIONS[HarnessItem.HARNESS_OPENCODE].name;

    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));

      if (agent === opencodeName) {
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

  patchMcpConfig(
    agent: string,
    serverName: string,
    serverConfig: LumenMcpConfig,
  ): void {
    const configPath = this.getMcpConfigPath(agent);
    const opencodeName = HARNESS_OPTIONS[HarnessItem.HARNESS_OPENCODE].name;

    let patch: Record<string, unknown>;
    if (agent === opencodeName) {
      patch = {
        mcp: {
          [serverName]: {
            type: "local",
            command: serverConfig.command
              ? [serverConfig.command, ...(serverConfig.args || [])]
              : undefined,
            enabled: true,
            environment: serverConfig.env,
          },
        },
      };
    } else {
      patch = {
        mcpServers: {
          [serverName]: {
            command: serverConfig.command,
            args: serverConfig.args,
            env: serverConfig.env,
            url: serverConfig.url,
          },
        },
      };
    }

    const prior = this.pendingPatches.get(configPath) ?? {};
    this.pendingPatches.set(configPath, this.deepMerge(prior, patch));
    logger.debug(
      "config",
      `Accumulated ${agent} MCP patch for ${serverName}`,
    );
  }

  async flushPendingConfigs(harnessName: string): Promise<void> {
    const configDir = this.getHarnessConfigDir(harnessName);
    const paths = new Set<string>(this.pendingPatches.keys());

    paths.add(join(configDir, `${harnessName}.json`));

    for (const configPath of paths) {
      await this.flushConfigFile(configPath, harnessName);
    }

    this.pendingPatches.clear();
  }

  private async flushConfigFile(
    configPath: string,
    harnessName: string,
  ): Promise<void> {
    const basePath = configPath.replace(/\.json$/, ".base.json");

    let merged: Record<string, unknown> = {};
    let hasContent = false;

    if (existsSync(basePath)) {
      try {
        merged = this.deepMerge(
          merged,
          JSON.parse(readFileSync(basePath, "utf-8")),
        );
        hasContent = true;
      } catch {}
    }

    if (existsSync(configPath)) {
      try {
        merged = this.deepMerge(
          merged,
          JSON.parse(readFileSync(configPath, "utf-8")),
        );
        hasContent = true;
      } catch {}
    }

    const patch = this.pendingPatches.get(configPath);
    if (patch) {
      merged = this.deepMerge(merged, patch);
      hasContent = true;
    }

    if (!hasContent) return;

    try {
      await mkdir(dirname(configPath), { recursive: true });
      await writeFile(configPath, JSON.stringify(merged, null, 2) + "\n");
      logger.info(
        "config",
        `Flushed ${harnessName} config to ${configPath}`,
      );
    } catch (err) {
      logger.warn(
        "config",
        `Failed to flush config for ${harnessName}: ${err}`,
      );
    }
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = result[key];
      if (
        sourceVal !== null &&
        typeof sourceVal === "object" &&
        !Array.isArray(sourceVal) &&
        targetVal !== null &&
        typeof targetVal === "object" &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
        );
      } else {
        result[key] = sourceVal;
      }
    }
    return result;
  }
}

export const configService = new ConfigService();
