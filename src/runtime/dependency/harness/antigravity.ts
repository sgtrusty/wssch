import { spawn, ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { copyFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import { isExecutable } from "@runtime/dependency.util.js";

// Antigravity CLI is closed-source (no public GitHub releases to pull from),
// so we install it the same way Google documents: via its own install script.
// See: https://antigravity.google/cli/install.sh
const INSTALL_SCRIPT_URL = "https://antigravity.google/cli/install.sh";
const BINARY_NAME = "agy";

export class AntigravityDependency implements Dependency {
  readonly name = "Antigravity CLI";
  readonly binPath: string;
  private process: ChildProcess | null = null;
  private exitResolve: (() => void) | null = null;
  private exitPromise: Promise<void> | null = null;

  constructor() {
    // The official install script drops the binary in ~/.local/bin regardless
    // of target project, so we point at it there rather than wssBinDir.
    this.binPath = join(configService.paths.wssBinDir, BINARY_NAME);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await isExecutable(this.binPath);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Antigravity CLI already installed");
      return;
    }

    logger.progress(
      "subdep",
      `Installing Antigravity CLI from ${INSTALL_SCRIPT_URL}`,
    );

    const defaultInstallPath = join(homedir(), ".local", "bin", BINARY_NAME);

    await new Promise<void>((resolve, reject) => {
      const curl = spawn("curl", ["-fsSL", INSTALL_SCRIPT_URL], {
        stdio: ["ignore", "pipe", "inherit"],
      });
      const bash = spawn("bash", [], { stdio: ["pipe", "inherit", "inherit"] });

      curl.stdout.pipe(bash.stdin);

      bash.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`Antigravity CLI install script exited with ${code}`),
            ),
      );
      bash.on("error", reject);
      curl.on("error", reject);
    });

    // Move the binary from its default location to your managed wssBinDir
    try {
      await copyFile(defaultInstallPath, this.binPath);
      await unlink(defaultInstallPath);
    } catch (err) {
      throw new Error(
        `Failed to move Antigravity CLI to ${this.binPath}: ${err}`,
      );
    }

    if (!(await this.isAvailable())) {
      throw new Error(
        `Antigravity CLI binary not found at ${this.binPath} after install`,
      );
    }

    logger.check("subdep", `Antigravity CLI installed to ${this.binPath}`);
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info("component", "Antigravity CLI is already running.");
      return;
    }

    const args = configService.args;

    if (!process.env.ANTIGRAVITY_API_KEY) {
      logger.info(
        "component",
        "ANTIGRAVITY_API_KEY not set — Antigravity CLI will fall back to " +
          "interactive Google sign-in, or you can export a free key from " +
          "aistudio.google.com/apikey.",
      );
    }

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting Antigravity CLI...");

        this.process = spawn(this.binPath, {
          cwd: args.targetDir,
          stdio: "inherit",
          env: {
            ...process.env,
            HOME: "/home/user",
            TERM: process.env.TERM || "xterm",
            ANTIGRAVITY_API_KEY: process.env.ANTIGRAVITY_API_KEY || "",
          },
        });

        this.process.on("exit", (code) => {
          logger.info("component", `Antigravity CLI exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `Antigravity CLI failed: ${err}`);
        if (this.exitResolve) {
          this.exitResolve();
        }
      }
    });

    await this.exitPromise;
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      this.process = null;
      logger.info("component", "Antigravity CLI stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createAntigravityDependency(): Dependency {
  return new AntigravityDependency();
}
