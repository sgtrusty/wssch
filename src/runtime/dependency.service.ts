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
    for (const dep of this.deps) {
      await this.installDep(dep);
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
