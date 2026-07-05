export interface SandboxBindings {
  targetDir: string;
  wssConfigDir: string;
  wssOpencodeConfigDir: string;
  wssOpencodeCacheDir: string;
  wssBinDir: string;
  wssDataDir: string;
  opencodeConfig: string;
  rtkConfigDir: string;
  term: string;
  path: string;
  home: string;
  projectDir: string;
  xdgConfigHome: string;
}

const HOMEDIR = "/home/user";

export const SANDBOX_BINDINGS: SandboxBindings = {
  targetDir: `${HOMEDIR}/project`,
  wssConfigDir: `${HOMEDIR}/.config/wssch`,
  wssOpencodeConfigDir: `${HOMEDIR}/.config/opencode`,
  wssOpencodeCacheDir: `${HOMEDIR}/.local/share/opencode`,
  wssBinDir: `${HOMEDIR}/.config/wssch/bin`,
  wssDataDir: `${HOMEDIR}/.wssdata`,
  opencodeConfig: `${HOMEDIR}/.config/opencode`,
  rtkConfigDir: `${HOMEDIR}/.config/rtk`,
  term: "xterm",
  path: `${HOMEDIR}/.config/wssch/bin:/usr/bin:/bin:/usr/local/bin`,
  home: `${HOMEDIR}`,
  projectDir: `${HOMEDIR}/project`,
  xdgConfigHome: `${HOMEDIR}/.config`,
};
