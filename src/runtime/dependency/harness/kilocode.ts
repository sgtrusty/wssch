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
  isExecutable,
  getLatestVersion,
  detectOs,
  detectArch,
} from "@runtime/dependency.util.js";

const REPO = "Kilo-Org/kilocode";
const BINARY_NAME = "kilo";

export class KilocodeDependency implements Dependency {
  readonly name = "KiloCode";
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

  private buildAssetUrl(version: string): string {
    const os = detectOs();
    const arch = detectArch();
    const archMap: Record<string, string> = {
      x86_64: "x64",
      aarch64: "aarch64",
    };
    return `https://github.com/${REPO}/releases/download/${version}/kilo-${os}-${archMap[arch]}.tar.gz`;
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Kilo Code already installed");
      return;
    }

    const version = await getLatestVersion(REPO, "v7.4.1");
    const url = this.buildAssetUrl(version);

    logger.progress("subdep", `Downloading Kilo Code from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, `${BINARY_NAME}.tar.gz`);
    await downloadUrl(url, archive, `Downloading Kilo Code ${version}`);

    const downloadedBin = await extractTar(archive, tempDir, BINARY_NAME);
    if (!(await isExecutable(downloadedBin))) {
      throw new Error("Kilo Code binary not executable after extraction");
    }

    await safeInstallBin(downloadedBin, this.binPath);

    logger.check("subdep", `Kilo Code installed to ${this.binPath}`);
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info("component", "Kilo Code is already running.");
      return;
    }

    const args = configService.args;

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting Kilo Code...");

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
          logger.info("component", `Kilo Code exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `Kilo Code failed: ${err}`);
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
      logger.info("component", "Kilo Code stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createKilocodeDependency(): Dependency {
  return new KilocodeDependency();
}
