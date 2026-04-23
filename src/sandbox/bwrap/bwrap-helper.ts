import { exec } from "node:child_process";
import { promisify } from "node:util";
import { access, constants, readdir, stat, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const execAsync = promisify(exec);

const ALLOWED_BINARIES = new Set([
  "id",
  "rg",
  "uname",
  "arch",
  "readlink",
  "realpath",
  "sha256sum",
  "unzip",
  "wget",
  "expr",
  "chmod",
  "awk",
  "basename",
  "tee",
  "gzip",
  "fd",
  "nvim",
  "git",
  "bash",
  "sh",
  "python3",
  "node",
  "vim",
  "sed",
  "grep",
  "ls",
  "cat",
  "curl",
  "tar",
  "stty",
  "env",
  "dirname",
  "mkdir",
  "rm",
  "mv",
  "cp",
  "which",
  "sleep",
  "tr",
  "tail",
  "cut",
  "whoami",
  "pip",
  "python",
  "dash",
  "zsh",
  "fish",
  "tmux",
  "rsync",
  "ssh",
  "scp",
  "sftp",
  "ping",
  "ping6",
  "pgrep",
  "pkill",
  "killall",
  "ps",
  "pidof",
  "watch",
  "xargs",
  "dd",
  "df",
  "du",
  "free",
  "uptime",
  "w",
  "who",
  "date",
  "nproc",
  "getconf",
  "lscpu",
  "lsblk",
  "blkid",
  "findmnt",
  "nice",
  "renice",
  "getent",
  "groups",
  "logname",
  "tty",
  "yes",
  "clear",
  "reset",
  "tput",
  "fold",
  "fmt",
  "paste",
  "join",
  "comm",
  "diff",
  "cmp",
  "bc",
  "factor",
  "seq",
  "shuf",
  "sort",
  "uniq",
  "wc",
  "head",
  "less",
  "more",
  "hexdump",
  "od",
  "xxd",
  "base64",
  "md5sum",
  "sha1sum",
  "sha512sum",
  "stat",
  "sync",
  "lsof",
  "perf",
  "addr2line",
  "nm",
  "objcopy",
  "objdump",
  "readelf",
  "strings",
  "strip",
  "cmake",
  "cpack",
  "ctest",
  "meson",
  "ninja",
  "m4",
  "lex",
  "flex",
  "bison",
  "cmake",
  "cpack",
  "ctest",
  "meson",
  "ninja",
  "scons",
  "javac",
  "java",
  "jar",
  "kotlin",
  "scalac",
  "scala",
  "go",
  "gofmt",
  "ruby",
  "perl",
  "lua",
  "lua5.1",
  "luajit",
  "php",
  "dotnet",
  "mono",
  "rust-analyzer",
  "clangd",
  "clang-format",
  "clang-tidy",
  "pyright",
  "pylsp",
  "ruff",
  "mypy",
  "gopls",
  "typescript",
  "tsc",
  "deno",
  "bun",
  "ruff",
  "prettier",
  "eslint",
  "rome",
  "biome",
  "taplo",
  "yaml-language-server",
  "yaml-lint",
  "dockerfile-language-server",
  "dockerfile-lint",
  "hadolint",
  "shellcheck",
  "bash-language-server",
  "Marksman",
  "ccls",
  "cquery",
  "ccls",
  "jedi-language-server",
  "jedi",
  "fortran-language-server",
  "fortran",
  "lua-language-server",
  "vim-language-server",
  "vim-lsp",
  "servedl",
  "serve",
  "json-lint",
  "jsonfmt",
  "jq",
  "yq",
  "toml-sort",
  "taplo",
  "editorconfig-checker",
  "editorconfig",
  "pre-commit",
  "commitlint",
  "husky",
  "lint-staged",
  "wssch",
  "sqlite3",
  "opencode",
]);

const SYSTEM_PATHS = [
  "/usr/share",
  "/usr/lib",
  "/usr/lib64",
  "/usr/include",
  "/usr/local/include",
  "/usr/share/terminfo",
  "/usr/share/zoneinfo",
  "/usr/share/nvim",
  "/usr/lib/os-release",
  "/etc/os-release",
  "/etc/lsb-release",
  "/etc/inputrc",
  "/etc/resolv.conf",
  "/etc/hosts",
  "/etc/ssl",
  "/etc/fonts",
  "/etc/ca-certificates",
  "/etc/ld.so.cache",
];

async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`command -v ${cmd}`, {
      shell: "/bin/sh",
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function realpath(p: string): Promise<string> {
  try {
    return resolve(p);
  } catch {
    return p;
  }
}

export async function buildUsrBinArgs(): Promise<string[]> {
  const args: string[] = [];

  args.push("--dir", "/usr/bin");
  args.push("--dir", "/usr/libexec");

  args.push("--symlink", "usr/bin", "/bin");
  args.push("--symlink", "usr/bin", "/sbin");
  args.push("--symlink", "usr/bin", "/usr/sbin");
  args.push("--symlink", "usr/lib", "/lib");
  args.push("--symlink", "usr/lib64", "/lib64");

  for (const bin of ALLOWED_BINARIES) {
    const hostPath = await which(bin);
    if (!hostPath) continue;

    const realPath = await realpath(hostPath);
    args.push("--ro-bind", realPath, `/usr/bin/${bin}`);

    if (hostPath !== realPath) {
      args.push("--ro-bind-try", realPath, realPath);
    }
  }

  for (const p of SYSTEM_PATHS) {
    try {
      await access(p, constants.F_OK);
      args.push("--ro-bind-try", p, p);
    } catch {
    }
  }

  return args;
}

export async function writeArgsToFile(args: string[]): Promise<string> {
  const path = join(tmpdir(), `bwrap-args-${randomUUID()}`);
  const content = args.join("\n") + "\n";
  await writeFile(path, content, { mode: 0o600 });
  return path;
}

export async function mountUsrBinRecursive(
  bwrapArgs: string[],
  srcDir: string,
  targetDir: string,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(srcDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const targetPath = join(targetDir, entry);

    try {
      const st = await stat(srcPath);
      if (st.isDirectory()) {
        bwrapArgs.push("--dir", targetPath);
        await mountUsrBinRecursive(bwrapArgs, srcPath, targetPath);
      } else if (st.isFile()) {
        bwrapArgs.push("--ro-bind", srcPath, targetPath);
      }
    } catch {
    }
  }
}