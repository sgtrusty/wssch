import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  safeInstallBin,
  downloadUrl,
  isExecutable,
  getLatestVersion,
  detectOs,
  detectArch,
} from "@runtime/dependency.util.js";

const REPO = "charmbracelet/crush";
const BINARY_NAME = "crush";

export class CrushDependency implements Dependency {
  readonly name = "Crush";
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
    const osMap: Record<string, string> = {
      linux: "Linux",
      darwin: "Darwin",
      windows: "Windows",
    };
    const archMap: Record<string, string> = {
      x86_64: "x86_64",
      aarch64: "aarch64",
    };
    const v = version.replace(/^v/, "");
    return `https://github.com/${REPO}/releases/download/${version}/crush_${v}_${osMap[os]}_${archMap[arch]}.tar.gz`;
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Crush already installed");
      return;
    }

    const version = await getLatestVersion(REPO, "v0.81.0");
    const url = this.buildAssetUrl(version);

    logger.progress("subdep", `Downloading Crush from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, `${BINARY_NAME}.tar.gz`);
    await downloadUrl(url, archive, `Downloading Crush ${version}`);

    // Crush archive contains a subdirectory like crush_0.81.0_Linux_x86_64/crush
    // Use --strip-components=1 to flatten
    const extractDir = join(tmpdir(), `crush-${Date.now()}`);
    await mkdir(extractDir, { recursive: true });

    const proc = spawn("tar", ["-xzf", archive, "--strip-components=1", "-C", extractDir], { stdio: "pipe" });
    const code = await new Promise<number>((resolve) => {
      proc.on("close", (code) => resolve(code ?? 1));
      proc.on("error", () => resolve(1));
    });

    if (code !== 0) {
      throw new Error("Failed to extract Crush archive");
    }

    const downloadedBin = join(extractDir, BINARY_NAME);
    if (!(await isExecutable(downloadedBin))) {
      throw new Error("Crush binary not executable after extraction");
    }

    await safeInstallBin(downloadedBin, this.binPath);

    logger.check("subdep", `Crush installed to ${this.binPath}`);
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info("component", "Crush is already running.");
      return;
    }

    const args = configService.args;

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting Crush...");

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
          logger.info("component", `Crush exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `Crush failed: ${err}`);
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
      logger.info("component", "Crush stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createCrushDependency(): Dependency {
  return new CrushDependency();
}