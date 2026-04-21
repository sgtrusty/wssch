import { logger } from "@lib/logger.js";
import { configService, type DepName } from "@config/index.js";
import type { Dependency, LifecycleComponent } from "./dep.interface.js";
import { createRtkDependency } from "./optimizer/rtk.js";
import { createBunDependency } from "./toolkit/bun.js";
import { createLocalRagClient } from "./mcp/localRag.js";
import { createOllamaProxyDependency } from "./proxy/ollamaProxy.js";
import { createMcpLocalAgentDependency } from "./mcp/localAgent.js";

const DEP_CREATORS: Record<DepName, () => Dependency> = {
  rtk: createRtkDependency,
  bun: createBunDependency,
  ollama: createOllamaProxyDependency,
  "mcp-local-agent": createMcpLocalAgentDependency,
};

export class DepsInstaller {
  private readonly deps: Dependency[] = [];
  private readonly components: LifecycleComponent[] = [];

  constructor() {
    const runtime = configService.runtime;
    const args = configService.args;

    for (const depName of runtime.deps) {
      const createDep = DEP_CREATORS[depName];
      if (createDep) {
        this.deps.push(createDep());

        if (depName === "rtk" || depName === "mcp-local-agent") {
          continue;
        }
      }
    }

    if (!args.noRtk) {
      this.components.push(new RtkComponent());
    }

    if (!args.noRag) {
      this.components.push(createLocalRagClient());
    }

    logger.debug("deps", `Initialized deps: ${runtime.deps.join(", ")}`);
  }

  async installAll(): Promise<void> {
    logger.info("deps", `Installing ${this.deps.length} dependencies...`);
    await this.installWithPreDeps();
  }

  private async installWithPreDeps(): Promise<void> {
    const pending = new Set(this.deps);
    const installed = new Set<string>();

    while (pending.size > 0) {
      let progress = false;

      for (const dep of pending) {
        const preDeps = dep.preDeps?.() || [];
        const canInstall = preDeps.every((p) => installed.has(p));

        if (canInstall) {
          await this.installDep(dep);
          pending.delete(dep);
          installed.add(dep.name.toLowerCase());
          progress = true;
        }
      }

      if (!progress && pending.size > 0) {
        const remaining = [...pending].map((d) => d.name).join(", ");
        logger.warn("deps", `Circular deps or missing preDeps: ${remaining}`);
        break;
      }
    }
  }

  private async installDep(dep: Dependency): Promise<void> {
    logger.debug("deps", `Processing: ${dep.name}`);

    const rtk = this.deps.find((d) => d.name.toLowerCase().includes("rtk"));

    if (dep === rtk && !(await dep.isAvailable())) {
      logger.info("deps", `Installing ${dep.name}...`);
      await dep.install();
      if (dep.postInstall) {
        await dep.postInstall();
      }
      return;
    }

    logger.debug("deps", `Checking availability: ${dep.name}`);
    if (await dep.isAvailable()) {
      logger.debug("deps", `${dep.name} already available`);
      return;
    }
    logger.info("deps", `Installing ${dep.name}...`);
    await dep.install();
  }

  getComponents(): LifecycleComponent[] {
    return this.components;
  }

  isDepAvailable(name: string): boolean {
    return this.deps.some((d) => d.name.toLowerCase() === name.toLowerCase());
  }
}

class RtkComponent implements LifecycleComponent {
  readonly name = "RTK";
  private client: Awaited<ReturnType<DepsInstaller["getComponents"]>>[number] | null = null;

  async start(): Promise<void> {
    try {
      logger.progress("component", "Checking RTK...");
      this.client;
      logger.check("component", "RTK ready");
    } catch (err) {
      logger.fail("component", `RTK failed: ${err}`);
    }
  }

  async stop(): Promise<void> {
    this.client = null;
  }

  isRunning(): boolean {
    return false;
  }
}

export function createDepsInstaller(): DepsInstaller {
  return new DepsInstaller();
}