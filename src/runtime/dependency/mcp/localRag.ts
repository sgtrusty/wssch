import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "../dependency.interface.js";

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
  readonly name = "MCP (local-RAG)";
  readonly binPath = "";
  private process: ChildProcess | null = null;
  private config: LocalRagConfig;

  constructor() {
    const paths = configService.paths;
    const runtime = configService.runtime;

    this.config = {
      dbPath: join(paths.wssConfigDir, "rag.db"),
      baseUrl: runtime.ollamaUrl,
      embeddingProvider: "ollama",
      embeddingModel: runtime.embeddingModel,
    };
  }

  async isAvailable(): Promise<boolean> {
    const mcpBin = join("/home/user/cli", "node_modules", ".bin", "mcp-local-rag");
    return existsSync(mcpBin);
  }

  async install(): Promise<void> {}

  async start(): Promise<void> {
    if (this.isRunning()) return;

    logger.progress(this.name, "Starting MCP (local-RAG)...");

    const cliDir = "/home/user/cli";
    const mcpBin = join(cliDir, "node_modules", ".bin", "mcp-local-rag");

    if (!existsSync(mcpBin)) {
      logger.warn(this.name, "mcp-local-rag not found in node_modules");
      return;
    }

    this.process = spawn(mcpBin, [], {
      cwd: "/home/user/project",
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
    const args = ["-y", "mcp-local-rag", "ingest", ...directories];
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
    const args = [
      "-y",
      "mcp-local-rag",
      "query",
      "--top-k",
      String(topK),
      query,
    ];
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
    const args = ["-y", "mcp-local-rag", "status"];
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
      const proc = spawn("/usr/bin/npx", args, { stdio: "pipe" });
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
}

export function createLocalRagClient(): LocalRagClient {
  return new LocalRagClient();
}
