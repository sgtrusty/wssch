import { spawn } from "node:child_process";
import { mkdir, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../lib/logger.js";
import type { Config } from "../lib/config.js";

export async function ensureDirs(config: Config): Promise<void> {
  const dirs = [
    config.wssBinDir,
    config.wssCacheDir,
    `${config.wssCacheDir}/npm`,
    `${config.wssCacheDir}/node_modules`,
    `${config.wssCacheDir}/models`,
    `${config.wssConfigDir}/opencode-config`,
    `${config.wssConfigDir}/opencode-share`,
    `${config.wssDataDir}/mcp`,
    `${config.wssConfigDir}/rtk`,
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

export async function preflight(config: Config): Promise<boolean> {
  const required = [checkNode()];
  await Promise.all(required);

  checkBwrap();
  checkOpencode();

  const results = await Promise.all(required);
  return results.every((r) => r);
}

export async function initProject(config: Config): Promise<void> {
  logger.info("lifecycle", `Ensuring .wssdata/ in ${config.targetDir}`);
  await ensureDirs(config);
}

