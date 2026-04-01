#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
clang -O2 -fobjc-arc "$SCRIPT_DIR/ax_walker.m" -o "$SCRIPT_DIR/ax_walker" -framework ApplicationServices -framework Foundation
echo "Built ax_walker binary at $SCRIPT_DIR/ax_walker"
