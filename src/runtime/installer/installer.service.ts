import { NpxInstallerStrategy } from "./npx.strategy.js";
import { DirectInstallerStrategy } from "./direct.strategy.js";
import { EsbuildInstallerStrategy } from "./esbuild.strategy.js";
import { join } from "node:path";
import { configService } from "@config/index.js";
import type { InstallerStrategy } from "./installer.interface.js";

export class InstallerService {
  npx(options: { packageName: string; binName: string; version?: string }): NpxInstallerStrategy {
    return new NpxInstallerStrategy(options);
  }

  direct(downloadUrl: string, expectedBinName: string, binaryOnly = false): DirectInstallerStrategy {
    return new DirectInstallerStrategy(downloadUrl, expectedBinName, binaryOnly);
  }

  esbuild(options: {
    repoUrl: string;
    binName: string;
    entryPoint?: string;
    externals?: string[];
  }): EsbuildInstallerStrategy {
    return new EsbuildInstallerStrategy(options);
  }

  async install(strategy: InstallerStrategy, binPath?: string): Promise<string> {
    const targetPath = binPath ?? join(configService.paths.wssBinDir, strategy.name);
    await strategy.install(targetPath);
    return targetPath;
  }
}

export const installerService = new InstallerService();