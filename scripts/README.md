# 開發伺服器管理腳本

管理 Vite 開發伺服器（預設 port `5178`）的一組 bash 腳本，附帶日誌、狀態查詢與安全重啟。

## 快速上手

| 動作 | npm 指令 | 直接執行 |
| --- | --- | --- |
| 啟動（互動詢問是否殺舊） | `npm run dev:safe` | `bash scripts/dev.sh` |
| 停止 | `npm run stop` | `bash scripts/stop.sh` |
| 重啟（自動殺舊） | `npm run restart` | `bash scripts/restart.sh` |
| 查看狀態 | `npm run status` | `bash scripts/status.sh` |
| 看日誌 | `npm run logs` | `bash scripts/logs.sh` |

> 想換 port：在指令前加 `PORT=5179`，例如 `PORT=5179 npm run dev:safe`。

## 各腳本說明

### `dev.sh` — 安全啟動

啟動 Vite，並在發現 port 已被占用時：

1. 列出占用程序的 PID 與完整指令列
2. 互動詢問 `[y/N]` 是否終止
3. 同意則先送 SIGTERM、等待最多 5 秒，仍未釋放才送 SIGKILL
4. 拒絕則取消啟動，不會搶 port
5. 非互動環境（pipe／CI）會直接退出，避免誤殺

啟動後輸出會 **同時** 顯示在終端與寫入 `.logs/dev.log`。

### `stop.sh` — 停止

```bash
npm run stop          # 互動詢問
npm run stop -- -y    # 直接停止，不詢問
```

找到占用 port 的程序、列出資訊、確認後終止。釋放失敗會 exit 1 並提示手動處理。

### `restart.sh` — 重啟

不詢問、直接殺掉舊程序再啟動。若 port 原本未占用，等同於直接啟動。

### `status.sh` — 狀態

顯示：

- 執行中 / 未執行
- port、本機 URL
- 每個 PID 的指令列、啟動時間、累計 CPU、記憶體、工作目錄
- 監聽位址（IPv4 / IPv6）

Exit code：`0` = 執行中、`1` = 未執行，方便條件判斷：

```bash
npm run status >/dev/null && echo "ok" || npm run dev:safe
```

### `logs.sh` — 日誌

預設追蹤 `.logs/dev.log` 最後 50 行（Ctrl+C 離開）。

```bash
npm run logs                  # 追蹤
npm run logs -- -n 200        # 改 200 行
npm run logs -- -F            # 印完即離開
npm run logs -- -p            # 看上一輪（dev.log.1）
npm run logs -- -c            # 清空
```

## 環境變數

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `PORT` | `5178` | 開發伺服器 port，與 `vite.config.ts` 對齊 |
| `LOG_DIR` | `.logs` | 日誌目錄（已加入 `.gitignore`） |
| `LOG_FILE` | `$LOG_DIR/dev.log` | 日誌檔路徑 |

## 內部結構

```
scripts/
  _lib.sh        # 共用：find_pids / list_pids / kill_pids / rotate_log / run_vite_with_log
  dev.sh         # 啟動（互動）
  stop.sh        # 停止
  restart.sh     # 重啟
  status.sh      # 狀態
  logs.sh        # 日誌
```

偵測 port 占用會依序嘗試 `lsof` → `ss` → `fuser`，三者皆無時會明確報錯。

## 注意事項

- 只有透過 `dev.sh` / `restart.sh` 啟動才會寫入 `.logs/dev.log`；若直接執行 `npm run dev`，`logs.sh` 將找不到檔案。
- 每次啟動會把前一輪日誌輪轉成 `dev.log.1`（單份備份）。
- 互動詢問僅在 stdin 為 TTY 時出現；管線 / CI 環境會走非互動分支。
