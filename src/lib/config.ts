import { resolve, dirname } from "node:path";
import { logger } from "../lib/logger.js";
import { readFileSync } from "node:fs";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

function getDirname(): string {
  try {
    return typeof import.meta !== "undefined" && import.meta.url
      ? dirname(fileURLToPath(import.meta.url))
      : cwd();
  } catch {
    return cwd();
  }
}

const __dirname = getDirname();

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

export type DepName = "rtk" | "bun" | "ollama" | "mcp-local-agent";

export interface Config {
  cmd: "run" | "init" | "status" | "deps";
  targetDir: string;
  whitelistHours: number;
  orchestratorDir: string;
  wssConfigDir: string;
  wssOpencodeConfigDir: string;
  wssOpencodeCacheDir: string;
  wssBinDir: string;
  wssCacheDir: string;
  wssDataDir: string;
  rtkBin: string | null;
  bunBin: string | null;
  ollamaUrl: string;
  embedModel: string;
  noRtk: boolean;
  noRag: boolean;
  noOllama: boolean;
  verbose: boolean;
  force: boolean;
  deps: DepName[];
}

const DEFAULT_CONFIG = {
  ollamaUrl: "http://192.168.1.50:11434",
  embedModel: "lco-embedding-omni-gguf",
  noRtk: false,
  noRag: false,
  noOllama: false,
  verbose: false,
  force: false,
  whitelistHours: 24,
};

export async function parseArgs(args: string[]): Promise<Config> {
  let cmd: Config["cmd"] = "run";
  let targetDir = cwd();
  let rtkBin: string | null = null;
  let whitelistHours = DEFAULT_CONFIG.whitelistHours;
  let verbose = DEFAULT_CONFIG.verbose;
  let force = DEFAULT_CONFIG.force;

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

  const orchestratorDir = resolve(__dirname, "..");
  const wssConfigDir =
    process.env.WSS_CONFIG_DIR || `${process.env.HOME}/.config/wssch`;
  const wssOpencodeConfigDir = process.env.WSS_IN_SANDBOX
    ? `${process.env.HOME}/.config/opencode`
    : `${wssConfigDir}/opencode-config`;
  const wssOpencodeCacheDir = process.env.WSS_IN_SANDBOX
    ? `${process.env.HOME}/.local/share/opencode`
    : `${wssConfigDir}/opencode-share`;
  const wssBinDir = `${wssConfigDir}/bin`;
  const wssCacheDir = `${wssConfigDir}/cache`;
  const wssDataDir = `${targetDir}/.wssdata`;

  loadEnv(targetDir);

  const deps: DepName[] = [];
  if (process.env.NO_RTK !== "true") deps.push("rtk");
  deps.push("bun");
  if (process.env.NO_OLLAMA !== "true") deps.push("ollama");
  if (process.env.NO_RAG !== "true") deps.push("mcp-local-agent");

  return {
    cmd,
    targetDir,
    whitelistHours,
    orchestratorDir,
    wssConfigDir,
    wssOpencodeConfigDir,
    wssOpencodeCacheDir,
    wssBinDir,
    wssCacheDir,
    wssDataDir,
    rtkBin,
    bunBin: null,
    ollamaUrl: process.env.OLLAMA_URL || DEFAULT_CONFIG.ollamaUrl,
    embedModel: process.env.EMBEDDING_MODEL || DEFAULT_CONFIG.embedModel,
    noRtk: process.env.NO_RTK === "true",
    noRag: process.env.NO_RAG === "true",
    noOllama: process.env.NO_OLLAMA === "true",
    verbose,
    force,
    deps,
  };
}

export function dumpConfig(config: Config): void {
  logger.debug("config", `cmd: ${config.cmd}`);
  logger.debug("config", `targetDir: ${config.targetDir}`);
  logger.debug("config", `wssConfigDir: ${config.wssConfigDir}`);
  logger.debug("config", `wssBinDir: ${config.wssBinDir}`);
  logger.debug("config", `wssCacheDir: ${config.wssCacheDir}`);
  logger.debug("config", `wssDataDir: ${config.wssDataDir}`);
  logger.debug("config", `ollamaUrl: ${config.ollamaUrl}`);
  logger.debug("config", `embedModel: ${config.embedModel}`);
  logger.debug("config", `noRtk: ${config.noRtk}`);
  logger.debug("config", `noRag: ${config.noRag}`);
  logger.debug("config", `noOllama: ${config.noOllama}`);
}

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
