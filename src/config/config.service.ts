import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { cwd } from "node:process";

import type { ArgConfig, Command } from "./arg.config.js";
import type { PathsConfig } from "./paths.config.js";
import type { RuntimeConfig, DepName } from "./runtime.config.js";

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

const DEFAULTS = {
  ollamaUrl: "http://192.168.1.50:11434",
  embeddingModel: "lco-embedding-omni-gguf",
};

function printHelp(): void {
  console.log(`wssch - Workspace Sandbox for AI

Usage: wssch [command] [options]

Commands:
  run         Start sandbox and run orchestrator (default)
  orchestrate Run orchestrator inside current environment
  init        Scaffold project without sandbox
  status     Show wssch status

Options:
  --rtk-bin <path>     Path to RTK binary
  --ollama-url <url>   Ollama server URL
  --embedding-model <model> Embedding model
  --no-rtk            Disable RTK
  --no-rag            Disable RAG (MCP)
  --no-ollama         Ollama not available
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
  runtime: RuntimeConfig;
}

function getDirname(): string {
  try {
    return typeof import.meta !== "undefined" && import.meta.url
      ? dirname(fileURLToPath(import.meta.url))
      : cwd();
  } catch {
    return cwd();
  }
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
        : `${wssConfigDir}/opencode-config`,
      wssOpencodeCacheDir: inSandbox
        ? `${process.env.HOME}/.local/share/opencode`
        : `${wssConfigDir}/opencode-share`,
      wssBinDir: `${wssConfigDir}/bin`,
      wssCacheDir: `${wssConfigDir}/cache`,
      wssDataDir: `${args.targetDir}/.wssdata`,
    };

    const deps: DepName[] = [];
    if (process.env.NO_RTK !== "true") deps.push("rtk");
    deps.push("bun");
    if (process.env.NO_OLLAMA !== "true") deps.push("ollama");
    if (process.env.NO_RAG !== "true") deps.push("mcp-local-agent");

    const runtime: RuntimeConfig = {
      ollamaUrl: process.env.OLLAMA_URL || DEFAULTS.ollamaUrl,
      embeddingModel: process.env.EMBEDDING_MODEL || DEFAULTS.embeddingModel,
      deps,
    };

    this.config = { args, paths, runtime };
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
          cmd = arg;
          break;
        case "--rtk-bin":
          if (next) {
            rtkBin = next;
            i++;
          }
          break;
        case "--ollama-url":
          if (next) {
            process.env.OLLAMA_URL = next;
            i++;
          }
          break;
        case "--embedding-model":
          if (next) {
            process.env.EMBEDDING_MODEL = next;
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
      noRtk: process.env.NO_RTK === "true",
      noRag: process.env.NO_RAG === "true",
      noOllama: process.env.NO_OLLAMA === "true",
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

  get runtime(): RuntimeConfig {
    if (!this.config) throw new Error("Config not initialized");
    return this.config.runtime;
  }

  get isInitialized(): boolean {
    return this.config !== null;
  }
}

export const configService = new ConfigService();