import type { Config } from "../../lib/config.js";

export interface Dependency {
  readonly name: string;
  readonly binPath: string;
  isAvailable(): Promise<boolean>;
  install(config: Config): Promise<void>;
  postInstall?(config: Config): Promise<void>;
  preDeps?(): string[];
}

export interface RuntimeComponent {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  healthCheck?(): Promise<boolean>;
}
