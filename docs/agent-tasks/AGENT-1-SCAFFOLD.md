# Agent 1：骨架 + 路由 + Settings

## 優先級：🔴 最高（其他 agent 依賴你）

## 職責

建立整個專案的基礎骨架，包含初始化、路由、Layout 元件、Settings 頁面、localStorage 存取層。你是第一個動工的 agent，其他 agent 等你的步驟 1~3 完成才能開始。

## 參考規格

請先完整閱讀 `buddhist-translator-spec.md`，你主要負責的章節：
- 4.1 技術選型
- 4.2 專案結構（你負責 layout/、settings/、stores/settingsStore、stores/aiFunctionsStore）
- 4.7 本地儲存策略
- 3.6 Settings（設定）
- 5. GitHub Pages 部署

## 任務清單（按順序）

### 步驟 1：專案初始化（⚠️ 阻塞其他 agent）

```bash
npm create vite@latest buddhist-translator -- --template react-ts
cd buddhist-translator
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom zustand lucide-react
npm install recharts react-markdown remark-gfm
```

- 設定 Tailwind（tailwind.config.js、index.css）
- 安裝 shadcn/ui 並初始化
- 安裝所有共用依賴（見下方依賴清單）
- 確認 `npm run dev` 能正常跑

### 步驟 2：Vite 設定

`vite.config.ts`：
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/buddhist-translator/',
  plugins: [react(), tailwindcss()],
})
```

### 步驟 3：路由 + Layout + 頁面空殼（⚠️ 阻塞其他 agent）

建立以下檔案結構，每個頁面先放一個空殼 placeholder：

```
src/
├── main.tsx
├── App.tsx                       # HashRouter + 路由定義
├── components/
│   └── layout/
│       ├── Layout.tsx            # 主佈局：左側 Sidebar + 右側主內容區
│       ├── Sidebar.tsx           # 側邊導覽（5 個頁面連結 + 圖示）
│       └── Header.tsx            # 頂部列（頁面標題、可選）
├── pages/
│   ├── DashboardPage.tsx         # placeholder
│   ├── TranslatorPage.tsx        # placeholder
│   ├── ArticlesPage.tsx          # placeholder
│   ├── GlossaryPage.tsx          # placeholder
│   └── SettingsPage.tsx          # placeholder
```

**路由定義**：
- `/` → DashboardPage
- `/translator` → TranslatorPage
- `/articles` → ArticlesPage
- `/glossary` → GlossaryPage
- `/settings` → SettingsPage

**Sidebar 導覽項目**（使用 lucide-react 圖示）：
- 📊 Dashboard（Home 圖示）
- 🔄 翻譯（Languages 圖示）
- 📄 文章（FileText 圖示）
- 📖 術語表（BookOpen 圖示）
- ⚙️ 設定（Settings 圖示）

**Layout 要求**：
- 左側 Sidebar 固定寬度（約 240px），可收合
- 右側主內容區佔滿剩餘空間
- 響應式：螢幕小時 Sidebar 收合為圖示
- 使用 Tailwind + shadcn/ui 風格

### 步驟 4：型別定義（共用）

建立 `src/types/` 下的基礎型別檔案，供所有 agent 使用：

**`src/types/settings.ts`**：
```typescript
export type AIProviderId = 'openai' | 'anthropic' | 'google' | 'perplexity';
export type AIFunctionId = 'translation' | 'formatting' | 'term_extraction' | 'url_cleanup';

export interface AIFunctionConfig {
  id: AIFunctionId;
  name: string;
  description: string;
  provider: AIProviderId;
  model: string;
  prompt: string;
  defaultPrompt: string;  // 寫死在程式碼中，恢復預設用
}

export interface TranslationPreset {
  name: string;
  icon: string;
  params: TranslationParams;
}

export interface TranslationParams {
  keepOriginalPerLine: boolean;
  narrativePerLine: boolean;
  fiveColumnMode: boolean;
  fiveColumnScope: string;
  tibetanTranslitMode: 'A1' | 'A2';
  mantraTranslit: 'IAST' | 'keep_original' | 'if_possible';
  onlyVerseMantra: boolean;
  proofreadMode: 'off' | 'annotate_only' | 'allow_correction';
}

export interface AppConfig {
  version: number;
  ai_functions: Record<AIFunctionId, {
    provider: AIProviderId;
    model: string;
    prompt: string;
  }>;
  translation_presets: TranslationPreset[];
  defaults: {
    target_language: string;
    source_language: string;
    default_author: string;
  };
}
```

**`src/types/article.ts`**：
```typescript
export interface ArticleFrontmatter {
  title: string;
  author: string;
  source: string;
  date: string;
  original_language: string;
  translator_model: string;
  translation_mode?: string;
  tags: string[];
}

