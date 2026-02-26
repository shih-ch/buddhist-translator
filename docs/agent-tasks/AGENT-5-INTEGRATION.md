# Agent 5：整合 + 修復 + 打磨

## 優先級：🟢 最後（等 Agent 1~4 全部完成後開始）

## 前置條件

- Agent 1~4 全部完成各自的任務

## 職責

將四個 agent 的產出整合在一起，修復銜接問題，確保端到端流程順暢，進行最終的 UI 打磨和錯誤處理。

## 整合檢查清單

### 1. 編譯與建構

```bash
# 首先確認能正常編譯
npm run build

# 如果有 TypeScript 錯誤，逐一修復
# 常見問題：
# - import 路徑不一致
# - 型別定義跨 agent 不匹配
# - 缺少 export
```

### 2. 路由與導航

- [ ] 所有 5 個頁面都能透過 Sidebar 正確切換
- [ ] Dashboard 的快捷按鈕能正確導航
- [ ] Articles 頁面點擊文章能導航到 Translator 編輯模式
- [ ] URL 參數正確傳遞（`/translator?edit={path}`、`/translator?mode=import`）

### 3. Store 連接

- [ ] settingsStore 的 API keys 能被 AI Router 正確讀取
- [ ] aiFunctionsStore 的設定能被 AI Router 和 Translator 正確讀取
- [ ] translatorStore 與 ChatPanel、PreviewPanel 雙向綁定正確
- [ ] glossaryStore 與 TermExtractor 連接正確
- [ ] articlesStore 與 Dashboard、ArticlesPage 連接正確

### 4. 端到端翻譯流程

測試完整流程（使用真實 API key）：

- [ ] 在 Settings 輸入 OpenAI API key → 測試連線成功
- [ ] 在 Settings 輸入 GitHub PAT → 測試連線成功
- [ ] 進入 Translator → 貼上一段俄文 → 設定參數 → 點擊翻譯
- [ ] AI streaming 回覆逐字顯示
- [ ] 點擊「採用此版本」→ 預覽區顯示完整 md
- [ ] 術語提取 Modal 彈出 → 選擇術語 → 確認
- [ ] 預覽區可切換渲染/原始碼模式
- [ ] 點擊「儲存到 GitHub」→ 成功 commit
- [ ] 確認 mantra repo 上新增了檔案
- [ ] 確認 README.md 自動更新

### 5. 端到端匯入流程

- [ ] Translator Tab 3 → 貼上已翻譯文章 → 點擊「整理格式」
- [ ] AI 回傳格式化結果 → 自動填入預覽區
- [ ] 填好 metadata → 儲存到 GitHub

### 6. 端到端編輯流程

- [ ] Dashboard → 點擊最近文章
- [ ] Translator 載入文章內容（frontmatter、正文、原文）
- [ ] 可以在對話區修正 → 採用新版本 → 更新儲存

### 7. 多模型切換

- [ ] 在翻譯對話區切換不同 provider/model
- [ ] Anthropic 的特殊 header 和 system prompt 格式正確
- [ ] Gemini 的 role mapping（model vs assistant）正確
- [ ] 各 provider 的 streaming 都能正常工作

### 8. Settings 同步

- [ ] AI 功能設定修改後能正確儲存到 config.json
- [ ] 重新載入頁面後設定能從 config.json 恢復
- [ ] 翻譯參數預設組合能正確儲存和讀取

## 常見銜接問題修復

### import 路徑問題

各 agent 可能使用了不同的 import 風格。統一為：
```typescript
// 使用相對路徑
import { AIRouter } from '../services/ai/router';
import { githubService } from '../services/github';

// 或如果有配置 path alias
import { AIRouter } from '@/services/ai/router';
```

### Translator 頁面接上真實 service

Agent 3 使用了 mock，需要替換：

1. **ChatPanel 的 AI 呼叫**：
   - 替換 mock → `aiRouter.callFunction('translation', messages, { stream })`
   - 確認 promptBuilder 被正確呼叫
   - 確認 streaming callback 正確更新 UI

