import { createOrchestrator } from "./runtime/orchestrator.js";
import { scaffold } from "./commands/scaffold.js";
import { logger, initLogger } from "./lib/logger.js";
import { configService } from "./config/index.js";
import { preflight, ensureDirs } from "./core/lifecycle.js";
import { createDepsInstaller } from "./runtime/deps/installer.js";
import { isBwrapAvailable } from "./sandbox/bwrap.js";

export { logger, initLogger } from "./lib/logger.js";
export { preflight, ensureDirs } from "./core/lifecycle.js";

export async function runWithSandbox(): Promise<void> {
  const args = configService.args;
  const paths = configService.paths;

  initLogger({ prefix: "sandbox", verbose: args.verbose });

  if (!isBwrapAvailable()) {
    logger.fail(
      "sandbox",
      "bwrap not found. Install: sudo apt install bubblewrap",
    );
    process.exit(1);
  }

  await ensureDirs();
  const checks = await preflight();
  if (!checks) {
    logger.fail("sandbox", "Preflight checks failed");
    process.exit(1);
  }

  const { spawnWithSandbox } = await import("./sandbox/bwrap.js");
  spawnWithSandbox();
}

export async function runOrchestrator(): Promise<void> {
  const args = configService.args;
  const paths = configService.paths;

  initLogger({ prefix: "wssch", verbose: args.verbose });

  logger.info("startup", "wssch CLI starting...");
  logger.info("startup", `Project: ${args.targetDir}`);
  logger.info("startup", `Config: ${paths.wssConfigDir}`);
  logger.info(
    "startup",
    `In Sandbox: ${process.env.WSS_IN_SANDBOX === "true"}`,
  );

  await ensureDirs();

  scaffold({
    targetDir: args.targetDir,
    wssConfigDir: paths.wssConfigDir,
    opencodeDir: paths.wssOpencodeConfigDir,
    wssBinDir: paths.wssBinDir,
    noRtk: args.noRtk,
    noRag: args.noRag,
  });

  const orchestrator = await createOrchestrator();

  const cleanup = async () => {
    logger.info("startup", "Cleaning up...");
    await orchestrator.stop();
    logger.check("startup", "Done.");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await orchestrator.start();
  } catch (err) {
    logger.fail("startup", `Failed to start: ${err}`);
    await cleanup();
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "run";
  configService.init(args);

  if (command === "run") {
    if (process.env.WSS_IN_SANDBOX === "true") {
      await runOrchestrator();
      return;
    }

    if (args.includes("--no-sandbox")) {
      logger.warn("startup", "Running without sandbox!");
      await runOrchestrator();
    } else {
      await runWithSandbox();
    }
    return;
  }

  if (command === "orchestrate" || command === "orcs") {
    await runOrchestrator();
    return;
  }

  if (command === "init") {
    const args = configService.args;
    const paths = configService.paths;

    initLogger({ prefix: "wssch" });
    await ensureDirs();
    scaffold({
      targetDir: args.targetDir,
      opencodeDir: paths.wssOpencodeConfigDir,
      wssConfigDir: paths.wssConfigDir,
      wssBinDir: paths.wssBinDir,
      noRtk: args.noRtk,
      noRag: args.noRag,
    });
    logger.check("startup", "Project scaffolded.");
    return;
  }

  if (command === "deps") {
    initLogger({ prefix: "wssch" });
    await ensureDirs();
    const installer = createDepsInstaller();
    await installer.installAll();
    logger.check("startup", "Dependencies installed.");
    return;
  }

  logger.fail("startup", `Unknown command: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  logger.fail("startup", "Fatal: " + err);
  process.exit(1);
});