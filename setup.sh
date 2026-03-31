#!/usr/bin/env bash
set -euo pipefail

echo "[AgentFlow] Checking prerequisites..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 20+ first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."
  exit 1
fi

echo "[AgentFlow] Node: $(node -v)"
echo "[AgentFlow] npm: $(npm -v)"

echo "[AgentFlow] Installing dependencies..."
npm install

if [ ! -f .env ]; then
  echo "[AgentFlow] Creating .env from .env.example"
  cp .env.example .env
else
  echo "[AgentFlow] .env already exists, leaving it unchanged"
fi

echo "[AgentFlow] Setup complete"
echo "Next steps:"
echo "1) Edit .env and set ANTHROPIC_API_KEY"
echo "2) Run: npm run dev"
echo "3) Test: curl http://localhost:3000/health"
