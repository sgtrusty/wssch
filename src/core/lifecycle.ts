import { spawn } from "node:child_process";
import { mkdir, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";

export async function ensureDirs(): Promise<void> {
  const args = configService.args;
  const paths = configService.paths;

  const dirs = [
    args.targetDir,
    paths.wssBinDir,
    paths.wssCacheDir,
    `${paths.wssCacheDir}/npm`,
    `${paths.wssCacheDir}/node_modules`,
    `${paths.wssCacheDir}/models`,
    `${paths.wssOpencodeConfigDir}`,
    `${paths.wssOpencodeCacheDir}`,
    `${paths.wssDataDir}/mcp`,
    `${paths.wssConfigDir}/rtk`,
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await access(cmd, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function checkBwrap(): Promise<boolean> {
  logger.progress("lifecycle", "Checking bwrap");
  if (await commandExists("/usr/bin/bwrap")) {
    logger.check("lifecycle", "bwrap available");
    return true;
  }
  logger.fail("lifecycle", "bwrap not found in PATH");
  return false;
}

async function checkOpencode(): Promise<boolean> {
  logger.progress("lifecycle", "Checking opencode");
  if (
    (await commandExists("/usr/bin/opencode")) ||
    (await commandExists("/usr/sbin/opencode"))
  ) {
    logger.check("lifecycle", "opencode available");
    return true;
  }
  logger.fail("lifecycle", "opencode binary not found");
  return false;
}

async function checkNode(): Promise<boolean> {
  logger.progress("lifecycle", "Checking node");
  const version = process.version.slice(1).split(".")[0];
  if (parseInt(version) >= 20) {
    logger.check("lifecycle", `node ${process.version} available`);
    return true;
  }
  logger.fail("lifecycle", "node >=20 required");
  return false;
}

export async function preflight(): Promise<boolean> {
  const required = [checkNode()];
  await Promise.all(required);

  checkBwrap();
  checkOpencode();

  const results = await Promise.all(required);
  return results.every((r) => r);
}

export async function initProject(): Promise<void> {
  const paths = configService.paths;
  const args = configService.args;

  logger.info("lifecycle", `Ensuring .wssdata/ in ${paths.wssDataDir}`);
  await ensureDirs();
}