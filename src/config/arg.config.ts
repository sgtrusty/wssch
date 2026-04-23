export type Command = "run" | "init" | "status" | "deps" | "database" | "db";

export interface ArgConfig {
  cmd: Command;
  targetDir: string;
  verbose: boolean;
  force: boolean;
  whitelistHours: number;
  rtkBin: string | null;
  debug: boolean;
}

export const DEFAULT_ARGS: ArgConfig = {
  cmd: "run",
  targetDir: "",
  verbose: false,
  force: false,
  whitelistHours: 24,
  rtkBin: null,
  debug: false,
};
