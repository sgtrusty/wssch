import { spawn } from "node:child_process";
import { configService } from "@config/index.js";
import type { Dependency } from "@runtime/runtime.interface.js";

export class OllamaProxyDependency implements Dependency {
  readonly name = "Ollama";
  readonly binPath: string;

  constructor() {
    this.binPath = configService.runtime.ollamaUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const proc = spawn(
        "curl",
        ["-sf", `${configService.runtime.ollamaUrl}/api/tags`],
        {
          stdio: "ignore",
        },
      );
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

export function createOllamaProxyDependency(): OllamaProxyDependency {
  return new OllamaProxyDependency();
}
