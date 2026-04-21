.PHONY: help build install dev clean test

help:
	@echo "wssch - Workspace Sandbox for AI"
	@echo ""
	@echo "Targets:"
	@echo "  build    Build wssch"
	@echo "  install Install wssch to /usr/local/bin"
	@echo "  dev     Watch mode for development"
	@echo "  clean   Clean build artifacts"

# Build wssch
build:
	bun install && bun run build && bun run bundle:bin

dev:
	bun run dev

install: 
	@echo "Installing wssch to /usr/local/bin/wssch..."
	@cp dist/wssch.cjs /usr/local/bin/wssch
	@chmod +x /usr/local/bin/wssch
	@echo "Installed wssch to /usr/local/bin/wssch"
	@echo "Make sure /usr/local/bin is in your PATH"

clean:
	rm -rf dist
	rm -rf models
	rm -f /usr/local/bin/wssch
