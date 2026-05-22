#!/usr/bin/env bash
# 顯示開發伺服器目前狀態。
# 用法：bash scripts/status.sh
# Exit code：0=執行中、1=未執行、2=其他錯誤
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"
cd "$SCRIPT_DIR/.."

PIDS="$(find_pids || true)"

if [ -z "${PIDS//[[:space:]]/}" ]; then
  echo "● 狀態：未執行"
  echo "  port $PORT 沒有監聽中的程序"
  exit 1
fi

echo "● 狀態：執行中"
echo "  port:  $PORT"
echo "  URL:   http://localhost:$PORT/buddhist-translator/"
echo

for pid in $PIDS; do
  echo "  PID $pid"
  if [ -r "/proc/$pid/cmdline" ]; then
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline")"
  else
    cmd="$(ps -p "$pid" -o args= 2>/dev/null || echo '(無法讀取)')"
  fi
  echo "    cmd:    $cmd"

  # 啟動時間 / 累計 CPU 時間
  if etime_cpu="$(ps -p "$pid" -o lstart=,etime=,%cpu=,%mem= 2>/dev/null)"; then
    echo "    info:   $(echo "$etime_cpu" | sed 's/^[[:space:]]*//')"
  fi

  # 工作目錄
  if cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)"; then
    echo "    cwd:    $cwd"
  fi
done

# 額外：監聽位址（v4/v6）
if command -v ss >/dev/null 2>&1; then
  echo
  echo "  listen:"
  ss -ltn "sport = :$PORT" 2>/dev/null | awk 'NR>1 {printf "    %s %s\n", $1, $4}'
fi

exit 0
