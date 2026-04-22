import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";

const DB_NAME = "whitelist.db";

export async function initWhitelist(): Promise<void> {
  const paths = configService.paths;
  const dbPath = join(paths.wssConfigDir, DB_NAME);
  await mkdir(paths.wssConfigDir, { recursive: true });

  const initSql = `
    CREATE TABLE IF NOT EXISTS whitelist (
      path TEXT PRIMARY KEY,
      allowed_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `;

  try {
    const proc = spawn("sqlite3", [dbPath, initSql], { stdio: "ignore" });
    await new Promise<void>((resolve) => {
      proc.on("close", (code) => code === 0 ? resolve() : resolve());
      proc.on("error", () => resolve());
    });
  } catch {}
}

export async function isWhitelisted(targetPath: string): Promise<boolean> {
  const paths = configService.paths;
  const dbPath = join(paths.wssConfigDir, DB_NAME);
  const now = Math.floor(Date.now() / 1000);

  try {
    const proc = spawn("sqlite3", [
      dbPath,
      `SELECT 1 FROM whitelist WHERE path = '${targetPath}' AND expires_at > ${now} LIMIT 1;`,
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

export async function addToWhitelist(targetPath: string): Promise<void> {
  const paths = configService.paths;
  const args = configService.args;
  const dbPath = join(paths.wssConfigDir, DB_NAME);
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + (args.whitelistHours * 3600);

  try {
    const proc = spawn("sqlite3", [dbPath, `
      INSERT OR REPLACE INTO whitelist (path, allowed_at, expires_at)
      VALUES ('${targetPath}', ${now}, ${expiry});
    `], { stdio: "ignore" });

    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {}
}

export async function verifyDirectory(): Promise<boolean> {
  const args = configService.args;

  if (args.force) {
    logger.warn("hook", "FORCE enabled, skipping verification");
    return true;
  }

  if (await isWhitelisted(args.targetDir)) {
    logger.check("hook", `Directory already whitelisted: ${args.targetDir}`);
    return true;
  }

  logger.info("hook", `Verifying directory: ${args.targetDir}`);
  
  if (!process.stdin.isTTY) {
    logger.fail("hook", "Directory not verified (non-interactive)");
    return false;
  }

  logger.info("hook", "Auto-whitelisting directory (dev mode)");
  await addToWhitelist(args.targetDir);
  logger.check("hook", `Directory whitelisted: ${args.targetDir}`);
  return true;
}