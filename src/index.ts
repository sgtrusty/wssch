import { createOrchestrator } from "./runtime/orchestrator.js";
import { scaffold } from "./commands/scaffold.js";
import { logger, initLogger } from "./lib/logger.js";
import { parseArgs, dumpConfig, type Config } from "./lib/config.js";
import { preflight, ensureDirs } from "./core/lifecycle.js";
import { createDepsInstaller } from "./runtime/deps/installer.js";
import { isBwrapAvailable } from "./sandbox/bwrap.js";

export { logger, initLogger } from "./lib/logger.js";
export { parseArgs } from "./lib/config.js";
export { preflight, ensureDirs } from "./core/lifecycle.js";

export async function runWithSandbox(config: Config): Promise<void> {
  initLogger({ prefix: "sandbox", verbose: config.verbose });

  if (!isBwrapAvailable()) {
    logger.fail(
      "sandbox",
      "bwrap not found. Install: sudo apt install bubblewrap",
    );
    process.exit(1);
  }

  await ensureDirs(config);
  const checks = await preflight(config);
  if (!checks) {
    logger.fail("sandbox", "Preflight checks failed");
    process.exit(1);
  }

  const { spawnWithSandbox } = await import("./sandbox/bwrap.js");
  spawnWithSandbox(config);
}

export async function runOrchestrator(config: Config): Promise<void> {
  initLogger({ prefix: "wssch", verbose: config.verbose });

  logger.info("startup", "wssch CLI starting...");
  logger.info("startup", `Project: ${config.targetDir}`);
  logger.info("startup", `Config: ${config.wssConfigDir}`);
  logger.info(
    "startup",
    `In Sandbox: ${process.env.WSS_IN_SANDBOX === "true"}`,
  );

  dumpConfig(config);

  // Ensure directories exist
  await ensureDirs(config);

  // Scaffold
  scaffold({
    targetDir: config.targetDir,
    wssConfigDir: config.wssConfigDir,
    opencodeDir: config.wssOpencodeConfigDir,
    wssBinDir: config.wssBinDir,
    noRtk: config.noRtk,
    noRag: config.noRag,
  });

  // Create session

  // Start orchestrator
  const orchestrator = await createOrchestrator({
    targetDir: config.targetDir,
    handlerDir: config.orchestratorDir,
    wssConfigDir: config.wssConfigDir,
    wssOpencodeConfigDir: config.wssOpencodeConfigDir,
    wssBinDir: config.wssBinDir,
    rtkBin: config.rtkBin,
    ollamaUrl: config.ollamaUrl,
    embeddingModel: config.embedModel,
    noRtk: config.noRtk,
    noRag: config.noRag,
    noOllama: config.noOllama,
    opencodeManagesMcp: process.env.OPENCODE_MANAGES_MCP === "true",
    deps: config.deps,
  });

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
  const config = await parseArgs(args);

  if (command === "run") {
    if (process.env.WSS_IN_SANDBOX === "true") {
      await runOrchestrator(config);
      return;
    }

    if (args.includes("--no-sandbox")) {
      logger.warn("startup", "Running without sandbox!");
      await runOrchestrator(config);
    } else {
      await runWithSandbox(config);
    }
    return;
  }

  if (command === "orchestrate" || command === "orcs") {
    await runOrchestrator(config);
    return;
  }

  if (command === "init") {
    initLogger({ prefix: "wssch" });
    await ensureDirs(config);
    scaffold({
      targetDir: config.targetDir,
      opencodeDir: `${config.wssConfigDir}/opencode-config`,
      wssConfigDir: config.wssConfigDir,
      wssBinDir: config.wssBinDir,
      noRtk: config.noRtk,
      noRag: config.noRag,
    });
    logger.check("startup", "Project scaffolded.");
    return;
  }

  if (command === "deps") {
    initLogger({ prefix: "wssch" });
    await ensureDirs(config);
    const installer = createDepsInstaller(config);
    await installer.installAll();
    logger.check("startup", "Dependencies installed.");
    return;
  }

  logger.fail("startup", `Unknown command: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  logger.fail("startup", `Fatal: ${err}`);
  process.exit(1);
});
