import { spawn, ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, rm, rename } from "node:fs/promises"; // Added 'rename' for directory migrations
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  safeInstallBin,
  downloadUrl,
  detectOs,
  detectArch,
  getLatestVersion,
  extractTar,
  extractZip,
} from "@runtime/dependency.util.js";

const REPO = "QwenLM/qwen-code";
const BINARY_NAME = "qwen-code";

export class QwencodeDependency implements Dependency {
  readonly name = "Qwencode";
  readonly installDir: string; // Track the root of the dependency directory
  readonly binPath: string; // Track the specific internal binary runner
  private process: ChildProcess | null = null;
  private exitResolve: (() => void) | null = null;
  private exitPromise: Promise<void> | null = null;

  constructor() {
    // The entire workspace bundle moves straight under your bin root folder
    this.installDir = join(configService.paths.wssBinDir, BINARY_NAME);

    // Dynamically point execution pathways directly down into the relative entry scripts
    const os = detectOs();
    if (os === "windows") {
      this.binPath = join(this.installDir, "bin", "qwen.cmd");
    } else {
      this.binPath = join(this.installDir, "bin", "qwen");
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { isExecutable } = await import("@runtime/dependency.util.js");
      return await isExecutable(this.binPath);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Qwencode already installed");
      return;
    }

    const rawOs = detectOs();
    const os = rawOs === "windows" ? "win" : rawOs;
    const rawArch = detectArch();
    const arch = rawArch === "x86_64" ? "x64" : "arm64";
    const ext = os === "win" ? ".zip" : ".tar.gz";
    const version = await getLatestVersion(REPO, "v0.1.0");

    const assetName = `${BINARY_NAME}-${os}-${arch}${ext}`;
    const url = `https://github.com/${REPO}/releases/download/${version}/${assetName}`;

    logger.progress("subdep", `Downloading Qwencode from ${url}`);

    const tempDir = tmpdir();
    const downloadedArchivePath = join(tempDir, assetName);

    await downloadUrl(
      url,
      downloadedArchivePath,
      `Downloading Qwencode ${version}`,
    );

    const extractDir = join(tempDir, `${BINARY_NAME}-extracted-${Date.now()}`);
    await mkdir(extractDir, { recursive: true });

    try {
      if (os === "win") {
        await extractZip(downloadedArchivePath, extractDir);
      } else {
        // Unpack tar directly without parsing internal target filenames
        await extractTar(downloadedArchivePath, extractDir, "qwen");
      }

      // Root folder created by structural unpacking inside our sandbox directory
      const sourceFolder = join(extractDir, BINARY_NAME);

      // Clean out historical directory footprints if present
      await rm(this.installDir, { force: true, recursive: true });
      await mkdir(dirname(this.installDir), { recursive: true });

      // Move the full wrapper pack folder to your runtime environment storage location
      try {
        await rename(sourceFolder, this.installDir);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "EXDEV") throw err;

        // Fallback strategy for across-partition mutations
        const { copyFile } = await import("node:fs/promises");
        // Simple directory copies don't exist natively on fs/promises, so we handle it cleanly
        const cpProc = spawn(
          os === "win" ? "xcopy" : "cp",
          os === "win"
            ? [sourceFolder, this.installDir, "/E", "/I", "/Y"]
            : ["-r", sourceFolder, this.installDir],
        );
        await new Promise<void>((resolve, reject) => {
          cpProc.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error("Directory copy failed")),
          );
          cpProc.on("error", reject);
        });
      }

      // Apply runtime permissions across internal runner binaries explicitly
      const { chmod } = await import("node:fs/promises");
      await chmod(this.binPath, 0o755);

      logger.check(
        "subdep",
        `Qwencode environment installed to ${this.installDir}`,
      );
    } catch (err) {
      logger.fail(
        "subdep",
        `Failed to extract or install package: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await rm(downloadedArchivePath, { force: true });
      await rm(extractDir, { force: true, recursive: true });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info("component", "Qwencode is already running.");
      return;
    }

    const args = configService.args;
    logger.progress("component", "Starting Qwencode...");

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;
    });

    try {
      this.process = spawn(this.binPath, {
        cwd: args.targetDir,
        stdio: "inherit",
        env: {
          ...process.env,
          HOME: "/home/user",
          TERM: process.env.TERM || "xterm",
        },
      });

      this.process.on("error", (err) => {
        logger.fail("component", `Qwencode process error: ${err.message}`);
        this.process = null;
        if (this.exitResolve) this.exitResolve();
      });

      this.process.on("exit", (code) => {
        logger.info("component", `Qwencode exited with code ${code}`);
        this.process = null;
        if (this.exitResolve) this.exitResolve();
      });
    } catch (err) {
      logger.fail("component", `Qwencode failed to launch: ${err}`);
      this.process = null;
      if (this.exitResolve) this.exitResolve();
      throw err;
    }

    await this.exitPromise;
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");

      if (this.exitPromise) {
        await this.exitPromise;
      }

      logger.info("component", "Qwencode stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && this.process.killed === false;
  }
}

export function createQwencodeDependency(): Dependency {
  return new QwencodeDependency();
}
