import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { access, constants } from "node:fs/promises";
import { logger } from "@lib/logger.js";
import { installerService } from "@runtime/installer/installer.service.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import { getPreferences } from "@db/pref.service.js";
import { createOllamaProxyDependency } from "../proxy/ollamaProxy.js";

export interface RagQueryResult {
  chunks: string[];
  sources: string[];
}

export interface RagIngestResult {
  fileCount: number;
  chunkCount: number;
}

export interface LocalRagConfig {
  dbPath: string;
  baseUrl?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
}

export class LocalRagClient implements Dependency {
  readonly name = "Shinpr MCP LocalRag";
  readonly binPath: string;
  private process: ChildProcess | null = null;
  private config: LocalRagConfig;
  private ollama: Dependency;

  constructor() {
    const paths = configService.paths;
    this.binPath = join(paths.wssBinDir, "mcp-local-rag");
    this.config = {
      dbPath: join(paths.wssConfigDir, "rag.db"),
    };
    this.ollama = createOllamaProxyDependency();
  }

  async initFromPrefs(): Promise<void> {
    if (this.ollama.initFromPrefs) {
      await this.ollama.initFromPrefs();
    }
    const prefs = await getPreferences();
    this.config.baseUrl = prefs.ollamaUrl;
    this.config.embeddingProvider = "ollama";
    this.config.embeddingModel = prefs.embeddingModel;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await access(this.binPath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    const strategy = installerService.npx({
      packageName: "@shinpr/mcp-local-rag",
      binName: "mcp-local-rag",
      version: "0.1.3.0",
    });
    await installerService.install(strategy, this.binPath);
  }

  async start(): Promise<void> {
    if (this.isRunning()) return;

    logger.progress(this.name, "Starting MCP (local-RAG)...");

    if (!existsSync(this.binPath)) {
      logger.warn(this.name, "mcp-local-rag not found");
      return;
    }

    this.process = spawn(this.binPath, [], {
      stdio: "ignore",
      env: {
        ...process.env,
        PATH: `/home/user/.localdata/bin:${process.env.PATH}`,
        BASE_DIR: "/home/user/project",
        DB_PATH: this.config.dbPath,
      },
    });

    this.process.on("exit", (code) => {
      if (code !== 0) {
        logger.warn(this.name, `Exited with code ${code}`);
      }
      this.process = null;
    });

    logger.check(this.name, "Running");
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      this.process = null;
      logger.info(this.name, "Stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isRunning()) return false;
    try {
      const result = await this.runCommand(["status"]);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  async ingest(directories: string[]): Promise<RagIngestResult> {
    const args = ["ingest", ...directories];
    const result = await this.runCommand(args);

    if (result.code !== 0) {
      throw new Error(`Ingest failed: ${result.stderr}`);
    }

    return {
      fileCount: directories.length,
      chunkCount: result.stdout.split("\n").length,
    };
  }

  async query(query: string, topK: number = 5): Promise<RagQueryResult> {
    const args = ["query", "--top-k", String(topK), query];
    const result = await this.runCommand(args);

    if (result.code !== 0) {
      throw new Error(`Query failed: ${result.stderr}`);
    }

    const chunks = result.stdout.trim().split("\n---\n").filter(Boolean);

    return {
      chunks,
      sources: chunks.map(() => "unknown"),
    };
  }

  async status(): Promise<{ documents: number; chunks: number }> {
    const args = ["status"];
    const result = await this.runCommand(args);

    if (result.code !== 0) {
      return { documents: 0, chunks: 0 };
    }

    const docMatch = result.stdout.match(/documents?:\s*(\d+)/i);
    const chunkMatch = result.stdout.match(/chunks?:\s*(\d+)/i);

    return {
      documents: docMatch ? parseInt(docMatch[1]) : 0,
      chunks: chunkMatch ? parseInt(chunkMatch[1]) : 0,
    };
  }

  private runCommand(
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.binPath, args, { stdio: "pipe" });
      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (d) => {
        stdout += d;
      });
      proc.stderr?.on("data", (d) => {
        stderr += d;
      });

      proc.on("close", (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });

      proc.on("error", (err) => {
        resolve({ code: 1, stdout: "", stderr: String(err) });
      });
    });
  }

  preDeps(): string[] {
    return ["ollama"];
  }
}

export function createLocalRagClient(): LocalRagClient {
  return new LocalRagClient();
}
