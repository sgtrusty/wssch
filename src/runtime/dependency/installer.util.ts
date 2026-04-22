import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  mkdir,
  access,
  constants,
  rm,
  chmod,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { configService } from "@config/index.js";
import { logger } from "@lib/logger.js";

/**
 * TODO: we can add a sqlite+checksum utility in future
 * maybe some sha1 key comparisons if needed for direct bins
 */

/**
 * Option 1: Standard NPM install with a shim.
 * Good for quick registry installs.
 */
export async function installNpmToBinDir(
  packageName: string,
  binName: string,
  version: string = "latest",
): Promise<string> {
  const paths = configService.paths;
  const binPath = join(paths.wssBinDir, binName);
  const installRoot = join(paths.wssBinDir, `${binName}-dist`);

  if (await isExecutable(binPath)) return binPath;

  logger.info("subdep", `Installing ${packageName}@${version}...`);

  await mkdir(paths.wssBinDir, { recursive: true });
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
    // Point to the entry file found in package.json (usually dist/index.js)
    await createExecutableShim(binPath, join(installRoot, "dist/index.js"));
  } else {
    throw new Error(`npm pack failed for ${packageName}@${version}`);
  }

  return binPath;
}

/**
 * Compiles a GitHub repo to a CJS bundle using esbuild,
 * keeping native dependencies external and accessible.
 */
export async function compileGithubToBinary(
  repoUrl: string,
  binName: string,
  options: {
    entryPoint?: string; // e.g., "src/index.ts"
    externals?: string[]; // e.g., ["@lancedb/lancedb", "onnxruntime-node"]
  } = {},
): Promise<string> {
  const { entryPoint = "src/index.ts", externals = [] } = options;
  const paths = configService.paths;
  const binPath = join(paths.wssBinDir, binName);
  const installRoot = join(paths.wssBinDir, `${binName}-dist`);
  const tempBuildDir = join(tmpdir(), `build-${binName}-${Date.now()}`);

  if (await isExecutable(binPath)) return binPath;

  logger.info("subdep", `Building ${binName} from source...`);

  try {
    await mkdir(installRoot, { recursive: true });

    // 1. Setup Source
    await runCommand("git", ["clone", "--depth", "1", repoUrl, tempBuildDir]);
    await runCommand("bun", ["install"], { cwd: tempBuildDir });

    // 2. Prepare Esbuild Arguments
    const bundlePath = join(installRoot, "index.cjs");
    const esbuildArgs = [
      "esbuild",
      join(tempBuildDir, entryPoint),
      "--bundle",
      "--platform=node",
      "--format=cjs",
      `--outfile=${bundlePath}`,
      "--define:import.meta.url=import_meta_url",
      "--banner:js=const import_meta_url = require('url').pathToFileURL(__filename).href;",
      ...externals.map((mod) => `--external:${mod}`),
    ];

    // 3. Bundle Logic
    await runCommand("npx", esbuildArgs, { cwd: tempBuildDir });

    // 4. Move node_modules to the dist folder to satisfy external native calls
    // We use a sync-like copy to ensure .so/.node files are preserved
    await runCommand("cp", [
      "-r",
      join(tempBuildDir, "node_modules"),
      installRoot,
    ]);

    // 5. Create Executable Shim
    const shimContent = `#!/usr/bin/env node\nrequire('${bundlePath}');`;
    await writeFile(binPath, shimContent, { mode: 0o755 });
    await chmod(binPath, 0o755);
  } finally {
    if (existsSync(tempBuildDir)) {
      await rm(tempBuildDir, { recursive: true, force: true });
    }
  }

  logger.check("subdep", `${binName} compiled successfully.`);
  return binPath;
}

/**
 * Helpers
 */

async function createExecutableShim(shimPath: string, entryPoint: string) {
  const shimContent = `#!/usr/bin/env node\nimport('${entryPoint}');`;
  await writeFile(shimPath, shimContent, { mode: 0o755 });
}

export async function isExecutable(filePath: string): Promise<boolean> {
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
  options: any = {},
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
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("tar", [
      "-xzf",
      archivePath,
      "--strip-components=1",
      "-C",
      destDir,
    ]);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`tar failed`)),
    );
    proc.on("error", reject);
  });
}

