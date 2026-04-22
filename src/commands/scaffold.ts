import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";

export interface ScaffoldConfig {
  targetDir: string;
  opencodeDir: string;
  wssConfigDir: string;
  wssBinDir: string;
  noRtk: boolean;
  noRag: boolean;
}

export async function scaffold(config: ScaffoldConfig): Promise<void> {
  const { targetDir, opencodeDir, noRag } = config;

  if (!existsSync(opencodeDir)) {
    mkdirSync(opencodeDir, { recursive: true });
  }

  scaffoldOpencodeJson(opencodeDir, noRag);

  const wssDataDir = join(targetDir, ".wssdata");
  if (!existsSync(wssDataDir)) {
    mkdirSync(wssDataDir, { recursive: true });
  }
  scaffoldWssdataGitignore(wssDataDir);

  logger.check("scaffold", `Created initial scaffold at ${targetDir}`);
}

function scaffoldWssdataGitignore(wssDataDir: string): void {
  const gitignorePath = join(wssDataDir, ".gitignore");
  const content = `*`;

  try {
    writeFileSync(gitignorePath, content);
    logger.info("scaffold", `Wrote .gitignore to ${gitignorePath}`);
  } catch (err) {
    logger.warn("scaffold", "Failed to write .gitignore: " + err);
  }
}

function scaffoldOpencodeJson(opencodeDir: string, noRag: boolean): void {
  const cfg: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    mcp: {},
  };

  try {
    const jsonPath = join(opencodeDir, "opencode.json");
    writeFileSync(jsonPath, JSON.stringify(cfg, null, 2));
    logger.info("scaffold", `Wrote opencode.json to ${jsonPath}`);
  } catch (err) {
    logger.fail("scaffold", "Failed to write opencode.json: " + err);
    throw err;
  }
}

