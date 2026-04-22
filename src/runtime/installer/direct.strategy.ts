import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdir, access, constants, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import type { InstallerStrategy, RunCommandOptions } from "./installer.interface.js";

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(
  cmd: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit", ...options });
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} failed with ${code}`)),
    );
    proc.on("error", reject);
  });
}

async function extractTarball(
  archivePath: string,
  destDir: string,
  stripComponents: number = 1,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["-xzf", archivePath, "--strip-components=" + stripComponents, "-C", destDir];
    const proc = spawn("tar", args);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`tar failed`)),
    );
    proc.on("error", reject);
  });
}

export class DirectInstallerStrategy implements InstallerStrategy {
  readonly name = "direct";
  private downloadUrl: string;
  private expectedBinName: string;

  constructor(downloadUrl: string, expectedBinName: string) {
    this.downloadUrl = downloadUrl;
    this.expectedBinName = expectedBinName;
  }

  async isInstalled(binPath: string): Promise<boolean> {
    return isExecutable(binPath);
  }

  async install(binPath: string): Promise<void> {
    if (await this.isInstalled(binPath)) {
      logger.info("subdep", `${this.expectedBinName} already installed`);
      return;
    }

    const binDir = join(binPath, "..");
    logger.info("subdep", `Installing ${this.expectedBinName}...`);

    await mkdir(binDir, { recursive: true });

    const tempDir = tmpdir();
    const archivePath = join(tempDir, `${this.expectedBinName}.tar.gz`);

    logger.progress("subdep", `Downloading ${this.downloadUrl}`);
    await runCommand("curl", ["-fsSL", "-o", archivePath, this.downloadUrl]);

    const downloadedBin = join(tempDir, this.expectedBinName);
    await extractTarball(archivePath, tempDir);

    if (!existsSync(downloadedBin)) {
      throw new Error(`${this.expectedBinName} not found after extraction`);
    }

    await safeInstallBin(downloadedBin, binPath);
    await rm(archivePath, { force: true });

    logger.check("subdep", `${this.expectedBinName} installed to ${binDir}`);
  }
}

async function safeInstallBin(srcPath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("install", [srcPath, destPath]);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`install failed with ${code}`)),
    );
    proc.on("error", reject);
  });
}