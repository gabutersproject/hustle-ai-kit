#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models
curl -L --fail --retry 3 -o models/qwen2.5-1.5b-instruct-q5_k_m.gguf \
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q5_k_m.gguf"
echo "Saved models/qwen2.5-1.5b-instruct-q5_k_m.gguf"
