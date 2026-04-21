export type Command = "run" | "init" | "status" | "deps";

export interface ArgConfig {
  cmd: Command;
  targetDir: string;
  verbose: boolean;
  force: boolean;
  whitelistHours: number;
  rtkBin: string | null;
  noRtk: boolean;
  noRag: boolean;
  noOllama: boolean;
}

export const DEFAULT_ARGS: ArgConfig = {
  cmd: "run",
  targetDir: "",
  verbose: false,
  force: false,
  whitelistHours: 24,
  rtkBin: null,
  noRtk: false,
  noRag: false,
  noOllama: false,
};
