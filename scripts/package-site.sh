#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$project_root/dist/server" "$project_root/dist/.openai"
cp "$project_root/worker/index.js" "$project_root/dist/server/index.js"
cp "$project_root/.openai/hosting.json" "$project_root/dist/.openai/hosting.json"
