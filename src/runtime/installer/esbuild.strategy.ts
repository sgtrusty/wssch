import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdir, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import type { InstallerStrategy, RunCommandOptions } from "./installer.interface.js";

async function runCommand(
  cmd: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit", ...options });
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} failed with ${code}`)),
    );
    proc.on("error", reject);
  });
}

export interface EsbuildStrategyOptions {
  repoUrl: string;
  binName: string;
  entryPoint?: string;
  externals?: string[];
}

export class EsbuildInstallerStrategy implements InstallerStrategy {
  readonly name = "esbuild";
  private options: EsbuildStrategyOptions;

  constructor(options: EsbuildStrategyOptions) {
    this.options = {
      entryPoint: "src/index.ts",
      externals: [],
      ...options,
    };
  }

  async isInstalled(binPath: string): Promise<boolean> {
    return existsSync(binPath);
  }

  async install(binPath: string): Promise<void> {
    const { repoUrl, binName, entryPoint, externals } = this.options;
    const binDir = join(binPath, "..");
    const installRoot = join(binDir, `${binName}-dist`);
    const tempBuildDir = join(tmpdir(), `build-${binName}-${Date.now()}`);

    if (await this.isInstalled(binPath)) {
      logger.info("subdep", `${binName} already installed`);
      return;
    }

    logger.info("subdep", `Building ${binName} from source...`);

    try {
      await mkdir(installRoot, { recursive: true });

      await runCommand("git", ["clone", "--depth", "1", repoUrl, tempBuildDir]);
      await runCommand("bun", ["install"], { cwd: tempBuildDir });

      const bundlePath = join(installRoot, "index.cjs");
      const esbuildArgs = [
        "esbuild",
        join(tempBuildDir, entryPoint!),
        "--bundle",
        "--platform=node",
        "--format=cjs",
        `--outfile=${bundlePath}`,
        "--define:import.meta.url=import_meta_url",
        "--banner:js=const import_meta_url = require('url').pathToFileURL(__filename).href;",
        ...externals!.map((mod) => `--external:${mod}`),
      ];

      await runCommand("npx", esbuildArgs, { cwd: tempBuildDir });

      await runCommand("cp", ["-r", join(tempBuildDir, "node_modules"), installRoot]);

      const shimContent = `#!/usr/bin/env node\nrequire('${bundlePath}');`;
      await writeFile(binPath, shimContent);
      await chmod(binPath, 0o755);
    } finally {
      if (existsSync(tempBuildDir)) {
        await rm(tempBuildDir, { recursive: true, force: true });
      }
    }

    logger.check("subdep", `${binName} compiled successfully`);
  }
}