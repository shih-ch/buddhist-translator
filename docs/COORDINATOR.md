# 多 Agent 開發協調指南

## 總覽

```
Agent 1 (骨架)     ──→  Agent 2 (AI Service)  ──→
                   ──→  Agent 3 (Translator)   ──→  Agent 5 (整合)
                   ──→  Agent 4 (GitHub+頁面)  ──→
```

## Agent 職責分工

| Agent | 負責範圍 | 預估工作量 |
|-------|---------|-----------|
| 1 骨架 | 專案初始化、路由、Layout、Settings、型別定義 | 中 |
| 2 AI Service | 4 個 provider adapter、Router、Streaming、Prompt Builder | 中 |
| 3 Translator | 翻譯工作區三欄頁面、參數面板、對話區、預覽 | 大 |
| 4 GitHub+頁面 | GitHub API、Dashboard、Articles、Glossary | 大 |
| 5 整合 | 接線、除錯、打磨、端到端測試 | 中 |

## 執行順序

### Phase A：Agent 1 獨跑（必須先完成步驟 1~4）

Agent 1 完成以下後，通知其他 agent 可以開始：
- 專案初始化完成（npm run dev 能跑）
- 路由 + Layout + 頁面空殼建好
- `src/types/` 下所有型別定義檔案建好
- Zustand stores 的 interface 確立

### Phase B：Agent 2, 3, 4 平行開發

三個 agent 同時在各自的檔案範圍內開發。

**檔案邊界嚴格遵守**——每個 agent 只碰自己負責的檔案（見各 agent 的「你負責的檔案」清單）。

**跨 agent 依賴處理**：
- Agent 3 需要 AI 呼叫 → 先用 mock，等 Agent 2 完成後替換
- Agent 3 需要 GitHub 儲存 → 先用 mock，等 Agent 4 完成後替換
- Agent 4 需要 markdownUtils → Agent 3 負責，但兩者可以先各自定義介面

### Phase C：Agent 5 整合

等 Agent 1~4 全部完成後：
- 合併所有程式碼
- 修復 import 衝突和型別不匹配
- 替換所有 mock 為真實 service
- 端到端測試
- UI 打磨

## tmux 工作區設定

```bash
# 建立 session
tmux new-session -s bt -n agent1 -d

# Agent 1: 骨架
tmux send-keys -t bt:agent1 'cd /path/to/buddhist-translator && echo "Agent 1: Scaffold"' Enter

# Agent 2: AI Service
tmux new-window -t bt -n agent2
tmux send-keys -t bt:agent2 'cd /path/to/buddhist-translator && echo "Agent 2: AI Service"' Enter

# Agent 3: Translator
tmux new-window -t bt -n agent3
tmux send-keys -t bt:agent3 'cd /path/to/buddhist-translator && echo "Agent 3: Translator"' Enter

# Agent 4: GitHub + Pages
tmux new-window -t bt -n agent4
tmux send-keys -t bt:agent4 'cd /path/to/buddhist-translator && echo "Agent 4: GitHub + Pages"' Enter

# 進入 session
tmux attach -t bt
```

## 共用約定

### 命名規範
- 元件：PascalCase（`TranslatorPage.tsx`）
- 工具/服務：camelCase（`markdownUtils.ts`）
- 型別：PascalCase interfaces（`ArticleFrontmatter`）
- Store：camelCase（`translatorStore.ts`）

### Import 風格
```typescript
// 使用相對路徑
import { Article } from '../../types/article';
import { aiRouter } from '../../services/ai/router';
```

### 元件風格
- 使用 function component + hooks
- 使用 Tailwind CSS class（不寫 .css 檔案）
- 使用 shadcn/ui 元件作為基礎

### 錯誤處理
- Service 層 throw Error
- Component 層 try-catch + 顯示 toast
- 不要 silent fail

## 所需文件

每個 agent 開始前都應該閱讀：
1. `buddhist-translator-spec.md`（完整規格）
2. 自己的 `AGENT-N-*.md`（任務指派）
3. 此協調文件（了解邊界和約定）
