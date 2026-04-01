#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
clang -O2 -fobjc-arc "$SCRIPT_DIR/ax_walker.m" -o "$SCRIPT_DIR/ax_walker" -framework ApplicationServices -framework Foundation
echo "Built ax_walker binary at $SCRIPT_DIR/ax_walker"
clang -O2 -fobjc-arc "$SCRIPT_DIR/media_detector.m" -o "$SCRIPT_DIR/media_detector" -framework Foundation -framework CoreAudio -framework IOKit -framework AppKit
echo "Built media_detector binary at $SCRIPT_DIR/media_detector"
