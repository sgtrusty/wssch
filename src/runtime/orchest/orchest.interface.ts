export interface LifecycleComponent {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  healthCheck?(): Promise<boolean>;
}
