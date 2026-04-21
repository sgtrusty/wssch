# Workspace Scheduler (wssch)

### _"I know you're watching, Claude/Gemini. That's why my data stays local."_

Run AI coding assistants securely with sandboxing, local knowledge, and token optimization.

## What it solves

`wssch` provides a secure, local-first environment for running AI coding assistants in your workspace. It combines:

- **Sandboxing** — Run AI agents inside an isolated bwrap environment, protecting your system
- **Local Knowledge** — RAG-powered code awareness using local embeddings (no external API calls)
- **Token Optimization** — Compress context before sending to the AI, reducing costs and improving response quality

It's designed as a workspace aggregator — a single entry point that brings together the tools and strategies you need for productive AI-assisted development.

## Technologies

- **Runtime**: TypeScript / Node.js (>=20) + Bun
- **Sandbox**: bwrap (bubblewrap)
- **RAG**: mcp-local-rag with Ollama embeddings
- **Token Compression**: RTK (rewrite)

## Prerequisites

Before using `wssch`, ensure you have:

- [bwrap](https://github.com/containers/bwrap) — Install via your package manager (e.g., `apt install bwrap`, `brew install bwrap`)
- [Node.js](https://nodejs.org/) — >=20
- [OpenCode](https://opencode.ai) — AI coding assistant
- [Ollama](https://ollama.ai) — For local embeddings (optional, RAG works without it)

## Quick Start

```bash
# Clone and install
git clone <repo> ~/tools/wssch
cd ~/tools/wssch
make install

# Add to PATH (if not already)
export PATH="$HOME/.local/bin:$PATH"

# Run in a project directory
wssch /path/to/your/project
```

## Commands

```bash
wssch run [dir]     # Launch sandboxed AI assistant (default: cwd)
wssch init [dir]   # Scaffold config in a project directory
wssch status [dir] # Check environment and configuration
```

## Configuration Storage

`wssch` stores data in `~/.config/wssch/`:

- `~/.config/wssch/bin/` — Local binaries (bun, rtk)
- `~/.config/wssch/cache/` — npm and node_modules cache
- `~/.config/wssch/opencode-config/` — OpenCode config template
- `~/.config/wssch/opencode-share/` — Shared OpenCode data
- `~/.config/wssch/whitelist.db` — Directory whitelist database

Project-specific data is stored in `.wssdata/` in your project directory:

- `.wssdata/mcp/` — MCP server configuration

## Vision

**Yes, it was AI-built. But in 2026, what's wasn't?** Still, this is built for the security-conscious — not out of tinfoil-hat paranoia, but because your codebase shouldn't be training data for the next model release. Local embeddings, isolated sandboxes, your tokens staying your tokens.

wssch aims to be extensible — a unified interface for plugging in different AI agents and strategies. Future plans include:

- Support for additional AI coding assistants
- Pluggable RAG backends and embedding providers
- Custom token compression and context strategies
- Workspace-level policies for fine-grained control

The goal: your workspace, your rules, any AI assistant.

