# Agent 3：Translator 翻譯工作區

## 優先級：🟡 中（等 Agent 1 步驟 1~4 完成後開始）

## 前置條件

- Agent 1 已完成專案初始化、路由、型別定義（步驟 1~4）
- Agent 2 已建立 `src/services/ai/types.ts`（至少型別定義完成）

你可以先用 mock 資料開發 UI，之後再接上真實的 AI service 和 GitHub service。

## 職責

實作整個翻譯工作區頁面，這是 webapp 最核心的頁面。包含三欄佈局、三種輸入模式、翻譯參數面板、對話區、Markdown 預覽、術語提取。

## 參考規格

請先完整閱讀 `buddhist-translator-spec.md`，你主要負責的章節：
- 3.3 Translator（翻譯工作區）— 全部子章節 3.3.1 ~ 3.3.7
- 2.3 翻譯文章 Frontmatter 格式
- 2.4 翻譯文章 Body 格式

## 任務清單

### 步驟 1：Translator 頁面三欄佈局

**`src/components/translator/TranslatorPage.tsx`**：

```
┌─────────────────┬─────────────────────┬──────────────────┐
│                 │   翻譯參數面板       │                  │
│   原文輸入區     │   (可摺疊)          │   預覽與匯出區   │
│                 ├─────────────────────┤                  │
│   [Tab1|Tab2|3] │                     │   [預覽|原始碼]  │
│                 │   翻譯對話區         │                  │
│                 │                     │                  │
│   Metadata 欄位 │   [模型選擇] [費用]  │   [儲存|下載|複製]│
│                 │                     │                  │
└─────────────────┴─────────────────────┴──────────────────┘
```

- 三欄使用 CSS Grid 或 Flexbox
- 左側約 25%、中間約 40%、右側約 35%（可調整）
- 每欄可獨立滾動
- 左側和中間之間有可拖曳的分隔線（nice to have，可先固定寬度）

### 步驟 2：左側 — 原文輸入區

**`src/components/translator/SourceInput.tsx`**：
- 三個 Tab 切換元件

**`src/components/translator/PasteInput.tsx`**（Tab 1 — 貼上文章）：
- 大 textarea，placeholder：「貼上原文...」
- 底部顯示自動偵測的語言（用簡單規則：Cyrillic → ru、Latin → en、Tibetan script → bo）
- 字數統計

**`src/components/translator/UrlInput.tsx`**（Tab 2 — 給網址）：
- URL 輸入框 + 「擷取」按鈕
- 擷取中顯示 loading spinner
- 擷取完成後顯示純文字預覽（可編輯的 textarea）
- 先 mock 擷取功能（真實的網頁擷取接 Agent 4 的 contentParser 或 AI url_cleanup 功能）

**`src/components/translator/ImportInput.tsx`**（Tab 3 — 匯入成品）：
- 上方 textarea：「貼上已翻譯的中文內容」
- 下方 textarea：「貼上原文（選填）」
- 「整理格式」按鈕（呼叫 formatting AI 功能）
- 如果偵測到內容開頭是 `---`（frontmatter），自動解析並填入 metadata

**`src/components/translator/MetadataForm.tsx`**：
- 顯示在 Tab 下方
- 欄位：
  - 標題（text input）
  - 作者（text input，預設值從 config.json defaults.default_author 取）
  - 來源 URL（text input）
  - 日期（date picker，預設今天）
  - 原文語言（dropdown：ru / en / bo / other）
- 所有欄位可手動覆蓋

### 步驟 3：中間上方 — 翻譯參數面板

**`src/components/translator/TranslationParams.tsx`**：
- 可摺疊/展開（預設收合，顯示當前預設名稱）
- 頂部：Quick Presets 按鈕列（見 ParamPresets）
- 下方：各參數控制項

參數控制項：
1. 保留原文逐句：Switch toggle
2. 敘述段逐句對照：Switch toggle
3. 多語五欄模式：Switch toggle
4. 五欄範圍：Text input（僅在五欄開啟時顯示，用 conditional render）
5. Tibetan 轉寫模式：Select dropdown（A1 Wylie / A2 藏音）
6. 咒語/梵語轉寫：Select dropdown（IAST / 保留原狀 / 能則提供）
7. 只輸出偈頌/咒語段：Switch toggle
8. 漢音規則：固定文字顯示「僅咒語/偈頌提供；敘述句填 —」（不可編輯）
9. 勘誤模式：Select dropdown（關閉 / 標註不改 / 允許校正）

