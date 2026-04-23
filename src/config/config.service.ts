import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { cwd } from "node:process";

import type { ArgConfig, Command } from "./arg.config.js";
import type { PathsConfig } from "./paths.config.js";

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

  init(argv: string[]): void {
    const args = this.parseArgs(argv);
    loadEnv(args.targetDir);

    const wssConfigDir =
      process.env.WSS_CONFIG_DIR || `${process.env.HOME}/.config/wssch`;
    const inSandbox = process.env.WSS_IN_SANDBOX === "true";

    const paths: PathsConfig = {
      wssConfigDir,
      wssOpencodeConfigDir: inSandbox
        ? `${process.env.HOME}/.config/opencode`
        : `${wssConfigDir}/opencode/config`,
      wssOpencodeCacheDir: inSandbox
        ? `${process.env.HOME}/.local/share/opencode`
        : `${wssConfigDir}/opencode/share`,
      wssBinDir: `${wssConfigDir}/bin`,
      wssDataDir: `${args.targetDir}/.wssdata`,
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
}

export const configService = new ConfigService();
