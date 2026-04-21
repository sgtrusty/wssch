import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { ComponentState } from "@core/types.js";
import type { LifecycleComponent } from "./deps/dep.interface.js";
import { createOpencodeComponent } from "./deps/agentic/opencode.js";
import { createLocalRagClient } from "./deps/mcp/localRag.js";
import { RtkClient } from "./deps/optimizer/rtk.js";

export class Orchestrator {
  private state: ComponentState = {
    mcp: "stopped",
    rtk: "stopped",
    opencode: "stopped",
  };
  private components: LifecycleComponent[] = [];

  constructor() {}

  async start(): Promise<void> {
    logger.info("orchestrator", "Starting orchestrator...");

    const runtime = configService.runtime;

    for (const compName of runtime.components) {
      if (compName === "rtk") {
        this.components.push(new RtkLifecycleComponent());
      } else if (compName === "mcp") {
        this.components.push(createLocalRagClient());
      } else if (compName === "opencode") {
        this.components.push(createOpencodeComponent());
      }
    }

    for (const comp of this.components) {
      await this.startComponent(comp);
    }

    const mainComp = this.components.find(
      (c) => c.name.toLowerCase() === "opencode",
    );
    if (mainComp) {
      while (mainComp.isRunning()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  async stop(): Promise<void> {
    logger.info("orchestrator", "Stopping orchestrator...");

    const stopPromises = this.components.map((comp) => comp.stop());
    await Promise.all(stopPromises);

    this.state = { mcp: "stopped", rtk: "stopped", opencode: "stopped" };
  }

  getState(): ComponentState {
    return { ...this.state };
  }

  private async startComponent(comp: LifecycleComponent): Promise<void> {
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

class RtkLifecycleComponent implements LifecycleComponent {
  readonly name = "RTK";
  private client: RtkClient | null = null;
  private _isRunning = false;

  async start(): Promise<void> {
    const paths = configService.paths;
    this.client = new RtkClient(`${paths.wssBinDir}/rtk`);

    try {
      const available = await this.client.check();
      if (available) {
        this._isRunning = true;
        logger.check("component", "RTK ready");
      } else {
        logger.warn("component", "RTK not available");
      }
    } catch (err) {
      logger.warn("component", `RTK check failed: ${err}`);
    }
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    this.client = null;
  }

  isRunning(): boolean {
    return this._isRunning;
  }
}

export async function createOrchestrator(): Promise<Orchestrator> {
  return new Orchestrator();
}

