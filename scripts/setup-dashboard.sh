#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "Installing dashboard dependencies..."
npm --prefix ui/web/dashboard install

echo "Building dashboard..."
npm --prefix ui/web/dashboard run build

echo "Dashboard setup complete."