2. **「儲存到 GitHub」按鈕**：
   - 替換 mock → `githubService.saveTranslation(article)`
   - 加入成功/失敗的 toast 通知

3. **「整理格式」按鈕（匯入成品）**：
   - 替換 mock → `aiRouter.callFunction('formatting', messages)`
   - 解析 JSON 回覆 → 填入 metadata 和預覽

4. **術語提取**：
   - 替換 mock → `aiRouter.callFunction('term_extraction', messages)`
   - 解析 JSON 回覆 → 彈出 TermExtractor Modal
   - 確認後 → `glossaryStore.addTermsBatch(terms)`

5. **URL 擷取**：
   - 接上 contentParser.fetchWebPage()
   - 可選：接上 `aiRouter.callFunction('url_cleanup', messages)` 做 AI 清理

### 編輯模式的載入

確認 `/translator?edit={path}` 的流程：
1. TranslatorPage 讀取 URL 參數
2. 呼叫 `githubService.loadTranslation(path)`
3. 解析後填入 translatorStore（metadata、content、originalText）
4. 左側顯示原文、右側顯示預覽

## UI 打磨

### Loading 狀態

- [ ] Dashboard 載入文章列表時顯示 skeleton loading
- [ ] Translator AI 回覆時顯示 typing indicator
- [ ] 儲存到 GitHub 時按鈕顯示 spinner + 禁用
- [ ] Glossary 載入術語表時顯示 loading

### 錯誤處理

- [ ] API key 未設定時，翻譯按鈕顯示提示「請先在設定中填入 API Key」
- [ ] GitHub token 未設定時，儲存按鈕顯示提示
- [ ] AI 呼叫失敗時，在對話區顯示錯誤訊息（紅色區塊）
- [ ] GitHub 操作失敗時，顯示 toast 錯誤通知
- [ ] 網路錯誤時，顯示友善的錯誤訊息

### Toast 通知系統

如果尚未建立，加一個簡單的 toast 系統（或使用 shadcn/ui 的 toast）：
- 儲存成功 ✅
- 儲存失敗 ❌
- 已複製到剪貼簿 📋
- 術語已加入 📖

### 響應式

- [ ] 螢幕寬度 < 1024px 時，Translator 三欄改為 Tab 切換
- [ ] Sidebar 在小螢幕時收合為圖示
- [ ] 表格在小螢幕時可水平滾動

### 視覺一致性

- [ ] 所有頁面使用一致的 padding/margin
- [ ] 統一 heading 大小（頁面標題、區塊標題）
- [ ] 統一按鈕樣式（primary、secondary、ghost）
- [ ] 統一表單欄位樣式
- [ ] 深色/淺色主題（nice to have，可先只做淺色）

## 最終測試

### Build & Deploy

```bash
npm run build    # 確認無錯誤
npm run preview  # 本機預覽 production build
```

確認 `base: '/buddhist-translator/'` 路徑在 build 後正確。

### 功能煙霧測試

1. 開啟 Settings → 輸入所有 API keys → 測試連線
2. 輸入 GitHub PAT → 測試連線
3. 開啟 Dashboard → 確認統計資料顯示
4. 開啟 Translator → 貼上文章 → 翻譯 → 儲存
5. 開啟 Articles → 確認新文章出現
6. 點擊文章 → 編輯 → 修改 → 重新儲存
7. 開啟 Glossary → 確認術語出現
8. 新增/編輯/刪除術語
9. 回到 Dashboard → 確認數字更新
10. 在 GitHub 上確認 README.md 內容正確

### 瀏覽器測試

- [ ] Chrome 最新版
- [ ] Edge 最新版
- [ ] Firefox 最新版（次要）

## 完成標記

1. `npm run build` 零錯誤零警告
2. 所有端到端流程順暢運作
3. 四個 provider（OpenAI / Anthropic / Gemini / Perplexity）都能正常呼叫
4. GitHub 讀寫正常，README 自動更新
5. 無明顯的 UI 問題或視覺不一致
6. 所有錯誤狀態都有友善的處理
7. Loading 狀態完整
