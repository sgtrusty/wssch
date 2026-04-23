import { spawn, ChildProcess } from "node:child_process";
import { mkdir, access, constants, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  safeInstallBin,
  downloadUrl,
  extractTar,
  isExecutable,
  detectOs,
  detectArch,
  getLatestVersion,
} from "@runtime/dependency.util.js";

const REPO = "rtk-ai/rtk";
const VERSION_FALLBACK = "v0.37.1";

function getTarget(os: string, arch: string): string {
  if (os === "linux") {
    if (arch === "x86_64") return "x86_64-unknown-linux-musl";
    if (arch === "aarch64") return "aarch64-unknown-linux-gnu";
    throw new Error(`Unsupported arch for linux: ${arch}`);
  }
  if (os === "darwin") {
    return `${arch}-apple-darwin`;
  }
  throw new Error(`Unsupported OS: ${os}`);
}

export class RtkDependency implements Dependency {
  readonly name = "RTK (optimizer)";
  readonly binPath: string;
  private client: RtkClient | null = null;
  private _isRunning = false;

  constructor() {
    this.binPath = `${configService.paths.wssBinDir}/rtk`;
  }

  async start(): Promise<void> {
    this.client = new RtkClient(this.binPath);
    try {
      const available = await this.client.check();
      if (available) {
        this._isRunning = true;
        logger.check("component", "RTK ready");
      } else {
        logger.warn("component", "RTK not available");
      }
    } catch (err) {
      logger.warn("component", `RTK check failed: ${err}`);
    }
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    this.client = null;
  }

  isRunning(): boolean {
    return this._isRunning;
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
    const paths = configService.paths;

    if (await this.isAvailable()) {
      logger.info("subdep", "RTK already installed");
      return;
    }

    logger.info("subdep", "Installing RTK...");

    const os = detectOs();
    const arch = detectArch();
    const target = getTarget(os, arch);
    const version = await getLatestVersion(REPO, VERSION_FALLBACK);

    await mkdir(paths.wssBinDir, { recursive: true });

    const url = `https://github.com/${REPO}/releases/download/${version}/rtk-${target}.tar.gz`;
    logger.progress("subdep", `Downloading RTK from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, "rtk.tar.gz");

    await downloadUrl(url, archive);

    const downloadedBin = await extractTar(archive, tempDir, "rtk");
    if (!(await isExecutable(downloadedBin))) {
      throw new Error("RTK binary not executable after extraction");
    }

    await safeInstallBin(downloadedBin, this.binPath);

    if (!(await isExecutable(this.binPath))) {
      throw new Error("RTK binary not executable after installation");
    }

    logger.check("subdep", `RTK installed to ${paths.wssBinDir}`);
    await rm(archive, { force: true });
  }

  async postInstall(): Promise<void> {
    return new Promise((resolve) => {
      const proc = spawn("rtk", ["init", "-g", "--opencode"], {
        stdio: "inherit",
      });
      proc.on("close", (code) => {
        if (code === 0) {
          logger.check("subdep", "RTK OpenCode plugin installed");
        }
        resolve();
      });
      proc.on("error", () => {
        logger.warn("subdep", "RTK init --opencode failed (is rtk in PATH?)");
        resolve();
      });
    });
  }
}

export class RtkClient {
  private available: boolean = false;

  constructor(private readonly binPath: string) {}

  async check(): Promise<boolean> {
    try {
      const result = await this.runCommand(["--version"]);
      this.available = result.code === 0;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async rewrite(command: string): Promise<string> {
    if (!this.available) {
      throw new Error("RTK not available");
    }

    const result = await this.runCommand(["rewrite", command]);

    if (result.code !== 0) {
      throw new Error(`RTK rewrite failed: ${result.stderr}`);
    }

    return result.stdout.trim();
  }

  async complete(prompt: string): Promise<string> {
    if (!this.available) {
      throw new Error("RTK not available");
    }

    const result = await this.runCommand(["complete", prompt]);

    if (result.code !== 0) {
      throw new Error(`RTK complete failed: ${result.stderr}`);
    }

    return result.stdout.trim();
  }

  private runCommand(
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn("rtk", args, { stdio: "pipe" });
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

export function createRtkDependency(): RtkDependency {
  return new RtkDependency();
}

export function createRtkClient(): RtkClient {
  return new RtkClient(`${configService.paths.wssBinDir}/rtk`);
}

