import { spawn, ChildProcess, StdioOptions } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { logger } from "../lib/logger.js";
import type { Config } from "../lib/config.js";

const BWARP_BIN = "/usr/bin/bwrap";

function buildBwrapArgs(config: Config): string[] {
  const args: string[] = [];

  // Immutable system (ro-bind)
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
    args.push("--ro-bind-try", p, p);
  }

  // Proc / dev / tmp
  args.push("--proc", "/proc", "--dev", "/dev", "--dir", "/tmp");

  // Isolation
  args.push("--unshare-all", "--share-net", "--die-with-parent");

  // Home & env
  args.push("--chdir", "/home/user/project", "--setenv", "HOME", "/home/user");
  args.push("--setenv", "TERM", process.env.TERM || "xterm");
  args.push("--setenv", "OPENCODE_CONFIG_DIR", "/home/user/.config/opencode");

  // Project bind
  args.push("--bind", config.targetDir, "/home/user/project");

  // Bin (bun, rtk)
  args.push("--bind", config.wssBinDir, "/home/user/.config/wssch/bin");
  args.push(
    "--setenv",
    "PATH",
    "/home/user/.config/wssch/bin:/usr/bin:/bin:/usr/local/bin",
  );

  // Caches
  args.push("--bind", `${config.wssCacheDir}/npm`, "/home/user/.cache/npm");

  // OpenCode config and data
  args.push(
    "--bind",
    `${config.wssConfigDir}/opencode-config`,
    "/home/user/.config/opencode",
  );
  args.push(
    "--bind",
    `${config.wssConfigDir}/opencode-share`,
    "/home/user/.local/share/opencode",
  );

  // MCP config
  args.push("--bind", `${config.wssDataDir}/mcp`, "/home/user/.wssdata/mcp");

  // Env vars
  args.push("--setenv", "PROJECT_DIR", "/home/user/project");
  args.push("--setenv", "XDG_CONFIG_HOME", "/home/user/.config");

  // RTK config dir bind
  args.push("--bind", `${config.wssConfigDir}/rtk`, "/home/user/.config/rtk");

  if (!config.noRtk) {
    args.push("--setenv", "NO_RTK", "false");
  } else {
    args.push("--setenv", "NO_RTK", "true");
  }

  if (!config.noOllama) {
    args.push("--setenv", "NO_RAG", "false");
  } else {
    args.push("--setenv", "NO_RAG", "true");
  }

  args.push("--setenv", "OPENCODE_MANAGES_MCP", "true");
  args.push("--setenv", "WSS_IN_SANDBOX", "true");

  // Entrypoint
  args.push("--setenv", "TERM", process.env.TERM || "xterm");

  return args;
}

export async function spawnWithSandbox(config: Config): Promise<void> {
  logger.info("sandbox", "Starting sandbox...");

  const args = buildBwrapArgs(config);

  // Build the bash command for inside the sandbox
  const bashCmd = `exec wssch`;

  // Add bash execution at the end
  args.push("bash", "-c", bashCmd);

  const proc = spawn(BWARP_BIN, args, {
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
