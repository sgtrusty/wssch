export interface SandboxBindings {
  targetDir: string;
  wssConfigDir: string;
  wssOpencodeConfigDir: string;
  wssOpencodeCacheDir: string;
  wssBinDir: string;
  wssCacheDir: string;
  wssDataDir: string;
  opencodeConfig: string;
  npmCacheDir: string;
  rtkConfigDir: string;
  term: string;
  path: string;
  home: string;
  projectDir: string;
  xdgConfigHome: string;
}

export const SANDBOX_BINDINGS: SandboxBindings = {
  targetDir: "/home/user/project",
  wssConfigDir: "/home/user/.config/wssch",
  wssOpencodeConfigDir: "/home/user/.config/opencode",
  wssOpencodeCacheDir: "/home/user/.local/share/opencode",
  wssBinDir: "/home/user/.config/wssch/bin",
  wssCacheDir: "/home/user/.cache/wssch",
  wssDataDir: "/home/user/.wssdata",
  opencodeConfig: "/home/user/.config/opencode",
  npmCacheDir: "/home/user/.cache/npm",
  rtkConfigDir: "/home/user/.config/rtk",
  term: "xterm",
  path: "/home/user/.config/wssch/bin:/usr/bin:/bin:/usr/local/bin",
  home: "/home/user",
  projectDir: "/home/user/project",
  xdgConfigHome: "/home/user/.config",
};