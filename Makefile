.PHONY: help build install dev clean test

DEST := /usr/local/bin/wssch
SRC := dist/wssch.cjs

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
	@echo "Checking installation requirements..."
	@if [ ! -f $(DEST) ]; then \
		echo "Destination does not exist. Requesting sudo for initial install..."; \
		sudo cp $(SRC) $(DEST); \
		sudo chmod +x $(DEST); \
		sudo chown ${USER}:users $(DEST); \
	else \
		echo "Updating existing installation..."; \
		cp $(SRC) $(DEST); \
		chmod +x $(DEST); \
	fi
	@echo "Successfully installed wssch to $(DEST)"

clean:
	rm -rf dist
	rm -rf models
	rm -f /usr/local/bin/wssch
