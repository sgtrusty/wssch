import { spawn, ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { logger } from "../lib/logger.js";
import type { WssConfig, ComponentState } from "../core/types.js";
import { createDepsInstaller, DepsInstaller } from "./deps/installer.js";
import type { RuntimeComponent } from "./deps/base.js";
import { RtkClient } from "./deps/optimizer/rtk.js";

const COMPONENT_BIN_PATHS = {
  // opencode: "/usr/sbin/opencode",
  opencode: "bash",
} as const;

export class Orchestrator {
  private config: WssConfig;
  private state: ComponentState = {
    mcp: "stopped",
    rtk: "stopped",
    opencode: "stopped",
  };
  private processes: Map<string, ChildProcess> = new Map();
  private rtkClient: RtkClient | null = null;
  private localRag: RuntimeComponent | null = null;
  private depsInstaller: DepsInstaller | null = null;

  constructor(config: WssConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    logger.info("orchestrator", "Starting orchestrator...");

    await this.ensureDirs();
    await this.initDeps();

    const setupPromises: Promise<void>[] = [];

    if (!this.config.noRtk) {
      setupPromises.push(this.startRtk());
    } else {
      logger.info("orchestrator", "RTK disabled");
      this.state.rtk = "stopped";
    }

    if (!this.config.noRag) {
      if (this.config.opencodeManagesMcp) {
        this.state.mcp = "stopped";
      } else {
        setupPromises.push(this.startMcp());
      }
    } else {
      logger.info("orchestrator", "MCP (RAG) disabled");
      this.state.mcp = "stopped";
    }

    await Promise.all(setupPromises);

    await this.startOpencode();
  }

  async stop(): Promise<void> {
    logger.info("orchestrator", "Stopping orchestrator...");

    if (this.localRag) {
      await this.localRag.stop();
    }

    for (const [name, proc] of this.processes) {
      if (proc && !proc.killed) {
        proc.kill("SIGTERM");
        logger.check("orchestrator", `Stopped ${name}`);
      }
    }
    this.processes.clear();
    this.state = { mcp: "stopped", rtk: "stopped", opencode: "stopped" };
  }

  getState(): ComponentState {
    return { ...this.state };
  }

  getRtkClient(): RtkClient | null {
    return this.rtkClient;
  }

  private async initDeps(): Promise<void> {
    this.depsInstaller = createDepsInstaller(this.config as any);
    await this.depsInstaller.installAll();
    this.rtkClient = await this.depsInstaller.getRtkClient();
  }

  private async ensureDirs(): Promise<void> {
    const dirs = [
      this.config.handlerDir,
      this.config.targetDir,
      this.config.wssConfigDir,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async startRtk(): Promise<void> {
    if (!this.rtkClient) {
      logger.info("orchestrator", "RTK not available");
      this.state.rtk = "stopped";
      return;
    }

    try {
      this.state.rtk = "starting";
      logger.progress("orchestrator", "Checking RTK...");

      const available = await this.rtkClient.check();
      if (available) {
        this.state.rtk = "running";
        logger.check("orchestrator", "RTK ready");
      } else {
        this.state.rtk = "error";
        logger.warn("orchestrator", "RTK check failed");
      }
    } catch (err) {
      this.state.rtk = "error";
      logger.fail("orchestrator", `RTK failed: ${err}`);
    }
  }

  private async startMcp(): Promise<void> {
    if (!this.depsInstaller) {
      this.depsInstaller = createDepsInstaller(this.config as any);
    }
    this.localRag = this.depsInstaller.createLocalRagClient();

    try {
      this.state.mcp = "starting";
      await this.localRag.start();
      this.state.mcp = "running";
      logger.check("orchestrator", "MCP running");
    } catch (err) {
      this.state.mcp = "error";
      logger.fail("orchestrator", `MCP failed: ${err}`);
    }
  }

  private async startOpencode(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.state.opencode = "starting";
        logger.progress("orchestrator", "Starting OpenCode...");

        const ocProc = spawn(COMPONENT_BIN_PATHS.opencode, {
          cwd: this.config.targetDir,
          stdio: "inherit",
          env: {
            ...process.env,
            HOME: "/home/user",
            TERM: process.env.TERM || "xterm",
          },
        });

        this.processes.set("opencode", ocProc);
        this.state.opencode = "running";
        logger.check("orchestrator", "OpenCode running");

        ocProc.on("exit", async (code) => {
          logger.info("orchestrator", `OpenCode exited with code ${code}`);
          this.state.opencode = "stopped";
          await this.stop();
          resolve();
        });
      } catch (err) {
        this.state.opencode = "error";
        logger.fail("orchestrator", `OpenCode failed: ${err}`);
        resolve();
      }
    });
  }
}

export async function createOrchestrator(
  config: WssConfig,
): Promise<Orchestrator> {
  return new Orchestrator(config);
}
