#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Contact Bubbles installer"
echo "Repo: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (v20+ recommended)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required (v9+ recommended)." >&2
  exit 1
fi

NODE_VERSION="$(node -v || true)"
NPM_VERSION="$(npm -v || true)"

echo "Detected Node: $NODE_VERSION"
echo "Detected npm: $NPM_VERSION"

echo "Installing workspace dependencies..."
npm install

echo "Done. Start the app with: npm run dev"
