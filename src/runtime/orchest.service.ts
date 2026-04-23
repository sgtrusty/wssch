import { logger } from "@lib/logger.js";
import { bridgeService } from "@runtime/bridge.service.js";
import { Dependency } from "@runtime/runtime.interface.js";
import { spawn } from "node:child_process";
import { configService } from "@config/config.service.js";

export class Orchestrator {
  private components: Dependency[] = [];

  constructor() {}

  async start(): Promise<void> {
    logger.info("orchestrator", "Starting orchestrator...");

    if (configService.args.debug) {
      logger.info("orchestrator", "Debug mode: spawning bash...");
      return new Promise((resolve, reject) => {
        const proc = spawn("bash", { cwd: configService.args.targetDir, stdio: "inherit" });
        proc.on("close", (code) => {
          logger.info("orchestrator", `bash exited with code ${code}`);
          resolve();
        });
        proc.on("error", reject);
      });
    }

    this.components = await bridgeService.getDepsFromPreferences();

    for (const comp of this.components) {
      await this.startComponent(comp);
    }

    const mainComp = this.components.find(
      (c) => c.name.toLowerCase() === "opencode",
    );
    if (mainComp?.isRunning?.()) {
      while (mainComp.isRunning?.()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  async stop(): Promise<void> {
    logger.info("orchestrator", "Stopping orchestrator...");

    const stopPromises = this.components
      .filter((c) => c.stop)
      .map((comp) => comp.stop?.());
    await Promise.all(stopPromises);
  }

  getState(): Record<string, boolean> {
    return this.components.reduce(
      (acc, comp) => {
        acc[comp.name] = comp.isRunning?.() ?? false;
        return acc;
      },
      {} as Record<string, boolean>,
    );
  }

  private async startComponent(comp: Dependency): Promise<void> {
    if (!comp.start) return;
    try {
      logger.progress("orchestrator", `Starting ${comp.name}...`);
      await comp.start();
      logger.check("orchestrator", `${comp.name} ready`);
    } catch (err) {
      logger.fail("orchestrator", `${comp.name} failed: ${err}`);
    }
  }
}

export async function createOrchestrator(): Promise<Orchestrator> {
  return new Orchestrator();
}