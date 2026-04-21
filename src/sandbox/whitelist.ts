import { spawn } from "node:child_process";
import { mkdir, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../lib/logger.js";
import type { Config } from "../lib/config.js";

const DB_NAME = "whitelist.db";

export async function initWhitelist(config: Config): Promise<void> {
  const dbPath = join(config.wssConfigDir, DB_NAME);
  await mkdir(config.wssConfigDir, { recursive: true });

  const initSql = `
    CREATE TABLE IF NOT EXISTS whitelist (
      path TEXT PRIMARY KEY,
      allowed_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `;

  try {
    const proc = spawn("sqlite3", [dbPath, initSql], { stdio: "ignore" });
    await new Promise<void>((resolve, reject) => {
      proc.on("close", (code) => code === 0 ? resolve() : resolve());
      proc.on("error", () => resolve());
    });
  } catch { }
}

export async function isWhitelisted(config: Config, targetPath: string): Promise<boolean> {
  const dbPath = join(config.wssConfigDir, DB_NAME);
  const now = Math.floor(Date.now() / 1000);

  try {
    const proc = spawn("sqlite3", [
      dbPath,
      `SELECT 1 FROM whitelist WHERE path = '${targetPath}' AND expires_at > ${now} LIMIT 1;`
    ], { stdio: "pipe" });

    const output = await new Promise<string>((resolve) => {
      let data = "";
      proc.stdout?.on("data", (d) => { data += d; });
      proc.on("close", () => resolve(data));
    });

    return output.trim() === "1";
  } catch {
    return false;
  }
}

export async function addToWhitelist(config: Config, targetPath: string): Promise<void> {
  const dbPath = join(config.wssConfigDir, DB_NAME);
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + (config.whitelistHours * 3600);

  try {
    const proc = spawn("sqlite3", [dbPath, `
      INSERT OR REPLACE INTO whitelist (path, allowed_at, expires_at)
      VALUES ('${targetPath}', ${now}, ${expiry});
    `], { stdio: "ignore" });

    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch { }
}

export async function verifyDirectory(config: Config): Promise<boolean> {
  const { targetDir } = config;

  if (config.force) {
    logger.warn("hook", "FORCE enabled, skipping verification");
    return true;
  }

  if (await isWhitelisted(config, targetDir)) {
    logger.check("hook", `Directory already whitelisted: ${targetDir}`);
    return true;
  }

  logger.info("hook", `Verifying directory: ${targetDir}`);
  
  // In non-interactive mode, reject
  if (!process.stdin.isTTY) {
    logger.fail("hook", "Directory not verified (non-interactive)");
    return false;
  }

  // For now, auto-whitelist in dev mode. In production, would use whiptail
  logger.info("hook", "Auto-whitelisting directory (dev mode)");
  await addToWhitelist(config, targetDir);
  logger.check("hook", `Directory whitelisted: ${targetDir}`);
  return true;
}