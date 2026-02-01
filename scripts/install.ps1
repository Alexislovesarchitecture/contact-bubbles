$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "Contact Bubbles installer"
Write-Host "Repo: $RootDir"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is required (v20+ recommended)."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required (v9+ recommended)."
}

$NodeVersion = node -v
$NpmVersion = npm -v

Write-Host "Detected Node: $NodeVersion"
Write-Host "Detected npm: $NpmVersion"

Write-Host "Installing workspace dependencies..."
npm install

Write-Host "Done. Start the app with: npm run dev"
