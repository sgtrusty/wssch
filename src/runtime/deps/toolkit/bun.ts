import { spawn } from "node:child_process";
import { mkdir, access, constants, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "../../../lib/logger.js";
import type { Config } from "../../../lib/config.js";
import type { Dependency } from "../base.js";
import { downloadUrl, extractZip, moveExtractedBin } from "../installUtil.js";

const REPO = "oven-sh/bun";
const DOWNLOAD_HOST = "github.com";
const VERSION_FALLBACK = "1.3.13";

function detectOs(): "linux" | "darwin" {
  return process.platform === "darwin" ? "darwin" : "linux";
}

function detectArch(): "x64" | "aarch64" | string {
  const arch = process.arch as string;
  if (arch === "x64" || arch === "amd64" || arch === "ia32") return "x64";
  if (arch === "arm64" || arch === "aarch64") return "aarch64";
  return arch;
}

function getTarget(os: string, arch: string): string {
  if (os === "linux") {
    if (arch === "x64") return "linux-x64";
    if (arch === "aarch64") return "linux-aarch64-musl";
    throw new Error(`Unsupported arch for linux: ${arch}`);
  }
  if (os === "darwin") {
    if (arch === "x64") return "darwin-x64";
    if (arch === "aarch64") return "darwin-aarch64";
    throw new Error(`Unsupported arch for darwin: ${arch}`);
  }
  throw new Error(`Unsupported OS: ${os}`);
}

async function getLatestVersion(): Promise<string> {
  try {
    const proc = spawn(
      "curl",
      ["-fsSL", `https://api.${REPO}/releases/latest`],
      { stdio: "pipe" },
    );
    const output = await new Promise<string>((resolve, reject) => {
      let data = "";
      proc.stdout?.on("data", (d) => {
        data += d;
      });
      proc.on("close", (code) => (code === 0 ? resolve(data) : reject()));
      proc.on("error", reject);
    });
    const match = output.match(/"tag_name":\s*"bun-v?(\d+\.\d+\.\d+)"/);
    if (match) return match[1];
  } catch {}
  return VERSION_FALLBACK;
}

export class BunDependency implements Dependency {
  readonly name = "Bun (toolkit)";
  readonly binPath: string;

  constructor(private readonly config: Config) {
    this.binPath = `${config.wssBinDir}/bun`;
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
    if (await this.isAvailable()) {
      logger.info("subdep", "Bun already available");
      return;
    }

    logger.info("subdep", "Installing bun...");

    const os = detectOs();
    const arch = detectArch();
    const target = getTarget(os, arch);
    const version = await getLatestVersion();

    const url = `https://${DOWNLOAD_HOST}/${REPO}/releases/download/bun-v${version}/bun-${target}.zip`;
    logger.progress("subdep", `Downloading bun from ${url}`);

    const tempDir = tmpdir();
    const archive = join(tempDir, "bun.zip");

    await downloadUrl(url, archive);

    await extractZip(archive, this.config.wssBinDir);

    const extractedFolder = join(this.config.wssBinDir, `bun-${target}`);
    await moveExtractedBin(extractedFolder, "bun", this.config.wssBinDir);

    logger.check("subdep", `Bun installed to ${this.config.wssBinDir}`);
    await rm(archive, { force: true });
  }

}

export function createBunDependency(config: Config): BunDependency {
  return new BunDependency(config);
}
