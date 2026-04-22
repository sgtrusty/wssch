import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { configService } from "@config/index.js";

const DB_NAME = "pref.db";

export interface Preferences {
  preferredMcpServer: string;
  tokenOptimizatorAlgo: string[];
  toolkit: string;
  agentic: string;
  ollamaUrl: string;
  embeddingModel: string;
  initializedAt: number;
  initialCheck: boolean;
  updatedAt: number;
}

const DEFAULT_PREFERENCES: Omit<
  Preferences,
  "initializedAt" | "initialCheck" | "updatedAt"
> = {
  preferredMcpServer: "local",
  tokenOptimizatorAlgo: ["RAG"],
  toolkit: "bun",
  agentic: "opencode",
  ollamaUrl: "http://localhost:11434",
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
};

function getDbPath(): string {
  return join(configService.paths.wssDataDir, DB_NAME);
}

export async function initPreferences(): Promise<void> {
  const paths = configService.paths;
  await mkdir(paths.wssDataDir, { recursive: true });
  const dbPath = getDbPath();

  const initSql = `
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

  try {
    const proc = spawn("sqlite3", [dbPath, initSql], { stdio: "ignore" });
    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {}

  const now = Math.floor(Date.now() / 1000);
  for (const [key, value] of Object.entries(DEFAULT_PREFERENCES)) {
    const val =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    try {
      const proc = spawn(
        "sqlite3",
        [
          dbPath,
          `INSERT OR IGNORE INTO preferences (key, value) VALUES ('${key}', '${val}');`,
        ],
        { stdio: "ignore" },
      );
      await new Promise<void>((resolve) => {
        proc.on("close", () => resolve());
        proc.on("error", () => resolve());
      });
    } catch {}
  }

  try {
    const proc = spawn(
      "sqlite3",
      [
        dbPath,
        `INSERT OR IGNORE INTO preferences (key, value) VALUES ('initializedAt', '${now}');`,
      ],
      { stdio: "ignore" },
    );
    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {}

  try {
    const proc = spawn(
      "sqlite3",
      [
        dbPath,
        `INSERT OR IGNORE INTO preferences (key, value) VALUES ('updatedAt', '${now}');`,
      ],
      { stdio: "ignore" },
    );
    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {}
}

export async function getPreferences(): Promise<Preferences> {
  const dbPath = getDbPath();
  const prefs: Record<string, string> = {};

  try {
    const proc = spawn(
      "sqlite3",
      [dbPath, "SELECT key, value FROM preferences;"],
      {
        stdio: "pipe",
      },
    );

    const output = await new Promise<string>((resolve) => {
      let data = "";
      proc.stdout?.on("data", (d) => {
        data += d;
      });
      proc.on("close", () => resolve(data));
    });

    for (const line of output.trim().split("\n")) {
      if (!line.includes("|")) continue;
      const idx = line.indexOf("|");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) prefs[key] = value;
    }
  } catch {}

  return {
    preferredMcpServer: prefs.preferredMcpServer || "local",
    tokenOptimizatorAlgo: prefs.tokenOptimizatorAlgo
      ? JSON.parse(prefs.tokenOptimizatorAlgo)
      : ["RAG"],
    toolkit: prefs.toolkit || "bun",
    agentic: prefs.agentic || "opencode",
    ollamaUrl: prefs.ollamaUrl || "http://192.168.1.50:11434",
    embeddingModel: prefs.embeddingModel || "lco-embedding-omni-gguf",
    initializedAt: parseInt(prefs.initializedAt || "0"),
    initialCheck: prefs.initialCheck === "true",
    updatedAt: parseInt(prefs.updatedAt || "0"),
  };
}

export async function updatePreferences(
  updates: Partial<Preferences>,
): Promise<void> {
  const dbPath = getDbPath();
  const now = Math.floor(Date.now() / 1000);

  for (const [key, value] of Object.entries(updates)) {
    if (key === "initializedAt") continue;
    const val =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    try {
      const proc = spawn(
        "sqlite3",
        [
          dbPath,
          `INSERT OR REPLACE INTO preferences (key, value) VALUES ('${key}', '${val}');`,
        ],
        { stdio: "ignore" },
      );
      await new Promise<void>((resolve) => {
        proc.on("close", () => resolve());
        proc.on("error", () => resolve());
      });
    } catch {}
  }

  try {
    const proc = spawn(
      "sqlite3",
      [
        dbPath,
        `INSERT OR REPLACE INTO preferences (key, value) VALUES ('updatedAt', '${now}');`,
      ],
      { stdio: "ignore" },
    );
    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {}
}

export async function isPreferencesInitialized(): Promise<boolean> {
  const dbPath = getDbPath();

  try {
    const proc = spawn(
      "sqlite3",
      [dbPath, "SELECT value FROM preferences WHERE key = 'initializedAt';"],
      { stdio: "pipe" },
    );

    const output = await new Promise<string>((resolve) => {
      let data = "";
      proc.stdout?.on("data", (d) => {
        data += d;
      });
      proc.on("close", () => resolve(data));
    });

    return output.trim().length > 0;
  } catch {
    return false;
  }
}

export async function isInitialCheckComplete(): Promise<boolean> {
  const dbPath = getDbPath();

  try {
    const proc = spawn(
      "sqlite3",
      [dbPath, "SELECT value FROM preferences WHERE key = 'initialCheck';"],
      { stdio: "pipe" },
    );

    const output = await new Promise<string>((resolve) => {
      let data = "";
      proc.stdout?.on("data", (d) => {
        data += d;
      });
      proc.on("close", () => resolve(data));
    });

    return output.trim() === "true";
  } catch {
    return false;
  }
}

