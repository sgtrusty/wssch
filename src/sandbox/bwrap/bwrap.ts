import { spawn, ChildProcess, StdioOptions } from "node:child_process";
import { access, constants, readdir } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { logger } from "@lib/logger.js";
import { configService, SANDBOX_BINDINGS } from "@config/index.js";
import { buildUsrBinArgs } from "./bwrap-helper.js";

const BWARP_BIN = "/usr/bin/bwrap";

async function buildBwrapOptions(): Promise<string[]> {
  const cmdArgs: string[] = [];
  const paths = configService.paths;
  const cfg = configService.args;

  cmdArgs.push("--unshare-all");
  cmdArgs.push("--unshare-ipc");
  cmdArgs.push("--unshare-pid");
  cmdArgs.push("--unshare-user");
  cmdArgs.push("--unshare-cgroup");
  cmdArgs.push("--share-net");
  cmdArgs.push("--die-with-parent");

  cmdArgs.push("--proc", "/proc");
  cmdArgs.push("--dev", "/dev");
  cmdArgs.push("--dir", "/tmp");
  cmdArgs.push("--dir", "/var/tmp");
  cmdArgs.push("--tmpfs", "/run");
  cmdArgs.push("--tmpfs", "/run/lock");

  const usrBinArgs = await buildUsrBinArgs();
  for (const arg of usrBinArgs) {
    cmdArgs.push(arg);
  }

  const args = configService.args;
  cmdArgs.push("--bind", args.targetDir, SANDBOX_BINDINGS.targetDir);

  try {
    await readdir(`${args.targetDir}/.git`);
    cmdArgs.push(
      "--ro-bind",
      `${args.targetDir}/.git`,
      `${SANDBOX_BINDINGS.targetDir}/.git`,
    );
  } catch {}
  cmdArgs.push(
    "--chdir",
    SANDBOX_BINDINGS.targetDir,
    "--setenv",
    "HOME",
    SANDBOX_BINDINGS.targetDir.split("/").slice(0, 3).join("/"),
  );
  cmdArgs.push("--setenv", "TERM", process.env.TERM || SANDBOX_BINDINGS.term);
  cmdArgs.push(
    "--setenv",
    "OPENCODE_CONFIG_DIR",
    SANDBOX_BINDINGS.opencodeConfig,
  );

  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;
  cmdArgs.push("--uid", String(uid));
  cmdArgs.push("--gid", String(gid));
  cmdArgs.push("--cap-drop", "ALL");

  cmdArgs.push("--bind", paths.wssBinDir, SANDBOX_BINDINGS.wssBinDir);
  cmdArgs.push("--setenv", "PATH", SANDBOX_BINDINGS.path);

  cmdArgs.push(
    "--bind",
    paths.wssOpencodeConfigDir,
    SANDBOX_BINDINGS.wssOpencodeConfigDir,
  );
  cmdArgs.push(
    "--bind",
    paths.wssOpencodeCacheDir,
    SANDBOX_BINDINGS.wssOpencodeCacheDir,
  );

  cmdArgs.push(
    "--bind",
    `${paths.wssDataDir}/mcp`,
    `${SANDBOX_BINDINGS.wssDataDir}/mcp`,
  );

  cmdArgs.push("--setenv", "PROJECT_DIR", SANDBOX_BINDINGS.projectDir);
  cmdArgs.push("--setenv", "XDG_CONFIG_HOME", SANDBOX_BINDINGS.xdgConfigHome);

  cmdArgs.push(
    "--bind",
    `${paths.wssConfigDir}/rtk`,
    SANDBOX_BINDINGS.rtkConfigDir,
  );

  if (!cfg.noRtk) {
    cmdArgs.push("--setenv", "NO_RTK", "false");
  } else {
    cmdArgs.push("--setenv", "NO_RTK", "true");
  }

  if (!cfg.noOllama) {
    cmdArgs.push("--setenv", "NO_RAG", "false");
  } else {
    cmdArgs.push("--setenv", "NO_RAG", "true");
  }

  cmdArgs.push("--setenv", "WSS_IN_SANDBOX", "true");

  cmdArgs.push("--setenv", "TERM", process.env.TERM || SANDBOX_BINDINGS.term);

  return cmdArgs;
}

export async function spawnWithSandbox(): Promise<void> {
  logger.info("sandbox", "Starting sandbox...");

  const options = await buildBwrapOptions();
  const optionsContent = options.join("\0") + "\0";

  const argsFile = join(tmpdir(), `bwrap-args-${randomUUID()}`);
  await writeFile(argsFile, optionsContent, { mode: 0o600 });

  const proc = spawn(
    BWARP_BIN,
    ["--args", "3", "--", "bash", "-c", "exec wssch"],
    {
      stdio: [
        "inherit",
        "inherit",
        "inherit",
        "pipe",
        "ignore",
      ] as StdioOptions,
      env: process.env as Record<string, string>,
    },
  );

  const argsFd = proc.stdio[3] as NodeJS.WritableStream & { end: () => void };
  argsFd.write(optionsContent);
  argsFd.end();

  await new Promise<void>((resolve, reject) => {
    proc.on("close", async (code) => {
      try {
        await unlink(argsFile).catch(() => {});
      } catch {}
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`bwrap exited with code ${code}`));
      }
    });
    proc.on("error", async (err) => {
      try {
        await unlink(argsFile).catch(() => {});
      } catch {}
      reject(err);
    });
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

