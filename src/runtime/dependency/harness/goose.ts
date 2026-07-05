import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  safeInstallBin,
  downloadUrl,
  extractTar,
  moveExtractedBin,
  detectOs,
  detectArch,
  getLibcType,
  getLatestVersion,
  isExecutable,
} from "@runtime/dependency.util.js";

const REPO = "aaif-goose/goose";
const BINARY_NAME = "goose";
const VARIANT = "vulkan";

export class GooseDependency implements Dependency {
  readonly name = "Goose";
  readonly binPath: string;
  private process: ChildProcess | null = null;
  private exitResolve: (() => void) | null = null;
  private exitPromise: Promise<void> | null = null;

  constructor() {
    this.binPath = join(configService.paths.wssBinDir, BINARY_NAME);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await isExecutable(this.binPath);
    } catch {
      return false;
    }
  }

  private async buildAssetUrl(version: string): Promise<string> {
    const os = detectOs();
    const arch = detectArch();

    let target: string;
    if (os === "windows") {
      target = `${arch}-pc-windows-msvc`;
    } else if (os === "darwin") {
      target = `${arch}-apple-darwin`;
    } else {
      const libc = await getLibcType();
      target = `${arch}-unknown-linux-${libc}`;
    }

    return `https://github.com/${REPO}/releases/download/${version}/goose-${target}-${VARIANT}.tar.gz`;
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Goose already installed");
      return;
    }

    const version = await getLatestVersion(REPO, "v1.41.0");
    const url = await this.buildAssetUrl(version);

    logger.progress("subdep", `Downloading Goose from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, `${BINARY_NAME}.tar.gz`);
    await downloadUrl(url, archive, `Downloading Goose ${version}`);

    const downloadedBin = await extractTar(archive, tempDir, "goose");
    if (!(await isExecutable(downloadedBin))) {
      throw new Error("Goose binary not executable after extraction");
    }

    await safeInstallBin(downloadedBin, this.binPath);

    logger.check("subdep", `Goose installed to ${this.binPath}`);
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info("component", "Goose is already running.");
      return;
    }

    const args = configService.args;

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting Goose...");

        this.process = spawn(this.binPath, {
          cwd: args.targetDir,
          stdio: "inherit",
          env: {
            ...process.env,
            HOME: "/home/user",
            TERM: process.env.TERM || "xterm",
          },
        });

        this.process.on("exit", (code) => {
          logger.info("component", `Goose exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `Goose failed: ${err}`);
        if (this.exitResolve) {
          this.exitResolve();
        }
      }
    });

    await this.exitPromise;
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      this.process = null;
      logger.info("component", "Goose stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createGooseDependency(): Dependency {
  return new GooseDependency();
}
