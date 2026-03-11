#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

# Clean
rm -rf "$BUILD_DIR"

echo "Building QuickLook extension with xcodebuild..."
xcodebuild \
    -project "$SCRIPT_DIR/YAMVQuickLook.xcodeproj" \
    -target YAMVQuickLook \
    -configuration Release \
    CONFIGURATION_BUILD_DIR="$BUILD_DIR" \
    -quiet

echo "QuickLook extension built at: $BUILD_DIR/YAMVQuickLook.appex"
