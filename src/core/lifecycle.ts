import { mkdir, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import { HARNESS_OPTIONS } from "@runtime/dependency.enum.js";

export async function ensureDirs(): Promise<void> {
  const args = configService.args;
  const paths = configService.paths;
  const inSandbox = process.env.WSS_IN_SANDBOX === "true";

  const harnessName = configService.args.harnessOverride || HARNESS_OPTIONS[0].name;
  const { configDir: relConfigDir, cacheDir: relCacheDir } = configService.getHarnessPaths(harnessName);

  const dirs = [
    args.targetDir,
    paths.wssBinDir,
    `${paths.wssDataDir}/mcp`,
    inSandbox
      ? join(homedir(), relConfigDir)
      : join(paths.wssConfigDir, "data", "config", harnessName),
    inSandbox
      ? join(homedir(), relCacheDir)
      : join(paths.wssConfigDir, "data", "share", harnessName),
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

  const results = await Promise.all(required);
  return results.every((r) => r);
}

export async function initProject(): Promise<void> {
  const paths = configService.paths;
  const args = configService.args;

  logger.info("lifecycle", `Ensuring .wssdata/ in ${paths.wssDataDir}`);
  await ensureDirs();
}
