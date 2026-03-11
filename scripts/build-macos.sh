#!/bin/bash
set -euo pipefail

# Wrapper build script for tauri-action on macOS.
# Called as: bash scripts/build-macos.sh build --target universal-apple-darwin
# Builds the QuickLook extension and injects it into the .app after tauri build.

# 1. Build the QuickLook renderer JS bundle
echo "Building QuickLook renderer..."
node src-tauri/extensions/quicklook/resources/build-renderer.js

# 2. Build the QuickLook .appex
echo "Building QuickLook extension..."
bash src-tauri/extensions/quicklook/build.sh

# 3. Run the actual tauri build (passes through all args from tauri-action)
npx tauri "$@"

# 4. Post-process: inject QuickLook extension into the built .app
APP=$(find src-tauri/target -name "YAMV.app" -path "*/bundle/macos/*" 2>/dev/null | head -1)
if [ -z "$APP" ]; then
  echo "Warning: Could not find YAMV.app bundle, skipping QuickLook injection"
  exit 0
fi

echo "Injecting QuickLook extension into $APP..."
bash src-tauri/extensions/quicklook/inject.sh "$APP"

# 5. Recreate the DMG with the modified .app
DMG=$(find src-tauri/target -name "*.dmg" -path "*/bundle/dmg/*" 2>/dev/null | head -1)
if [ -n "$DMG" ]; then
  echo "Recreating DMG at $DMG..."
  rm -f "$DMG"
  hdiutil create -volname "YAMV" -srcfolder "$APP" -ov -format UDZO "$DMG"
fi

# 6. Recreate the updater .tar.gz and re-sign it
TARGZ=$(find src-tauri/target -name "*.tar.gz" -path "*/bundle/macos/*" 2>/dev/null | head -1)
if [ -n "$TARGZ" ]; then
  echo "Recreating updater archive at $TARGZ..."
  rm -f "$TARGZ" "${TARGZ}.sig"
  tar -czf "$TARGZ" -C "$(dirname "$APP")" "$(basename "$APP")"

  if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
    echo "Re-signing updater archive..."
    npx tauri signer sign --private-key "$TAURI_SIGNING_PRIVATE_KEY" \
      ${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:+--password "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD"} \
      "$TARGZ"
  fi
fi

echo "macOS build with QuickLook extension complete."
