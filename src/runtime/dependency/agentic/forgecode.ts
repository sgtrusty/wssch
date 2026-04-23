import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  safeInstallBin,
  downloadUrl,
  detectOs,
  getForgeTarget,
  getLatestVersion,
} from "@runtime/dependency.util.js";

const REPO = "tailcallhq/forgecode";
const BINARY_NAME = "forge";

export class ForgecodeDependency implements Dependency {
  readonly name = "ForgeCode";
  readonly binPath: string;
  private process: ChildProcess | null = null;
  private exitResolve: (() => void) | null = null;
  private exitPromise: Promise<void> | null = null;

  constructor() {
    this.binPath = join(configService.paths.wssBinDir, BINARY_NAME);
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
      logger.info("subdep", "ForgeCode already installed");
      return;
    }

    const target = await getForgeTarget();
    const version = await getLatestVersion(REPO, "v0.1.0");
    const ext = detectOs() === "windows" ? ".exe" : "";
    const url = `https://github.com/${REPO}/releases/download/${version}/${BINARY_NAME}-${target}${ext}`;

    logger.progress("subdep", `Downloading ForgeCode from ${url}`);

    const tempDir = tmpdir();
    const downloadedPath = join(tempDir, `${BINARY_NAME}${ext}`);

    await downloadUrl(url, downloadedPath, `Downloading ForgeCode ${version}`);

    await safeInstallBin(downloadedPath, this.binPath);

    logger.check("subdep", `ForgeCode installed to ${this.binPath}`);
  }

  async start(): Promise<void> {
    const args = configService.args;

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting ForgeCode...");

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
          logger.info("component", `ForgeCode exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `ForgeCode failed: ${err}`);
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
      logger.info("component", "ForgeCode stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createForgecodeDependency(): Dependency {
  return new ForgecodeDependency();
}