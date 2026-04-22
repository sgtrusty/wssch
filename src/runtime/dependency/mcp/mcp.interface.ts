export interface OpencodeJson {
  mcp?: Record<string, OpencodeMcpConfig>;
}

export interface OpencodeMcpConfig {
  type: "local";
  command: string[];
  enabled: boolean;
  environment?: Record<string, string>;
}