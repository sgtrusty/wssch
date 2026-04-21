import { logger } from "@lib/logger.js";
import type { ComponentState } from "@core/types.js";
import { bridgeService } from "@runtime/bridge.service.js";
import { Dependency } from "@runtime/dependency/dependency.interface.js";

export class Orchestrator {
  private state: ComponentState = {
    mcp: "stopped",
    rtk: "stopped",
    opencode: "stopped",
  };
  private components: Dependency[] = [];

  constructor() {}

  async start(): Promise<void> {
    logger.info("orchestrator", "Starting orchestrator...");

    this.components = bridgeService.getDeps();

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

    this.state = { mcp: "stopped", rtk: "stopped", opencode: "stopped" };
  }

  getState(): ComponentState {
    return { ...this.state };
  }

  private async startComponent(comp: Dependency): Promise<void> {
    if (!comp.start) return;
    try {
      this.state = this.updateState(comp.name, "starting");
      logger.progress("orchestrator", `Starting ${comp.name}...`);
      await comp.start();
      this.state = this.updateState(comp.name, "running");
      logger.check("orchestrator", `${comp.name} ready`);
    } catch (err) {
      this.state = this.updateState(comp.name, "error");
      logger.fail("orchestrator", `${comp.name} failed: ${err}`);
    }
  }

  private updateState(
    name: string,
    status: ComponentState[keyof ComponentState],
  ): ComponentState {
    const key = name.toLowerCase() as keyof ComponentState;
    if (key in this.state) {
      return { ...this.state, [key]: status };
    }
    return this.state;
  }
}

export async function createOrchestrator(): Promise<Orchestrator> {
  return new Orchestrator();
}
