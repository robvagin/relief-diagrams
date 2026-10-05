#!/usr/bin/env bash
# Environment for RELIEF: python3 >= 3.10, node >= 18, python-playwright + Chromium, clean hook
set -u
ok=1
need() { command -v "$1" >/dev/null 2>&1 || { echo "нет: $1"; ok=0; }; }
need python3; need node; need git
python3 - <<'PY' || ok=0
import sys; assert sys.version_info >= (3, 10), "python >= 3.10"
PY
node -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)' || { echo "node >= 18"; ok=0; }
python3 -c "import playwright" 2>/dev/null || pip install --user -q playwright 2>/dev/null || pip install -q --break-system-packages playwright || { echo "не встал python-playwright"; ok=0; }
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ] || ! ls "${PLAYWRIGHT_BROWSERS_PATH}" 2>/dev/null | grep -qi chrom; then
  python3 -m playwright install chromium >/dev/null 2>&1 || echo "Chromium для python-playwright не поставился: проверь доступ к сети"
fi
git config core.hooksPath .githooks 2>/dev/null || true
python3 tools/clean_check.py >/dev/null && echo "чистота: 0" || { echo "clean_check красный"; ok=0; }
python3 data/generate.py --check || ok=0
[ "$ok" = 1 ] && echo "окружение готово" || { echo "окружение НЕ готово"; exit 1; }
