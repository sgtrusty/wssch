import { logger } from "../../lib/logger.js";
import type { Config, DepName } from "../../lib/config.js";
import type { Dependency, RuntimeComponent } from "./base.js";
import { createRtkDependency, RtkClient } from "./optimizer/rtk.js";
import { createBunDependency } from "./toolkit/bun.js";
import { createLocalRagClient } from "./mcp/localRag.js";
import { createOllamaProxyDependency } from "./proxy/ollamaProxy.js";
import { createMcpLocalAgentDependency } from "./mcp/localAgent.js";

const DEP_CREATORS: Record<DepName, (config: Config) => Dependency> = {
  rtk: createRtkDependency,
  bun: createBunDependency,
  ollama: createOllamaProxyDependency,
  "mcp-local-agent": createMcpLocalAgentDependency,
};

export class DepsInstaller {
  private readonly deps: Dependency[] = [];
  private rtkClient: RtkClient | null = null;

  constructor(private readonly config: Config) {
    for (const depName of config.deps) {
      const createDep = DEP_CREATORS[depName];
      if (createDep) {
        this.deps.push(createDep(config));
      }
    }
    logger.debug("deps", `Initialized deps: ${config.deps.join(", ")}`);
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
      logger.info(
        "deps",
        `Installing ${dep.name} (synchronous, may require user interaction)...`,
      );
      await dep.install(this.config);
      if (dep.postInstall) {
        await dep.postInstall(this.config);
      }
      return;
    }

    logger.debug("deps", `Checking availability: ${dep.name}`);
    if (await dep.isAvailable()) {
      logger.debug("deps", `${dep.name} already available`);
      return;
    }
    logger.info("deps", `Installing ${dep.name}...`);
    await dep.install(this.config);
  }

  async getRtkClient(): Promise<RtkClient | null> {
    const rtk = this.deps.find((d) => d.name.toLowerCase().includes("rtk"));
    if (!rtk) return null;

    if (await rtk.isAvailable()) {
      if (!this.rtkClient) {
        this.rtkClient = new RtkClient(rtk.binPath);
        await this.rtkClient.check();
      }
      return this.rtkClient;
    }
    return null;
  }

  createLocalRagClient(): RuntimeComponent {
    return createLocalRagClient(this.config);
  }

  isDepAvailable(name: string): boolean {
    return this.deps.some(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
  }
}

export function createDepsInstaller(config: Config): DepsInstaller {
  return new DepsInstaller(config);
}
