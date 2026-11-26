#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist/api dist/assets
cp docs/index.html dist/
cp docs/assets/* dist/assets/
php -l api/public/index.php
php -l api/public/booster.php
php -l api/public/carte.php
cp api/public/index.php api/public/booster.php api/public/carte.php dist/api/
