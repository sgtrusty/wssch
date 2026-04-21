export interface Dependency {
  readonly name: string;
  readonly binPath: string;
  isAvailable(): Promise<boolean>;
  install(): Promise<void>;
  postInstall?(): Promise<void>;
  preDeps?(): string[];
}

export interface LifecycleComponent {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  healthCheck?(): Promise<boolean>;
}

export type { LifecycleComponent as RuntimeComponent };