export interface Article {
  path: string;
  frontmatter: ArticleFrontmatter;
  content: string;
  originalText?: string;
  sha?: string;  // GitHub file SHA for updates
}

export interface ArticleSummary {
  path: string;
  title: string;
  author: string;
  date: string;
  original_language: string;
}
```

**`src/types/glossary.ts`**：
```typescript
export interface GlossaryTerm {
  id: string;
  original: string;
  translation: string;
  sanskrit: string;
  category: 'concept' | 'person' | 'place' | 'practice' | 'text' | 'deity' | 'mantra';
  notes: string;
  added_at: string;
  source_article: string;
}

export interface Glossary {
  version: number;
  updated_at: string;
  terms: GlossaryTerm[];
}
```

**`src/types/chat.ts`**：
```typescript
export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### 步驟 5：localStorage 存取層

**`src/stores/settingsStore.ts`**（Zustand store）：

管理以下 localStorage keys：
- `bt-apikeys`：`{ openai: string, anthropic: string, google: string, perplexity: string }`
- `bt-github-token`：string
- `bt-github-repo`：string（預設 `shih-ch/mantra`）
- `bt-github-branch`：string（預設 `main`）
- `bt-preferences`：`{ lastPreset: string, ... }`

提供方法：
- `getApiKey(provider: AIProviderId): string`
- `setApiKey(provider: AIProviderId, key: string): void`
- `getGitHubToken(): string`
- `setGitHubToken(token: string): void`
- `getGitHubRepo(): { owner: string, repo: string }`
- `setGitHubRepo(owner: string, repo: string): void`
- `testApiKey(provider: AIProviderId): Promise<boolean>`
- `testGitHubToken(): Promise<boolean>`

**`src/stores/aiFunctionsStore.ts`**（Zustand store）：

管理 4 個 AI 功能的設定。初始值為預設值（寫死在程式碼中），之後會從 GitHub config.json 同步。

提供方法：
- `getFunctionConfig(id: AIFunctionId): AIFunctionConfig`
- `updateFunctionConfig(id: AIFunctionId, updates: Partial<AIFunctionConfig>): void`
- `resetFunctionPrompt(id: AIFunctionId): void`（恢復預設 prompt）
- `getPresetsConfig(): TranslationPreset[]`
- `updatePresets(presets: TranslationPreset[]): void`

### 步驟 6：Settings 頁面

**`src/components/settings/SettingsPage.tsx`**：

分為三個區塊（用 Tabs 或 Accordion）：

**區塊 1：API Keys**
- 4 個 provider 各一行：名稱 | 密碼輸入框（`type="password"`）| 測試按鈕 | 狀態指示
- 測試按鈕點擊後呼叫對應 provider 的簡單 API（如列出模型）
- 成功顯示 ✅、失敗顯示 ❌ + 錯誤訊息

**區塊 2：GitHub**
- PAT 輸入框（password）
- Repository 輸入框（預設 `shih-ch/mantra`）
- Branch 輸入框（預設 `main`）
- 測試按鈕（嘗試讀取 repo 資訊）

**區塊 3：AI 功能管理**
- 4 張卡片，每張卡片：
  - 功能名稱 + 說明
  - Provider dropdown（OpenAI / Anthropic / Google / Perplexity）
  - Model dropdown（動態根據 provider 列出可用模型）
  - Prompt 文字編輯器（可展開的 textarea，至少 10 行高）
  - 「恢復預設」按鈕
  - 「根據使用紀錄優化」按鈕（Phase 4 再實作，先 disabled）

**區塊 4：翻譯參數預設組合**
- 列出所有預設組合（名稱 + emoji + 參數摘要）
- 可新增、編輯、刪除
- 每組預設的編輯介面同翻譯參數面板

### 步驟 7：GitHub Actions

建立 `.github/workflows/deploy.yml`，內容見規格文件 5.1。

## 依賴清單（完整）

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "zustand": "^4",
    "lucide-react": "^0.263.1",
    "recharts": "^2",
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "remark-frontmatter": "^5",
    "gray-matter": "^4"
  }
}
```

## 不要碰的檔案

以下檔案由其他 agent 負責，你不要建立或修改：
- `src/services/ai/*`（Agent 2）
- `src/components/translator/*`（Agent 3）
- `src/services/github.ts`（Agent 4）
- `src/components/dashboard/*`、`src/components/articles/*`、`src/components/glossary/*`（Agent 4）

## 完成標記

當以下條件都滿足時，你的任務完成：
1. `npm run dev` 正常啟動
2. `npm run build` 成功
3. 5 個頁面都能透過 Sidebar 導覽切換
4. Settings 頁面可以輸入、儲存、讀取 API keys 和 GitHub token
5. AI 功能設定卡片可以切換 provider/model、編輯 prompt
6. 所有型別定義檔案建立完成
