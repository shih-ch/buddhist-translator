#!/usr/bin/env bash
# 停止占用開發 port 的程序。
# 用法：bash scripts/stop.sh [-y]
#   -y / --yes：不詢問，直接終止
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"
cd "$SCRIPT_DIR/.."

ASSUME_YES=0
case "${1:-}" in
  -y|--yes) ASSUME_YES=1 ;;
  '') ;;
  *) echo "未知參數：$1" >&2; exit 2 ;;
esac

PIDS="$(find_pids || true)"
if [ -z "${PIDS//[[:space:]]/}" ]; then
  echo "port $PORT 目前沒有程序在執行。"
  exit 0
fi

echo "偵測到 port $PORT 已有程序在執行："
list_pids $PIDS

if [ "$ASSUME_YES" -eq 0 ]; then
  if [ ! -t 0 ]; then
    echo "非互動模式，需加 -y 才會終止。" >&2
    exit 1
  fi
  read -r -p "是否終止？[y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "已取消。"; exit 0 ;;
  esac
fi

if kill_pids $PIDS; then
  echo "已釋放 port $PORT。"
else
  echo "port $PORT 仍被占用，請手動檢查。" >&2
  exit 1
fi