**`src/components/translator/ParamPresets.tsx`**：
- 水平排列的按鈕，每個按鈕：emoji + 名稱
- 點擊後一鍵套用對應參數組合
- 當前啟用的預設高亮顯示
- 預設組合從 aiFunctionsStore 的 presetsConfig 讀取

### 步驟 4：中間下方 — 翻譯對話區

**`src/components/translator/ModelSelector.tsx`**：
- Provider + Model 的聯動 dropdown
- 左邊選 Provider（OpenAI / Anthropic / Google / Perplexity）
- 右邊選 Model（根據 provider 動態列出）
- 右邊顯示本次對話累計 tokens 和估算費用
- 預設值從 aiFunctionsStore 的 translation 功能設定讀取
- 這裡的選擇僅影響本次對話（override），不改變全局設定

**`src/components/translator/ChatPanel.tsx`**：
- 訊息列表（可滾動）
- 底部輸入框 + 發送按鈕
- 第一次發送：組裝翻譯 prompt（透過 promptBuilder）+ 原文 → 呼叫 AI
- 後續發送：帶著完整對話歷史 + 新的修正指令 → 呼叫 AI
- Streaming 時逐字顯示在最新的 assistant message 中
- 發送中禁用輸入框和按鈕，顯示 loading

**`src/components/translator/ChatMessage.tsx`**：
- 根據 role 顯示不同樣式：
  - user：靠右，藍色背景
  - assistant：靠左，灰色背景
- assistant 訊息底部有：
  - 「採用此版本」按鈕 → 將 content 填入右側預覽區
  - model 標籤（顯示使用的模型）
  - token 數量
- 支援 Markdown 渲染（assistant 回覆可能包含 Markdown）
- 收合/展開切換（長訊息預設收合只顯示前幾行）

**`src/stores/translatorStore.ts`**（Zustand store）：

```typescript
interface TranslatorState {
  // 輸入
  inputMode: 'paste' | 'url' | 'import';
  originalText: string;
  importedText: string;
  metadata: ArticleFrontmatter;
  
  // 參數
  translationParams: TranslationParams;
  activePreset: string | null;
  
  // 對話
  messages: ChatMessage[];
  isLoading: boolean;
  currentModel: { provider: AIProviderId; model: string } | null;
  totalTokens: number;
  totalCost: number;
  
  // 預覽
  previewContent: string;       // 組裝完成的 md 全文
  previewMode: 'rendered' | 'source';
  
  // 編輯模式（從 Articles 頁面進來）
  editingArticle: Article | null;
  
  // Actions
  setInputMode(mode: 'paste' | 'url' | 'import'): void;
  setOriginalText(text: string): void;
  setImportedText(text: string): void;
  updateMetadata(updates: Partial<ArticleFrontmatter>): void;
  setTranslationParams(params: TranslationParams): void;
  applyPreset(presetName: string): void;
  sendMessage(content: string): Promise<void>;
  adoptVersion(messageId: string): void;
  setPreviewContent(content: string): void;
  setPreviewMode(mode: 'rendered' | 'source'): void;
  loadArticleForEdit(article: Article): void;
  reset(): void;
}
```

### 步驟 5：右側 — 預覽與匯出區

**`src/components/translator/PreviewPanel.tsx`**：
- 頂部 Tab 切換：「預覽」|「原始碼」
- 中間內容區：
  - 預覽模式：MarkdownPreview 元件
  - 原始碼模式：MarkdownEditor 元件
- 底部按鈕列

**`src/components/translator/MarkdownPreview.tsx`**：
- 使用 react-markdown + remark-gfm 渲染
- Frontmatter 區域以格式化的 metadata 表格顯示（不是原始 YAML）
- `<details>` 區塊正常渲染為可展開的摺疊
- 適當的 CSS 樣式（標題大小、段落間距、程式碼區塊）

**`src/components/translator/MarkdownEditor.tsx`**：
- 純 textarea 或 CodeMirror（先用 textarea，CodeMirror 可以後加）
- 顯示完整的 md 原始碼（包含 frontmatter）
- 可編輯，修改後即時更新 previewContent
- 行號顯示（nice to have）

**匯出按鈕功能**：

1. **「儲存到 GitHub」**：
   - 呼叫 GitHub service 的 saveTranslation（先 mock，等 Agent 4）
   - 成功後顯示 toast 通知
   - 同時觸發 README 更新

2. **「下載 .md」**：
   - 將 previewContent 建立 Blob → 觸發瀏覽器下載
   - 檔名：`{date}-{slug}.md`（slug 從 title 生成）

