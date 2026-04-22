import { spawn, ChildProcess, StdioOptions } from "node:child_process";
import { access, constants, readdir } from "node:fs/promises";
import { logger } from "@lib/logger.js";
import { configService, SANDBOX_BINDINGS } from "@config/index.js";

const BWARP_BIN = "/usr/bin/bwrap";

async function buildBwrapArgs(): Promise<string[]> {
  const bwrapArgs: string[] = [];
  const paths = configService.paths;
  const cfg = configService.args;

  const roPaths = [
    "/usr",
    "/lib",
    "/lib64",
    "/bin",
    "/etc/resolv.conf",
    "/etc/hosts",
    "/etc/ssl",
    "/etc/ca-certificates",
  ];
  for (const p of roPaths) {
    bwrapArgs.push("--ro-bind-try", p, p);
  }

  bwrapArgs.push("--proc", "/proc", "--dev", "/dev", "--dir", "/tmp");

  bwrapArgs.push("--unshare-all", "--share-net", "--die-with-parent");

  const args = configService.args;
  bwrapArgs.push("--bind", args.targetDir, SANDBOX_BINDINGS.targetDir);

  try {
    await readdir(`${args.targetDir}/.git`);
    bwrapArgs.push(
      "--ro-bind",
      `${args.targetDir}/.git`,
      `${SANDBOX_BINDINGS.targetDir}/.git`,
    );
  } catch {}
  bwrapArgs.push(
    "--chdir",
    SANDBOX_BINDINGS.targetDir,
    "--setenv",
    "HOME",
    SANDBOX_BINDINGS.targetDir.split("/").slice(0, 3).join("/"),
  );
  bwrapArgs.push("--setenv", "TERM", process.env.TERM || SANDBOX_BINDINGS.term);
  bwrapArgs.push(
    "--setenv",
    "OPENCODE_CONFIG_DIR",
    SANDBOX_BINDINGS.opencodeConfig,
  );

  bwrapArgs.push("--bind", paths.wssBinDir, SANDBOX_BINDINGS.wssBinDir);
  bwrapArgs.push("--setenv", "PATH", SANDBOX_BINDINGS.path);

  bwrapArgs.push(
    "--bind",
    paths.wssOpencodeConfigDir,
    SANDBOX_BINDINGS.wssOpencodeConfigDir,
  );
  bwrapArgs.push(
    "--bind",
    paths.wssOpencodeCacheDir,
    SANDBOX_BINDINGS.wssOpencodeCacheDir,
  );

  bwrapArgs.push(
    "--bind",
    `${paths.wssDataDir}/mcp`,
    `${SANDBOX_BINDINGS.wssDataDir}/mcp`,
  );

  bwrapArgs.push("--setenv", "PROJECT_DIR", SANDBOX_BINDINGS.projectDir);
  bwrapArgs.push("--setenv", "XDG_CONFIG_HOME", SANDBOX_BINDINGS.xdgConfigHome);

  bwrapArgs.push(
    "--bind",
    `${paths.wssConfigDir}/rtk`,
    SANDBOX_BINDINGS.rtkConfigDir,
  );

  if (!cfg.noRtk) {
    bwrapArgs.push("--setenv", "NO_RTK", "false");
  } else {
    bwrapArgs.push("--setenv", "NO_RTK", "true");
  }

  if (!cfg.noOllama) {
    bwrapArgs.push("--setenv", "NO_RAG", "false");
  } else {
    bwrapArgs.push("--setenv", "NO_RAG", "true");
  }

  bwrapArgs.push("--setenv", "WSS_IN_SANDBOX", "true");

  bwrapArgs.push("--setenv", "TERM", process.env.TERM || SANDBOX_BINDINGS.term);

  return bwrapArgs;
}

export async function spawnWithSandbox(): Promise<void> {
  logger.info("sandbox", "Starting sandbox...");

  const bwrapArgs = await buildBwrapArgs();

  const bashCmd = `exec wssch`;

  bwrapArgs.push("bash", "-c", bashCmd);

  const proc = spawn(BWARP_BIN, bwrapArgs, {
    stdio: "inherit" as StdioOptions,
    env: process.env as Record<string, string>,
  });

  await new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`bwrap exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

export async function isBwrapAvailable(): Promise<boolean> {
  try {
    await access(BWARP_BIN, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
