import { spawn } from "node:child_process";
import { mkdir, access, constants, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  downloadUrl,
  extractZip,
  moveExtractedBin,
  detectOs,
  detectArch,
  getLatestVersion,
} from "@runtime/dependency.util.js";

const REPO = "oven-sh/bun";
const VERSION_FALLBACK = "1.3.13";

function getTarget(os: string, arch: string): string {
  if (os === "linux") {
    if (arch === "x86_64") return "linux-x64";
    if (arch === "aarch64") return "linux-aarch64-musl";
    throw new Error(`Unsupported arch for linux: ${arch}`);
  }
  if (os === "darwin") {
    if (arch === "x86_64") return "darwin-x64";
    if (arch === "aarch64") return "darwin-arm64";
    throw new Error(`Unsupported arch for darwin: ${arch}`);
  }
  if (os === "windows") {
    return "windows-x64";
  }
  throw new Error(`Unsupported OS: ${os}`);
}

export class BunDependency implements Dependency {
  readonly name = "Bun (toolkit)";
  readonly binPath: string;

  constructor() {
    this.binPath = `${configService.paths.wssBinDir}/bun`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await access("/usr/bin/bun", constants.X_OK);
      return true;
    } catch {}

    try {
      await access(this.binPath, constants.X_OK);
      return true;
    } catch {}

    return false;
  }

  async install(): Promise<void> {
    const paths = configService.paths;

    if (await this.isAvailable()) {
      logger.info("subdep", "Bun already available");
      return;
    }

    logger.info("subdep", "Installing bun...");

    const os = detectOs();
    const arch = detectArch();
    const target = getTarget(os, arch);
    const version = await getLatestVersion(REPO, VERSION_FALLBACK);

    const url = `https://github.com/${REPO}/releases/download/bun-v${version}/bun-${target}.zip`;
    logger.progress("subdep", `Downloading bun from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, "bun.zip");

    await downloadUrl(url, archive);

    await extractZip(archive, paths.wssBinDir);

    const extractedFolder = join(paths.wssBinDir, `bun-${target}`);
    await moveExtractedBin(extractedFolder, "bun", paths.wssBinDir);

    logger.check("subdep", `Bun installed to ${paths.wssBinDir}`);
    await rm(archive, { force: true });
  }
}

export function createBunDependency(): BunDependency {
  return new BunDependency();
}