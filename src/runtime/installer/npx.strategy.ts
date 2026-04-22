import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdir, access, constants, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { logger } from "@lib/logger.js";
import type {
  InstallerStrategy,
  NpxInstallerOptions,
  RunCommandOptions,
} from "./installer.interface.js";

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

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

async function extractTarball(
  archivePath: string,
  destDir: string,
  stripComponents: number = 1,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["-xzf", archivePath, "--strip-components=" + stripComponents, "-C", destDir];
    const proc = spawn("tar", args);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`tar failed`)),
    );
    proc.on("error", reject);
  });
}

export class NpxInstallerStrategy implements InstallerStrategy {
  readonly name = "npx";
  private options: NpxInstallerOptions;

  constructor(options: NpxInstallerOptions) {
    this.options = options;
  }

  async isInstalled(binPath: string): Promise<boolean> {
    return isExecutable(binPath);
  }

  async install(binPath: string): Promise<void> {
    const { packageName, version = "latest" } = this.options;
    const binDir = join(binPath, "..");
    const installRoot = join(binDir, `${this.options.binName}-dist`);

    if (await this.isInstalled(binPath)) {
      logger.info("subdep", `${packageName} already installed`);
      return;
    }

    logger.info("subdep", `Installing ${packageName}@${version}...`);

    await mkdir(binDir, { recursive: true });
    await mkdir(installRoot, { recursive: true });

    const tempDir = tmpdir();
    const formattedName = packageName.replace(/^@/, "").replace(/\//, "-");
    const archivePath = join(tempDir, `${formattedName}-${version}.tgz`);

    await runCommand("npx", [
      "npm",
      "pack",
      `${packageName}@${version}`,
      "--pack-destination",
      tempDir,
    ]);

    if (existsSync(archivePath)) {
      await extractTarball(archivePath, installRoot);
      await rm(archivePath, { force: true });
      await createExecutableShim(binPath, join(installRoot, "dist/index.js"));
    } else {
      throw new Error(`npm pack failed for ${packageName}@${version}`);
    }

    logger.check("subdep", `${packageName} installed to ${binDir}`);
  }
}

async function createExecutableShim(shimPath: string, entryPoint: string) {
  const shimContent = `#!/usr/bin/env node\nimport('${entryPoint}');`;
  await writeFile(shimPath, shimContent, { mode: 0o755 });
}