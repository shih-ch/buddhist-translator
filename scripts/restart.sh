#!/usr/bin/env bash
# 重新啟動：若 port 被占用則直接終止舊程序，然後啟動 Vite。
# 用法：bash scripts/restart.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"
cd "$SCRIPT_DIR/.."

PIDS="$(find_pids || true)"
if [ -n "${PIDS//[[:space:]]/}" ]; then
  echo "偵測到 port $PORT 已有程序在執行，將直接終止："
  list_pids $PIDS
  if ! kill_pids $PIDS; then
    echo "port $PORT 仍被占用，無法重啟。" >&2
    exit 1
  fi
else
  echo "port $PORT 未被占用，直接啟動。"
fi

run_vite_with_log
