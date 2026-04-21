import { spawn, ChildProcess } from "node:child_process";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { LifecycleComponent } from "../dep.interface.js";

const OPENCODE_BIN = "/usr/sbin/opencode";

export class OpencodeComponent implements LifecycleComponent {
  readonly name = "OpenCode";
  private process: ChildProcess | null = null;
  private exitResolve: (() => void) | null = null;
  private exitPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    const args = configService.args;

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting OpenCode...");

        this.process = spawn(OPENCODE_BIN, {
          cwd: args.targetDir,
          stdio: "inherit",
          env: {
            ...process.env,
            HOME: "/home/user",
            TERM: process.env.TERM || "xterm",
          },
        });

        this.process.on("exit", (code) => {
          logger.info("component", `OpenCode exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `OpenCode failed: ${err}`);
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
      logger.info("component", "OpenCode stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createOpencodeComponent(): LifecycleComponent {
  return new OpencodeComponent();
}