const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  orange: "\x1b[38;5;214m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const SCOPE_COLORS: Record<string, keyof typeof COLORS> = {
  lifecycle: "cyan",
  startup: "blue",
  hook: "magenta",
  subdep: "green",
  launcher: "yellow",
  sandbox: "gray",
};

const STATUS_SYMBOLS = {
  check: "✓",
  x: "✗",
  warn: "⚠",
  progress: "…",
  info: "›",
  debug: "?",
};

type LogScope = keyof typeof SCOPE_COLORS;
type LogStatus = keyof typeof STATUS_SYMBOLS;

export interface LoggerOptions {
  prefix?: string;
  verbose?: boolean;
}

let options: LoggerOptions = {
  prefix: "sandbox",
  verbose: false,
};

export function initLogger(opts: LoggerOptions = {}): void {
  options = { ...options, ...opts };
}

function formatScope(scope: LogScope): string {
  const color = SCOPE_COLORS[scope] || "gray";
  return `${COLORS.bold}${options.prefix}${COLORS.reset} ${COLORS[color]}[${scope.toUpperCase()}]${COLORS.reset}`;
}

function formatStatus(status: LogStatus): string {
  const symbol = STATUS_SYMBOLS[status];
  let color: keyof typeof COLORS = "gray";
  switch (status) {
    case "check":
      color = "green";
      break;
    case "x":
      color = "red";
      break;
    case "warn":
      color = "yellow";
      break;
    case "progress":
      color = "dim";
      break;
    case "info":
      color = "gray";
      break;
    case "debug":
      color = "orange";
      break;
  }
  return `${COLORS[color]}${symbol}${COLORS.reset}`;
}

export function log(scope: LogScope, status: LogStatus, message: string): void {
  if (status === "progress" && !options.verbose) return;
  const prefix = formatScope(scope);
  const symbol = formatStatus(status);
  console.error(`${prefix} ${symbol} ${message}`);
}

export const logger = {
  scope: (scope: LogScope, message: string) => log(scope, "info", message),
  check: (scope: LogScope, message: string) => log(scope, "check", message),
  fail: (scope: LogScope, message: string) => log(scope, "x", message),
  warn: (scope: LogScope, message: string) => log(scope, "warn", message),
  progress: (scope: LogScope, message: string) =>
    log(scope, "progress", message),
  info: (scope: LogScope, message: string) => log(scope, "info", message),
  debug: (scope: LogScope, message: string) => log(scope, "debug", message),
};

