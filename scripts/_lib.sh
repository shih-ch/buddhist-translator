#!/usr/bin/env bash
# 共用工具：port 偵測、列出 PID、終止舊程序。
# 由 dev.sh / stop.sh / restart.sh 透過 `source` 引入。

PORT="${PORT:-5178}"
LOG_DIR="${LOG_DIR:-.logs}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/dev.log}"

# 啟動前呼叫：保留上一輪為 dev.log.1，建立新的空檔。
rotate_log() {
  mkdir -p "$LOG_DIR"
  if [ -s "$LOG_FILE" ]; then
    mv -f "$LOG_FILE" "$LOG_FILE.1" 2>/dev/null || true
  fi
  : > "$LOG_FILE"
}

# 把 Vite 輸出同時送到 stdout 與 log，回傳 npm 的 exit code。
run_vite_with_log() {
  rotate_log
  echo "啟動 Vite (port $PORT)…日誌：$LOG_FILE"
  # stdbuf -oL：強制行緩衝，避免 Node pipe 時延遲
  if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL npm run dev 2>&1 | tee -a "$LOG_FILE"
  else
    npm run dev 2>&1 | tee -a "$LOG_FILE"
  fi
}

find_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  elif command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$PORT" 2>/dev/null \
      | awk -F'pid=' 'NR>1 {split($2,a,","); print a[1]}' \
      | sort -u
  elif command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$PORT" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true
  else
    echo "找不到 lsof / ss / fuser，無法偵測 port $PORT" >&2
    return 1
  fi
}

# 印出每個 PID 與對應的指令列。
list_pids() {
  local pid cmd
  for pid in "$@"; do
    if [ -r "/proc/$pid/cmdline" ]; then
      cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline")"
    else
      cmd="$(ps -p "$pid" -o args= 2>/dev/null || echo '(無法讀取)')"
    fi
    printf '  PID %s — %s\n' "$pid" "$cmd"
  done
}

# 先 SIGTERM、等待 port 釋放，必要時 SIGKILL。
# 回傳 0=成功釋放、1=最終仍占用。
kill_pids() {
  local pids="$*"
  [ -z "${pids//[[:space:]]/}" ] && return 0

  echo "終止 PID: $pids"
  kill $pids 2>/dev/null || true

  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    [ -z "$(find_pids || true)" ] && return 0
  done

  local remaining
  remaining="$(find_pids || true)"
  if [ -n "${remaining//[[:space:]]/}" ]; then
    echo "舊程序未在預期時間內結束，改用 SIGKILL"
    kill -9 $remaining 2>/dev/null || true
    sleep 0.5
  fi

  remaining="$(find_pids || true)"
  [ -z "${remaining//[[:space:]]/}" ]
}
