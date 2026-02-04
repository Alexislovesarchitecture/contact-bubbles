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

echo "Detected Node: $(node -v)"
echo "Detected npm: $(npm -v)"

echo "Installing workspace dependencies..."
npm install

cat <<'NEXT'

Install complete.

Next steps:
  npm run dev

The app will start the server and client together.
NEXT
