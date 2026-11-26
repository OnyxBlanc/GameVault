#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist/api dist/assets
cp docs/index.html dist/
cp docs/assets/* dist/assets/
php -l api/public/index.php
cp api/public/index.php dist/api/
