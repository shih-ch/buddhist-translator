#!/usr/bin/env bash
# 顯示 / 追蹤開發伺服器日誌。
# 用法：bash scripts/logs.sh [選項]
#   -n, --lines N    顯示最近 N 行（預設 50）
#   -F, --no-follow  顯示後即離開（預設持續追蹤）
#   -p, --prev       讀取上一輪日誌（dev.log.1）
#   -c, --clear      清空目前日誌
#   -h, --help       本說明
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"
cd "$SCRIPT_DIR/.."

LINES=50
FOLLOW=1
TARGET="$LOG_FILE"
CLEAR=0

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--lines)
      LINES="${2:-}"
      [ -z "$LINES" ] && { echo "--lines 缺少數值" >&2; exit 2; }
      shift 2
      ;;
    -F|--no-follow) FOLLOW=0; shift ;;
    -p|--prev) TARGET="$LOG_FILE.1"; FOLLOW=0; shift ;;
    -c|--clear) CLEAR=1; shift ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知參數：$1" >&2; exit 2 ;;
  esac
done

if [ "$CLEAR" -eq 1 ]; then
  if [ -f "$LOG_FILE" ]; then
    : > "$LOG_FILE"
    echo "已清空 $LOG_FILE"
  else
    echo "$LOG_FILE 不存在，無需清空。"
  fi
  exit 0
fi

if [ ! -f "$TARGET" ]; then
  echo "找不到日誌檔：$TARGET"
  echo "請先以 npm run dev:safe 或 npm run restart 啟動，才會產生日誌。"
  exit 1
fi

if [ "$FOLLOW" -eq 1 ]; then
  echo "── 追蹤 $TARGET （Ctrl+C 離開）──"
  exec tail -n "$LINES" -f "$TARGET"
else
  tail -n "$LINES" "$TARGET"
fi