3. **「下載 .html」**：
   - 將 Markdown 轉 HTML（用 react-markdown 的輸出）
   - 包上基本 HTML 模板和 CSS
   - 觸發下載

4. **「複製 Markdown」**：
   - `navigator.clipboard.writeText(previewContent)`
   - 按鈕短暫顯示「已複製 ✓」

### 步驟 6：MD 組裝工具

**`src/services/markdownUtils.ts`**：

```typescript
/**
 * 組裝完整的 md 檔案內容（frontmatter + body + 原文摺疊）
 */
export function assembleMarkdown(
  frontmatter: ArticleFrontmatter,
  translatedContent: string,
  originalText?: string
): string;

/**
 * 解析 md 檔案，拆分 frontmatter、正文、原文
 */
export function parseMarkdown(md: string): {
  frontmatter: ArticleFrontmatter;
  content: string;
  originalText?: string;
};

/**
 * 從 title 生成 URL-safe slug
 */
export function generateSlug(title: string): string;

/**
 * 生成檔案路徑：translations/{year}/{month}/{date}-{slug}.md
 */
export function generateFilePath(date: string, title: string): string;
```

### 步驟 7：術語提取對話框

**`src/components/translator/TermExtractor.tsx`**：
- Modal 對話框，在「採用此版本」時觸發
- 顯示 loading 狀態（「正在提取術語...」）
- 提取完成後列出新術語（過濾掉已存在於 glossary 的）
- 每條術語一行：
  - ✅ 勾選框（預設勾選）
  - 原文 | 中文翻譯 | 梵文 | 分類 | 備註
  - 每個欄位可直接編輯
- 底部：「確認加入」/「跳過」按鈕
- 確認後呼叫 glossary store 更新

### 步驟 8：語言偵測

**`src/services/languageDetect.ts`**：

簡易規則（不需要外部函式庫）：
- 包含大量 Cyrillic 字母（А-я）→ `ru`
- 包含 Tibetan Unicode 範圍（0F00-0FFF）→ `bo`
- 包含大量 CJK 字元 → `zh`
- 其他 → `en`

```typescript
export function detectLanguage(text: string): 'ru' | 'en' | 'bo' | 'zh' | 'other';
```

## 你負責的檔案

```
src/
├── components/
│   └── translator/
│       ├── TranslatorPage.tsx
│       ├── SourceInput.tsx
│       ├── PasteInput.tsx
│       ├── UrlInput.tsx
│       ├── ImportInput.tsx
│       ├── MetadataForm.tsx
│       ├── TranslationParams.tsx
│       ├── ParamPresets.tsx
│       ├── ChatPanel.tsx
│       ├── ModelSelector.tsx
│       ├── ChatMessage.tsx
│       ├── PreviewPanel.tsx
│       ├── MarkdownPreview.tsx
│       ├── MarkdownEditor.tsx
│       └── TermExtractor.tsx
├── services/
│   ├── markdownUtils.ts
│   └── languageDetect.ts
└── stores/
    └── translatorStore.ts
```

## 不要碰的檔案

- `src/services/ai/*`（Agent 2）
- `src/services/github.ts`（Agent 4）
- `src/components/layout/*`、`src/components/settings/*`（Agent 1）
- `src/components/dashboard/*`、`src/components/articles/*`、`src/components/glossary/*`（Agent 4）
- `src/stores/settingsStore.ts`、`src/stores/aiFunctionsStore.ts`（Agent 1，可 import）

## Mock 策略

在 Agent 2 和 Agent 4 完成之前，使用以下 mock：

- **AI 呼叫**：建立 `src/services/ai/mock.ts`，模擬 streaming 回覆（延遲逐字輸出假翻譯）
- **GitHub 儲存**：console.log 輸出要儲存的內容，顯示 toast「（mock）已儲存」
- **Glossary 讀取**：回傳空陣列 `[]`

## 完成標記

1. TranslatorPage 三欄佈局正確顯示
2. 三個 Tab 都能正常切換和輸入
3. 翻譯參數面板可摺疊展開，參數可設定，Quick Presets 可一鍵套用
4. 對話區可發送訊息，mock AI 能逐字回覆
5. 「採用此版本」能將翻譯結果填入預覽區
6. 預覽區可切換渲染/原始碼模式
7. 下載 .md / .html、複製功能正常
8. 術語提取 Modal 能彈出和操作
9. 匯入成品能貼上內容並整理格式（mock AI）
