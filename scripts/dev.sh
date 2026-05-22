#!/usr/bin/env bash
# 啟動 Vite 開發伺服器，並在發現舊有程序時詢問是否終止。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"
cd "$SCRIPT_DIR/.."

PIDS="$(find_pids || true)"

if [ -n "${PIDS//[[:space:]]/}" ]; then
  echo "偵測到 port $PORT 已有程序在執行："
  list_pids $PIDS

  if [ ! -t 0 ]; then
    echo "非互動模式，預設不終止舊程序，請手動處理後再試。" >&2
    exit 1
  fi

  read -r -p "是否終止舊程序並重新啟動？[y/N] " ans
  case "$ans" in
    y|Y|yes|YES)
      if ! kill_pids $PIDS; then
        echo "port $PORT 仍被占用，無法啟動。" >&2
        exit 1
      fi
      ;;
    *)
      echo "已取消啟動。"
      exit 0
      ;;
  esac
fi

run_vite_with_log
