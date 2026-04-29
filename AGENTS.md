# wssch Project Knowledge Base

## For Future Agents (Big Pickle / Opencode)

## Project Overview
- **wssch**: Workspace Sandbox for AI
- **Purpose**: Provides sandboxed execution environment for AI coding agents (opencode), manages dependencies, RAG systems, user preferences, and directory whitelisting
- **Tech Stack**: TypeScript, Bun runtime, SQLite (via `sqlite3` CLI), MCP (Model Context Protocol) integrations

---

## Build & Development Commands

### Building
```bash
npm run build        # Compile TypeScript with tsc
npm run bundle       # Bundle with esbuild (ESM format)
npm run bundle:bin   # Bundle as CJS with shebang for CLI
npm run dev          # Watch mode with tsc --watch
```

### Linting & Type Checking
```bash
npx tsc --noEmit    # Type check without emitting files
```

### Testing
**No test framework is currently configured.** To add tests:
1. Install a test framework (vitest, jest, or bun:test)
2. Create `*.test.ts` files in `src/` or `tests/` directory
3. Add test scripts to `package.json`

Example for running a single test (once framework is added):
```bash
# Vitest example
npx vitest run src/db/pref.service.test.ts

# Bun test example
bun test src/db/pref.service.test.ts
```

### Runtime Commands
```bash
wssch run [project-dir]  # Start sandbox + orchestrator (default)
wssch init               # Scaffold project without sandbox
wssch db                 # Edit preferences in database
wssch status             # Show wssch status
wssch deps               # Manage dependencies
```

---

## Code Style Guidelines

### Imports & Module System
- **Module type**: ESM (`"type": "module"` in package.json)
- **Extensions**: Always include `.js` extension in imports, even for TypeScript files
  ```typescript
  import { configService } from "@config/index.js";
  import type { ArgConfig } from "./arg.config.js";
  ```
- **Path aliases**: Use configured aliases instead of relative paths
  ```typescript
  // Good
  import { logger } from "@lib/logger.js";
  import { configService } from "@config/index.js";

  // Avoid (unless in same directory)
  import { something } from "../../lib/something.js";
  ```
- **Type imports**: Use `import type` for type-only imports
  ```typescript
  import type { Dependency } from "@runtime/runtime.interface.js";
  ```

### Formatting & Types
- **Target**: ES2022, strict mode enabled
- **No formatter configured**: No ESLint, Prettier, or Biome config found
- **Recommendation**: Follow existing code style in the codebase
- **TypeScript**: Use explicit types, avoid `any`
  ```typescript
  export interface Preferences {
    preferredMcpServer: string;
    ollamaUrl: string;
    embeddingModel: string;
  }
  ```

### Naming Conventions
- **Files**: kebab-case with descriptive names (e.g., `pref.service.ts`, `config.service.ts`)
- **Interfaces**: PascalCase with descriptive names (e.g., `Preferences`, `ArgConfig`, `Dependency`)
- **Types**: PascalCase for type aliases (e.g., `LogScope`, `RagQueryResult`)
- **Classes**: PascalCase, descriptive (e.g., `ConfigService`, `LocalRagClient`, `InstallerService`)
- **Functions**: camelCase, verb-first (e.g., `initPreferences`, `isWhitelisted`, `scaffold`)
- **Constants**: camelCase or UPPER_SNAKE_CASE for module-level constants
- **Private fields**: Use private keyword or prefix with underscore

### Error Handling
- **Database operations**: Use try/catch with empty catch blocks for sqlite3 spawn operations
  ```typescript
  try {
    const proc = spawn("sqlite3", [dbPath, sql], { stdio: "ignore" });
    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {}
  ```
- **Avoid throwing errors** in database operations; return boolean or default values instead
- **Log errors** using the logger utility: `logger.fail()`, `logger.warn()`

### Architecture Patterns
- **Services**: Singleton classes with private constructor, exported instance
  ```typescript
  class ConfigService {
    private config: FullConfig | null = null;
    // ...
  }
  export const configService = new ConfigService();
  ```
- **Interfaces**: Define in separate files, export from index
- **Dependencies**: Implement `Dependency` interface with lifecycle methods

---

## Current Architecture

### Path Configuration
Defined in `src/config/paths.config.ts` and managed by `src/config/config.service.ts`:

| Path Variable | Default Location | Purpose |
|---------------|-----------------|---------|
| `wssConfigDir` | `~/.config/wssch` | Global config storage (env: `WSS_CONFIG_DIR`) |
| `wssDataDir` | `{project-root}/.wssdata` | Per-project data storage |
| `wssBinDir` | `~/.config/wssch/bin` | Downloaded binaries (MCP servers, tools) |

### Database Access Pattern
- All DB operations use `sqlite3` CLI via `spawn`, never direct SQLite library imports
- No async locks required: `sqlite3` CLI handles file locking, operations are atomic
- Error handling uses try/catch with empty catch blocks

### Key Service Files
- **`src/config/config.service.ts`**: Singleton config service, parses CLI args, loads `.env`
- **`src/db/pref.service.ts`**: Preferences CRUD operations
- **`src/db/whitelist.service.ts`**: Whitelist CRUD operations
- **`src/runtime/dependency/mcp/localRag.ts`**: Local RAG client, manages `rag.db`

---

## Rules for Agents
1. Always use `configService.paths` for path references - never hardcode directories
2. Preserve existing `sqlite3` spawn pattern unless explicitly upgrading to in-process SQLite
3. When modifying DB schemas, use `CREATE TABLE IF NOT EXISTS` for backwards compatibility
4. Use path aliases (`@config/`, `@runtime/`, etc.) instead of relative imports
5. Include `.js` extensions in all imports
6. Use `import type` for type-only imports
7. Update this file when making significant architectural changes
