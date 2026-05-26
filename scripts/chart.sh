#!/usr/bin/env bash
# Wrapper for chart-analysis-tool. Usage: ./scripts/chart.sh <TOKEN_ADDRESS> [SYMBOL]
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL="$HERE/../tools/chart-analysis-tool"
exec "$TOOL/.venv/bin/python" "$TOOL/chart_analysis.py" "$@"
