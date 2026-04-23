import { copyFile, chmod, rm, mkdir, rename } from "node:fs/promises";
import { access, constants } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";

export function detectOs(): "linux" | "darwin" | "windows" {
  const platform = process.platform;
  if (platform === "darwin") return "darwin";
  if (platform === "win32") return "windows";
  return "linux";
}

export function detectArch(): "x86_64" | "aarch64" {
  const arch = process.arch as string;
  if (arch === "x64" || arch === "amd64" || arch === "ia32") return "x86_64";
  if (arch === "arm64" || arch === "aarch64" || arch === "arm") return "aarch64";
  throw new Error(`Unsupported architecture: ${arch}`);
}

export async function getLibcType(): Promise<"gnu" | "musl"> {
  try {
    const proc = spawn("ldd", ["--version"], { stdio: "pipe" });
    const output = await new Promise<string>((resolve, reject) => {
      let data = "";
      proc.stdout?.on("data", (d) => { data += d; });
      proc.on("close", () => resolve(data));
      proc.on("error", reject);
    });

    if (output.toLowerCase().includes("musl")) return "musl";

    const match = output.match(/(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1]);
      const minor = parseInt(match[2]);
      if (major > 2 || (major === 2 && minor >= 39)) return "gnu";
    }
  } catch {}
  return "gnu";
}

export async function getForgeTarget(): Promise<string> {
  const os = detectOs();
  const arch = detectArch();

  if (os === "windows") return `${arch}-pc-windows-msvc`;
  if (os === "darwin") return `${arch}-apple-darwin`;

  const libc = await getLibcType();
  return `${arch}-unknown-linux-${libc}`;
}

export async function getLatestVersion(repo: string, fallback: string): Promise<string> {
  try {
    const proc = spawn(
      "curl",
      ["-fsSL", `https://api.github.com/repos/${repo}/releases/latest`],
      { stdio: "pipe" },
    );
    const output = await new Promise<string>((resolve, reject) => {
      let data = "";
      proc.stdout?.on("data", (d) => { data += d; });
      proc.on("close", (code) => (code === 0 ? resolve(data) : reject()));
      proc.on("error", reject);
    });
    const match = output.match(/"tag_name":\s*"v?([^"]+)"/);
    if (match) return `v${match[1]}`;
  } catch {}
  return fallback;
}

export async function safeInstallBin(
  downloadedPath: string,
  destPath: string,
  mode: number = 0o755,
): Promise<void> {
  const destDir = dirname(destPath);
  await mkdir(destDir, { recursive: true });

  try {
    await rename(downloadedPath, destPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") {
      throw err;
    }
    await copyFile(downloadedPath, destPath);
    await rm(downloadedPath, { force: true });
  }

  await chmod(destPath, mode);
}

export async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function downloadUrl(
  url: string,
  destPath: string,
  progressMsg?: string,
): Promise<void> {
  if (progressMsg) {
    logger.progress("subdep", progressMsg);
  }

  const curl = spawn("curl", ["-fsSL", url, "-o", destPath]);
  await new Promise<void>((resolve, reject) => {
    curl.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl exited with ${code}`));
    });
    curl.on("error", reject);
  });
}

export async function extractTar(
  archivePath: string,
  destDir: string,
  filename: string,
): Promise<string> {
  const tar = spawn("tar", ["-xzf", archivePath, "-C", destDir]);
  await new Promise<void>((resolve, reject) => {
    tar.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with ${code}`));
    });
    tar.on("error", reject);
  });
  return `${destDir}/${filename}`;
}

export async function extractZip(
  archivePath: string,
  destDir: string,
): Promise<void> {
  const unzip = spawn("unzip", ["-o", archivePath, "-d", destDir]);
  await new Promise<void>((resolve, reject) => {
    unzip.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`unzip exited with ${code}`));
    });
    unzip.on("error", reject);
  });
}

export async function moveExtractedBin(
  extractedFolder: string,
  binName: string,
  destDir: string,
): Promise<string> {
  const extractedBin = join(extractedFolder, binName);
  const finalBin = join(destDir, binName);
  await rename(extractedBin, finalBin);
  await rm(extractedFolder, { force: true, recursive: true });
  return finalBin;
}

