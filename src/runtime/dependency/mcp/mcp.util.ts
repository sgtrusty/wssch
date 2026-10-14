import { configService } from "@config/index.js";
import type { LumenMcpConfig } from "@config/config.service.js";

export type HarnessType = string;

export type { LumenMcpConfig };

export function checkMcpEnabled(
  agent: HarnessType,
  serverName: string,
): boolean {
  return configService.checkMcpEnabled(agent, serverName);
}

export function patchMcpConfig(
  agent: HarnessType,
  serverName: string,
  serverConfig: LumenMcpConfig,
): void {
  configService.patchMcpConfig(agent, serverName, serverConfig);
}