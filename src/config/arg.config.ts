export type Command = "run" | "init" | "status" | "deps" | "database" | "db" | "orchestrate" | "orcs" | "profile" | "profiles";

export interface ArgConfig {
  cmd: Command;
  targetDir: string;
  verbose: boolean;
  force: boolean;
  whitelistHours: number;
  rtkBin: string | null;
  debug: boolean;
  harnessOverride: string | null;
  profile: string | null;
  profileSub: string | null;
  profileSubArgs: string[];
}

export const DEFAULT_ARGS: ArgConfig = {
  cmd: "run",
  targetDir: "",
  verbose: false,
  force: false,
  whitelistHours: 24,
  rtkBin: null,
  debug: false,
  harnessOverride: null,
  profile: null,
  profileSub: null,
  profileSubArgs: [],
};
