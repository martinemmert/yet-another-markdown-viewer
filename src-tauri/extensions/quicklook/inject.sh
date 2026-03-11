#!/bin/bash
set -euo pipefail

# Injects the QuickLook .appex into a YAMV.app bundle
# Usage: inject.sh /path/to/YAMV.app

APP_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPEX_SRC="$SCRIPT_DIR/build/YAMVQuickLook.appex"
PLUGINS_DIR="$APP_PATH/Contents/PlugIns"

if [ ! -d "$APPEX_SRC" ]; then
    echo "Error: QuickLook extension not built. Run build.sh first."
    exit 1
fi

mkdir -p "$PLUGINS_DIR"
rm -rf "$PLUGINS_DIR/YAMVQuickLook.appex"
cp -R "$APPEX_SRC" "$PLUGINS_DIR/"

echo "Injected QuickLook extension into $APP_PATH"
