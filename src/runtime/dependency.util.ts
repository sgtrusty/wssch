import { copyFile, chmod, rm, mkdir, rename } from "node:fs/promises";
import { access, constants } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { logger } from "@lib/logger.js";

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

