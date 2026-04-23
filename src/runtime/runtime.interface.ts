import { DepType } from "@runtime/dependency.enum.js";

export interface DepRef {
  type: DepType;
  item: number;
}

export interface Dependency {
  readonly name: string;
  readonly binPath: string;
  readonly suggestedPrefs?: Record<string, string>;
  isAvailable(): Promise<boolean>;
  install(): Promise<void>;
  postInstall?(): Promise<void>;
  preDeps?(): DepRef[];
  initFromPrefs?(): Promise<void>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
  isRunning?(): boolean;
  healthCheck?(): Promise<boolean>;
}

