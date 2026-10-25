import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { logger } from "@lib/logger.js";

export interface Profile {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: number;
  description?: string;
}

export interface ProfileRegistry {
  version: number;
  profiles: Profile[];
  lastUsed: string | null;
}

const REGISTRY_VERSION = 1;
const DEFAULT_NAME = "default";
export const PROFILES_DIR = "profiles";
const REGISTRY_FILE = "profiles.json";

function resolveGlobalDir(): string {
  return process.env.WSS_CONFIG_DIR || `${process.env.HOME}/.config/wssch`;
}

let GLOBAL_DIR = resolveGlobalDir();

export function setGlobalDir(dir: string): void {
  GLOBAL_DIR = dir;
}

export function isInSandbox(): boolean {
  return process.env.WSS_IN_SANDBOX === "true";
}

function profilesRoot(): string {
  return join(GLOBAL_DIR, PROFILES_DIR);
}

function registryPath(): string {
  return join(GLOBAL_DIR, REGISTRY_FILE);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function safeExists(p: string): boolean {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}

function findProfile(
  reg: ProfileRegistry,
  idOrName: string,
): Profile | undefined {
  const needle = idOrName.trim().toLowerCase();
  return (
    reg.profiles.find((p) => p.id.toLowerCase() === needle) ??
    reg.profiles.find((p) => p.name.toLowerCase() === needle)
  );
}

export function getProfile(idOrName: string): Profile | undefined {
  return findProfile(getRegistry(), idOrName);
}

/** Returns the in-memory registry (no file IO) when inside the sandbox. */
export function getRegistry(): ProfileRegistry {
  if (isInSandbox()) {
    const id = process.env.WSS_PROFILE || "sandbox";
    return {
      version: REGISTRY_VERSION,
      profiles: [{ id, name: id, isDefault: true, createdAt: 0 }],
      lastUsed: id,
    };
  }

  migrateIfNeeded();

  try {
    const raw = readFileSync(registryPath(), "utf-8");
    const parsed = JSON.parse(raw) as ProfileRegistry;
    if (!Array.isArray(parsed.profiles)) parsed.profiles = [];
    if (parsed.lastUsed === undefined) parsed.lastUsed = null;
    return parsed;
  } catch {
    return { version: REGISTRY_VERSION, profiles: [], lastUsed: null };
  }
}

function saveRegistry(reg: ProfileRegistry): void {
  if (isInSandbox()) return;
  try {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    writeFileSync(registryPath(), JSON.stringify(reg, null, 2) + "\n");
  } catch (err) {
    logger.warn("profile", `Failed to persist profile registry: ${err}`);
  }
}

function nextId(reg: ProfileRegistry): string {
  let max = 0;
  for (const p of reg.profiles) {
    const n = parseInt(p.id, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

export function listProfiles(): Profile[] {
  return getRegistry().profiles;
}

export function resolveActive(profileArg?: string | null): Profile {
  if (isInSandbox()) {
    const id = process.env.WSS_PROFILE || "sandbox";
    return { id, name: id, isDefault: true, createdAt: 0 };
  }

  const reg = getRegistry();

  if (profileArg && profileArg.trim()) {
    const existing = findProfile(reg, profileArg);
    if (existing) return existing;
    return createProfile(profileArg, undefined, reg);
  }

  if (reg.lastUsed) {
    const last = reg.profiles.find((p) => p.id === reg.lastUsed);
    if (last) return last;
  }

  const def = reg.profiles.find((p) => p.isDefault) ?? reg.profiles[0];
  if (def) return def;

  return createProfile(DEFAULT_NAME, undefined, reg);
}

export function createProfile(
  name?: string,
  description?: string,
  existingReg?: ProfileRegistry,
): Profile {
  if (isInSandbox()) {
    throw new Error("Cannot create profiles inside the sandbox");
  }

  const reg = existingReg ?? getRegistry();
  const id = nextId(reg);
  const profileName =
    name && name.trim() ? name.trim() : `profile-${id}`;

  const profile: Profile = {
    id,
    name: profileName,
    isDefault: reg.profiles.length === 0,
    createdAt: nowSec(),
    description,
  };

  reg.profiles.push(profile);
  if (reg.lastUsed === null) reg.lastUsed = id;
  saveRegistry(reg);

  try {
    mkdirSync(join(profilesRoot(), id), { recursive: true });
  } catch (err) {
    logger.warn("profile", `Failed to create profile dir: ${err}`);
  }

  return profile;
}

export function renameProfile(id: string, name: string): boolean {
  if (isInSandbox()) return false;
  const reg = getRegistry();
  const target = reg.profiles.find((p) => p.id === id);
  if (!target) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  target.name = trimmed;
  saveRegistry(reg);
  return true;
}

export function setDefault(id: string): boolean {
  if (isInSandbox()) return false;
  const reg = getRegistry();
  const target = reg.profiles.find((p) => p.id === id);
  if (!target) return false;
  for (const p of reg.profiles) p.isDefault = p.id === id;
  saveRegistry(reg);
  return true;
}

export function setLastUsed(id: string): void {
  if (isInSandbox()) return;
  const reg = getRegistry();
  if (!reg.profiles.some((p) => p.id === id)) return;
  reg.lastUsed = id;
  saveRegistry(reg);
}

export function deleteProfile(id: string): boolean {
  if (isInSandbox()) return false;
  const reg = getRegistry();

  if (reg.profiles.length <= 1) {
    logger.warn("profile", "Cannot delete the last remaining profile");
    return false;
  }

  const idx = reg.profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  reg.profiles.splice(idx, 1);

  try {
    rmSync(join(profilesRoot(), id), { recursive: true, force: true });
  } catch {}

  if (reg.lastUsed === id) {
    reg.lastUsed = reg.profiles[0]?.id ?? null;
  }
  if (!reg.profiles.some((p) => p.isDefault) && reg.profiles[0]) {
    reg.profiles[0].isDefault = true;
  }

  saveRegistry(reg);
  return true;
}

const LEGACY_ITEMS = [
  "config.db",
  "rag.db",
  "bin",
  "data",
  "rtk",
  "config",
  "share",
  "projects",
];

function migrateIfNeeded(): void {
  const regPath = registryPath();
  if (safeExists(regPath)) return;

  const root = profilesRoot();
  if (safeExists(root)) {
    rebuildRegistry();
    return;
  }

  const hasLegacy = LEGACY_ITEMS.some((item) =>
    safeExists(join(GLOBAL_DIR, item)),
  );

  mkdirSync(root, { recursive: true });
  const id = "1";
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });

  if (hasLegacy) {
    for (const item of LEGACY_ITEMS) {
      const src = join(GLOBAL_DIR, item);
      if (safeExists(src)) {
        try {
          renameSync(src, join(dir, item));
        } catch (err) {
          logger.warn("profile", `Migration skipped for ${item}: ${err}`);
        }
      }
    }
  }

  const reg: ProfileRegistry = {
    version: REGISTRY_VERSION,
    profiles: [
      { id, name: DEFAULT_NAME, isDefault: true, createdAt: nowSec() },
    ],
    lastUsed: id,
  };
  saveRegistry(reg);
}

function rebuildRegistry(): void {
  const root = profilesRoot();
  let entries: string[] = [];
  try {
    entries = readdirSync(root).filter((e) => {
      try {
        return statSync(join(root, e)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    entries = [];
  }

  entries.sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const profiles: Profile[] = entries.map((id) => ({
    id,
    name: id === "1" ? DEFAULT_NAME : id,
    isDefault: false,
    createdAt: nowSec(),
  }));

  if (profiles.length) profiles[0].isDefault = true;

  const reg: ProfileRegistry = {
    version: REGISTRY_VERSION,
    profiles,
    lastUsed: profiles[0]?.id ?? null,
  };
  saveRegistry(reg);
}

export const profileService = {
  setGlobalDir,
  isInSandbox,
  getRegistry,
  getProfile,
  listProfiles,
  resolveActive,
  createProfile,
  renameProfile,
  setDefault,
  setLastUsed,
  deleteProfile,
};
