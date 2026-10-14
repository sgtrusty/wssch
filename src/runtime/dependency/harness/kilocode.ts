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
  extractZip,
  isExecutable,
  getLatestMatchingVersion,
  detectOs,
  detectArch,
  getLibcType,
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

  private buildAssetName(
    os: "linux" | "darwin" | "windows",
    arch: "x86_64" | "aarch64",
    libc: "gnu" | "musl",
    baseline: boolean,
  ): { name: string; isZip: boolean } {
    const archSlug = arch === "x86_64" ? "x64" : "arm64";
    const ext = os === "linux" ? "tar.gz" : "zip";
    const baselineSuffix = baseline ? "-baseline" : "";
    const libcSuffix = os === "linux" && libc === "musl" ? "-musl" : "";
    return {
      name: `kilo-${os}-${archSlug}${baselineSuffix}${libcSuffix}.${ext}`,
      isZip: ext === "zip",
    };
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Kilo Code already installed");
      return;
    }

    const version = await getLatestMatchingVersion(REPO, "v", "v7.5.6");
    const os = detectOs();
    const arch = detectArch();
    const libc = os === "linux" ? await getLibcType() : "gnu";

    const candidate = this.buildAssetName(os, arch, libc, false);
    let url = `https://github.com/${REPO}/releases/download/${version}/${candidate.name}`;
    let asset = candidate;

    logger.progress("subdep", `Downloading Kilo Code from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, asset.name);

    try {
      await downloadUrl(url, archive, `Downloading Kilo Code ${version}`);
    } catch {
      if (os === "linux") {
        const baseline = this.buildAssetName(os, arch, libc, true);
        url = `https://github.com/${REPO}/releases/download/${version}/${baseline.name}`;
        asset = baseline;
        logger.progress(
          "subdep",
          `Falling back to baseline asset: ${baseline.name}`,
        );
        await downloadUrl(url, archive, `Downloading Kilo Code ${version}`);
      } else {
        throw new Error(`No Kilo Code asset available for ${os}/${arch}`);
      }
    }

    if (asset.isZip) {
      const extractDir = join(tempDir, `kilo-extract-${Date.now()}`);
      const { mkdir, rename, rm } = await import("node:fs/promises");
      await mkdir(extractDir, { recursive: true });
      await extractZip(archive, extractDir);

      const extractedBin = join(extractDir, BINARY_NAME);
      if (!(await isExecutable(extractedBin))) {
        await rm(extractDir, { force: true, recursive: true });
        throw new Error("Kilo Code binary not executable after extraction");
      }
      await safeInstallBin(extractedBin, this.binPath);
      await rm(extractDir, { force: true, recursive: true });
    } else {
      const downloadedBin = await extractTar(archive, tempDir, BINARY_NAME);
      if (!(await isExecutable(downloadedBin))) {
        throw new Error("Kilo Code binary not executable after extraction");
      }
      await safeInstallBin(downloadedBin, this.binPath);
    }

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