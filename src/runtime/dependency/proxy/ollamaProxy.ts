import { spawn } from "node:child_process";
import { getPreferences } from "@db/pref.service.js";
import type { Dependency } from "@runtime/runtime.interface.js";

export class OllamaProxyDependency implements Dependency {
  readonly name = "Ollama";
  readonly binPath = "";
  private url = "http://localhost:11434";

  constructor() {}

  async initFromPrefs(): Promise<void> {
    const prefs = await getPreferences();
    this.url = prefs.ollamaUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const proc = spawn("curl", ["-sf", `${this.url}/api/tags`], {
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

  async install(): Promise<void> {}
}

export function createOllamaProxyDependency(): OllamaProxyDependency {
  return new OllamaProxyDependency();
}

