import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm, mkdir } from "node:fs/promises";
import { logger } from "@lib/logger.js";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";
import {
  downloadUrl,
  extractTar,
  safeInstallBin,
  detectOs,
  detectArch,
  getLibcType,
} from "@runtime/dependency.util.js";

// Claude Code ships a platform-native binary as an npm optional-dependency
// package (@anthropic-ai/claude-code-<platform>). The `npm` CLI is not
// guaranteed to be available in this environment, so instead of `npm install`
// we pull that native package tarball straight from the registry and use its
// prebuilt `claude` binary directly.
const PACKAGE_PREFIX = "@anthropic-ai/claude-code";
const BINARY_NAME = "claude";

async function getPlatformKey(): Promise<string> {
  const os = detectOs();
  const arch = detectArch();
  const archSlug = arch === "x86_64" ? "x64" : "arm64";

  if (os === "windows") return `win32-${archSlug}`;
  if (os === "darwin") return `darwin-${archSlug}`;
  // linux
  const libc = await getLibcType();
  return `linux-${archSlug}${libc === "musl" ? "-musl" : ""}`;
}

async function getLatestNpmTarball(pkg: string): Promise<string> {
  const encoded = pkg.replace("/", "%2F");
  const url = `https://registry.npmjs.org/${encoded}`;
  const proc = spawn("curl", ["-fsSL", url], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  let data = "";
  proc.stdout?.on("data", (d) => {
    data += d;
  });
  const code = await new Promise<number>((resolve) => {
    proc.on("close", (c) => resolve(c ?? -1));
    proc.on("error", () => resolve(-1));
  });
  if (code !== 0 || !data) {
    throw new Error(`Failed to fetch npm metadata for ${pkg}`);
  }
  const meta = JSON.parse(data);
  const version = meta["dist-tags"]?.latest ?? meta.version;
  const tarball: string | undefined =
    meta.versions?.[version]?.dist?.tarball ?? meta.dist?.tarball;
  if (!tarball) {
    throw new Error(`No tarball URL found for ${pkg}@${version}`);
  }
  return tarball;
}

export class ClaudeDependency implements Dependency {
  readonly name = "Claude Code";
  readonly installPrefix: string;
  readonly binPath: string;
  private process: ChildProcess | null = null;
  private exitResolve: (() => void) | null = null;
  private exitPromise: Promise<void> | null = null;

  constructor() {
    this.installPrefix = join(configService.paths.wssBinDir, BINARY_NAME);
    this.binPath = join(this.installPrefix, BINARY_NAME);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { isExecutable } = await import("@runtime/dependency.util.js");
      return await isExecutable(this.binPath);
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    if (await this.isAvailable()) {
      logger.info("subdep", "Claude Code already installed");
      return;
    }

    const platformKey = await getPlatformKey();
    const nativePkg = `${PACKAGE_PREFIX}-${platformKey}`;
    const tarball = await getLatestNpmTarball(nativePkg);

    logger.progress("subdep", `Downloading Claude Code (${platformKey})`);

    const tempDir = join(tmpdir(), `claude-code-${Date.now()}`);
    const archive = join(tempDir, `${BINARY_NAME}.tgz`);
    await mkdir(tempDir, { recursive: true });

    try {
      await downloadUrl(tarball, archive, `Downloading Claude Code`);
      await extractTar(archive, tempDir, "package");

      const extractedBin = join(tempDir, "package", BINARY_NAME);
      await safeInstallBin(extractedBin, this.binPath);

      if (!(await this.isAvailable())) {
        throw new Error("Claude Code binary not found after extraction");
      }

      logger.check("subdep", `Claude Code installed to ${this.binPath}`);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info("component", "Claude Code is already running.");
      return;
    }

    const args = configService.args;

    if (!process.env.ANTHROPIC_API_KEY) {
      logger.info(
        "component",
        "ANTHROPIC_API_KEY not set — Claude Code will fall back to " +
          "interactive login, or you can export an API key from " +
          "console.anthropic.com/settings/keys.",
      );
    }

    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;

      try {
        logger.progress("component", "Starting Claude Code...");

        this.process = spawn(this.binPath, [], {
          cwd: args.targetDir,
          stdio: "inherit",
          env: {
            ...process.env,
            HOME: "/home/user",
            TERM: process.env.TERM || "xterm",
            CLAUDE_CONFIG_DIR: "/home/user/.claude",
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
          },
        });

        this.process.on("exit", (code) => {
          logger.info("component", `Claude Code exited with code ${code}`);
          this.process = null;
          if (this.exitResolve) {
            this.exitResolve();
          }
        });
      } catch (err) {
        logger.fail("component", `Claude Code failed: ${err}`);
        if (this.exitResolve) {
          this.exitResolve();
        }
      }
    });

    await this.exitPromise;
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      this.process = null;
      logger.info("component", "Claude Code stopped");
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function createClaudeDependency(): Dependency {
  return new ClaudeDependency();
}
