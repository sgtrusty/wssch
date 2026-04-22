export interface Dependency {
  readonly name: string;
  readonly binPath: string;
  isAvailable(): Promise<boolean>;
  install(): Promise<void>;
  postInstall?(): Promise<void>;
  preDeps?(): string[];
  initFromPrefs?(): Promise<void>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
  isRunning?(): boolean;
  healthCheck?(): Promise<boolean>;
}

