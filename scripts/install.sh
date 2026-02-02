#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "Contact Bubbles Installer\n"
printf "Working directory: %s\n" "$ROOT_DIR"

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Please install Node.js 20+ and re-run this installer." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Please install npm 9+ and re-run this installer." >&2
  exit 1
fi

printf "Node version: %s\n" "$(node -v)"
printf "npm version: %s\n" "$(npm -v)"

npm install

cat <<'NEXT'

Install complete.

Next steps:
  npm run dev

The app will start the server and client together.
NEXT
