import { scaffold } from "@commands/scaffold.js";
import { logger, initLogger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import { preflight, ensureDirs } from "@core/lifecycle.js";
import { isBwrapAvailable, spawnWithSandbox } from "@sandbox/bwrap/bwrap.js";
import { createDepsInstaller } from "@runtime/dependency.service.js";
import { createOrchestrator } from "@runtime/orchest.service.js";
import {
  initPreferences,
  isPreferencesInitialized,
  isInitialCheckComplete,
} from "@db/pref.service.js";
import { editPreferences, initPreferencesInteractive } from "@ui/prefs.ui.js";

async function initPreferencesIfNeeded(): Promise<void> {
  const initialized = await isPreferencesInitialized();
  if (!initialized) {
    logger.info("startup", "Setting up preferences...");
    await initPreferences();
    await initPreferencesInteractive();
  } else {
    const checkComplete = await isInitialCheckComplete();
    if (!checkComplete) {
      logger.info("startup", "Completing initial preferences check...");
      await initPreferencesInteractive();
    }
  }
}

export { logger, initLogger } from "@lib/logger.js";

export async function runWithSandbox(): Promise<void> {
  const args = configService.args;
  const paths = configService.paths;

  initLogger({ prefix: "sandbox", verbose: args.verbose });

  if (process.getuid?.() === 0 || process.geteuid?.() === 0) {
    logger.fail(
      "sandbox",
      "Cannot run as root. Run as a regular user instead.",
    );
    process.exit(1);
  }

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
  });

  const installer = await createDepsInstaller();
  await installer.installAll();

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
  }
  await cleanup();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "run";
  configService.init(args);

  await initPreferencesIfNeeded();

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
    });

    logger.check("startup", "Project scaffolded.");
    return;
  }

  if (command === "deps") {
    initLogger({ prefix: "wssch" });
    await ensureDirs();
    const installer = await createDepsInstaller();
    await installer.installAll();
    logger.check("startup", "Dependencies installed.");
    return;
  }

  if (command === "database" || command === "db") {
    initLogger({ prefix: "wssch" });
    const initialized = await isPreferencesInitialized();
    if (!initialized) {
      logger.info("database", "Initializing preferences...");
      await ensureDirs();
      await initPreferences();
    }
    await editPreferences();
    logger.check("database", "Preferences updated.");
    return;
  }

  logger.fail("startup", `Unknown command: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  logger.fail("startup", "Fatal: " + err);
  process.exit(1);
});
