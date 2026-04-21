import { spawn } from "node:child_process";
import type { Config } from "../../../lib/config.js";
import type { Dependency } from "../base.js";

export class OllamaProxyDependency implements Dependency {
  readonly name = "Ollama";
  readonly binPath: string;

  constructor(private readonly config: Config) {
    this.binPath = this.config.ollamaUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const proc = spawn("curl", ["-sf", `${this.config.ollamaUrl}/api/tags`], {
        stdio: "ignore",
      });
      const code = await new Promise<number>((resolve) => {
        proc.on("close", (c) => resolve(c ?? 0));
      });
      return code === 0;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    // No-op - Ollama is an external service
  }

  }

export function createOllamaProxyDependency(
  config: Config,
): OllamaProxyDependency {
  return new OllamaProxyDependency(config);
}
