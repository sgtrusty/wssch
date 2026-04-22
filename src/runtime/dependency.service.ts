import { logger } from "@lib/logger.js";
import { bridgeService } from "./bridge.service.js";
import { Dependency } from "@runtime/runtime.interface.js";

export class DepsInstaller {
  private deps: Dependency[] = [];

  async init(): Promise<void> {
    this.deps = await bridgeService.getDepsFromPreferences();
    logger.debug(
      "deps",
      `Initialized deps: ${this.deps.map((d) => d.name).join(", ")}`,
    );
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

    if (await dep.isAvailable()) {
      logger.debug("deps", `${dep.name} already available`);
      return;
    }

    logger.info("deps", `Installing ${dep.name}...`);
    await dep.install();

    if (dep.postInstall) {
      await dep.postInstall();
    }
  }

  isDepAvailable(name: string): boolean {
    return this.deps.some((d) => d.name.toLowerCase() === name.toLowerCase());
  }
}

export async function createDepsInstaller(): Promise<DepsInstaller> {
  const installer = new DepsInstaller();
  await installer.init();
  return installer;
}
