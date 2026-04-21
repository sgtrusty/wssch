import {
  existsSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { logger } from "../lib/logger.js";

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

  addToGitignore(targetDir);

  logger.check("scaffold", `Created .localdata/opencode/ in ${targetDir}`);
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
    logger.fail("scaffold", `Failed to write opencode.json: ${err}`);
    throw err;
  }
}

function addToGitignore(targetDir: string): void {
  const gitignorePath = join(targetDir, ".gitignore");

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".localdata/rag.db")) {
      appendFileSync(gitignorePath, "\n.localdata/rag.db\n");
    }
  }
}
