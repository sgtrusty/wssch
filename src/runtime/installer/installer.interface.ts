export interface InstallerStrategy {
  readonly name: string;
  isInstalled(binPath: string): Promise<boolean>;
  install(binPath: string): Promise<void>;
}

export interface NpxInstallerOptions {
  packageName: string;
  binName: string;
  version?: string;
}

export interface DirectInstallerOptions {
  downloadUrl: string;
  expectedBinName: string;
}

export interface RunCommandOptions {
  cwd?: string;
  stdio?: "inherit" | "pipe" | "ignore";
}