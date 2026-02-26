# Agent 4：GitHub 整合 + Articles + Glossary + Dashboard

## 優先級：🟡 中（等 Agent 1 步驟 1~4 完成後開始）

## 前置條件

- Agent 1 已完成專案初始化、路由、型別定義（步驟 1~4）

## 職責

實作 GitHub API 整合層、README 自動生成、網頁擷取，以及 Articles、Glossary、Dashboard 三個頁面。

## 參考規格

請先完整閱讀 `buddhist-translator-spec.md`，你主要負責的章節：
- 4.5 GitHub API 整合（4.5.1 ~ 4.5.4）
- 4.4 網頁內容擷取
- 4.6 config.json 結構
- 3.2 Dashboard
- 3.4 Articles
- 3.5 Glossary
- 2.1 目標結構（repo 遷移）
- 2.5 README.md 自動生成格式
- 3.3.6 翻譯修正日誌記錄

## 任務清單

### 步驟 1：GitHub Service

**`src/services/github.ts`**：

```typescript
import { Article, ArticleSummary, ArticleFrontmatter } from '../types/article';
import { Glossary } from '../types/glossary';
import { AppConfig } from '../types/settings';

class GitHubService {
  private token: string;
  private owner: string;
  private repo: string;
  private branch: string;
  private apiBase = 'https://api.github.com';

  constructor() {
    // 從 settingsStore 讀取 token、owner、repo、branch
  }

  // ─── 基本操作 ───

  /** 讀取單一檔案，回傳 content (decoded) 和 sha */
  async getFile(path: string): Promise<{ content: string; sha: string }>;

  /** 列出目錄下的檔案和子目錄 */
  async listDirectory(path: string): Promise<Array<{
    name: string;
    path: string;
    type: 'file' | 'dir';
    sha: string;
  }>>;

  /** 建立或更新檔案（需要 sha 才能更新） */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<{ sha: string }>;

  /** 刪除檔案 */
  async deleteFile(path: string, sha: string, message: string): Promise<void>;

  // ─── 翻譯文章操作 ───

  /** 儲存翻譯文章到 GitHub（自動生成路徑） */
  async saveTranslation(article: Article): Promise<void>;

  /** 載入單篇翻譯文章（解析 frontmatter + body + 原文） */
  async loadTranslation(path: string): Promise<Article>;

  /** 列出所有翻譯文章的摘要（只讀 frontmatter） */
  async listTranslations(): Promise<ArticleSummary[]>;

  // ─── 術語表操作 ───

  async saveGlossary(glossary: Glossary): Promise<void>;
  async loadGlossary(): Promise<Glossary>;

  // ─── 設定操作 ───

  async saveConfig(config: AppConfig): Promise<void>;
  async loadConfig(): Promise<AppConfig>;

  // ─── 翻譯日誌操作 ───

  async saveTranslationLogs(logs: TranslationLog[]): Promise<void>;
  async loadTranslationLogs(): Promise<TranslationLog[]>;

  // ─── README 操作 ───

  /** 重新生成 README.md 並 commit */
  async updateReadme(): Promise<void>;

  // ─── 遷移操作 ───

  /** 將現有 repo 結構遷移為新結構 */
  async migrateRepoStructure(): Promise<void>;

  // ─── 工具方法 ───

  /** 測試 token 是否有效 */
  async testConnection(): Promise<boolean>;

  /** GitHub API 共用 fetch wrapper（含 auth header、錯誤處理） */
  private async apiFetch(url: string, options?: RequestInit): Promise<any>;
}

export const githubService = new GitHubService();
```

**重要實作細節**：

1. **Content encoding**：GitHub API 回傳的 content 是 base64 encoded，需要 `atob()` 解碼。寫入時需要 `btoa()` 編碼。注意 UTF-8 字元（中文、俄文）需要用 `TextEncoder`/`TextDecoder` 處理：
   ```typescript
   // 解碼
   const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
   const content = new TextDecoder().decode(bytes);
   
   // 編碼
   const bytes = new TextEncoder().encode(content);
   const base64 = btoa(String.fromCharCode(...bytes));
   ```

2. **listTranslations 效能優化**：不要逐個讀取檔案內容。使用遞迴列出 `translations/` 目錄，只對 .md 檔案讀取前 20 行來解析 frontmatter。

3. **updateReadme**：遍歷文章列表 + research 目錄，按規格 2.5 的格式生成 README 內容。

4. **saveTranslation 流程**：
   - 呼叫 markdownUtils.generateFilePath() 生成路徑
   - 呼叫 markdownUtils.assembleMarkdown() 組裝內容
   - 呼叫 createOrUpdateFile()
   - 呼叫 updateReadme()

5. **migrateRepoStructure**：
   - 讀取根目錄所有檔案
   - 按照規格 2.1 的規則分類（hayagriva 相關 → research/hayagriva/、atavaku 相關 → research/atavaku/、圖片 → research/images/）
   - 注意：GitHub API 不支援直接 rename/move，需要「讀取 → 刪除舊的 → 建立新的」
   - 全部操作完成後 commit

### 步驟 2：README 生成工具

**`src/utils/readmeGenerator.ts`**：

```typescript
import { ArticleSummary } from '../types/article';

interface ResearchFile {
  name: string;
  path: string;
  category: string;  // 'hayagriva' | 'atavaku' | 'other'
}

/**
 * 生成完整的 README.md 內容
 */
export function generateReadme(
  articles: ArticleSummary[],
  researchFiles: ResearchFile[]
): string;
```

README 格式嚴格按照規格 2.5。文章按年份 → 月份分組，每月份內按日期倒序。

### 步驟 3：翻譯修正日誌

**`src/services/translationLogger.ts`**：

```typescript
export interface TranslationLog {
  date: string;
  article: string;
  function: string;
  provider: string;
  model: string;
  params: Record<string, any>;
  rounds: number;
  corrections: Array<{
    type: 'terminology' | 'style' | 'missing' | 'structure' | 'other';
    instruction: string;
  }>;
}

/**
 * 記錄一次翻譯的修正行為
 */
export async function logTranslation(log: TranslationLog): Promise<void>;

/**
 * 讀取所有日誌
 */
export async function loadLogs(): Promise<TranslationLog[]>;
```

### 步驟 4：網頁內容擷取

**`src/services/contentParser.ts`**：

```typescript
/**
 * 透過 CORS proxy 擷取網頁內容
 */
export async function fetchWebPage(url: string, proxyUrl?: string): Promise<string>;

/**
 * 用 DOMParser 做初步清理
 */
export function parseHtmlContent(html: string): {
  title?: string;
  text: string;
  metadata: Record<string, string>;
};
```

預設 proxy：`https://api.allorigins.win/get?url={encodedUrl}`
回傳 JSON 中 `.contents` 是 HTML 字串。

### 步驟 5：Dashboard 頁面

**`src/components/dashboard/Dashboard.tsx`**：

從 GitHub 讀取文章列表和術語表，計算統計數據。

**`src/components/dashboard/StatsCards.tsx`**：
- 4 張統計卡片，水平排列：
  - 📄 翻譯文章：{N} 篇
  - 📖 術語詞條：{N} 條
  - 📅 本月新增：{N} 篇
  - 🌐 原文語言：{主要語言}

**`src/components/dashboard/MonthlyChart.tsx`**：
- 使用 Recharts 的 BarChart
- X 軸：最近 6 個月
- Y 軸：文章數量
- 每個 bar 顯示該月的文章數

**`src/components/dashboard/RecentArticles.tsx`**：
- 最近 5 篇翻譯文章的列表
- 每行：標題 | 作者 | 日期
- 點擊 → 導航到 `/translator?edit={path}`

**快捷操作按鈕**：
- 「新增翻譯」→ 導航到 `/translator`
- 「匯入成品」→ 導航到 `/translator?mode=import`
- 「管理術語表」→ 導航到 `/glossary`

### 步驟 6：Articles 頁面

**`src/components/articles/ArticlesPage.tsx`**：

分為兩個區塊：翻譯文章列表 + 研究資料列表。

**`src/components/articles/ArticleList.tsx`**：
- 表格或卡片列表
- 欄位：標題、作者、日期、原文語言
- 預設按日期倒序
- 點擊 → 導航到 `/translator?edit={path}`（進入編輯模式）

**`src/components/articles/ArticleFilters.tsx`**：
- 搜尋框（搜尋 title）
- 作者篩選（dropdown，從文章列表中提取不重複的 author）
- 年月篩選（dropdown）

**研究資料區塊**：
- 列出 `research/` 下所有檔案（分子目錄顯示）
- 點擊 → 在新分頁開啟 GitHub 上的檔案頁面
  - URL: `https://github.com/{owner}/{repo}/blob/{branch}/{path}`

**`src/stores/articlesStore.ts`**：

```typescript
interface ArticlesState {
  articles: ArticleSummary[];
  researchFiles: ResearchFile[];
  isLoading: boolean;
  lastFetched: number | null;

  fetchArticles(): Promise<void>;
  fetchResearchFiles(): Promise<void>;
  getArticlesByMonth(): Record<string, ArticleSummary[]>;
  getAuthors(): string[];
}
```

快取策略：文章列表快取 5 分鐘，過期才重新拉取。

### 步驟 7：Glossary 頁面

**`src/components/glossary/GlossaryPage.tsx`**：

**`src/components/glossary/TermList.tsx`**：
- 表格顯示所有術語
- 欄位：原文 | 中文翻譯 | 梵文 | 分類 | 來源文章 | 日期
- 可排序（點擊欄位標題）
- 搜尋框（搜尋原文、中文、梵文）
- 分類篩選（dropdown 或 tag buttons）

**`src/components/glossary/TermEditor.tsx`**：
- Modal 對話框，用於新增/編輯單一術語
- 欄位：原文、中文、梵文、分類（dropdown）、備註
- 儲存後更新 glossaryStore → commit 到 GitHub

**`src/components/glossary/GlossaryStats.tsx`**：
- 各分類的術語數量（小型 bar chart 或 tag 統計）
- 總詞條數

**匯出 CSV 按鈕**：
- 將術語表轉為 CSV 格式，觸發下載
- 欄位：original, translation, sanskrit, category, notes

**`src/stores/glossaryStore.ts`**：

```typescript
interface GlossaryState {
  glossary: Glossary | null;
  isLoading: boolean;

  fetchGlossary(): Promise<void>;
  addTerm(term: GlossaryTerm): Promise<void>;
  updateTerm(id: string, updates: Partial<GlossaryTerm>): Promise<void>;
  deleteTerm(id: string): Promise<void>;
  addTermsBatch(terms: GlossaryTerm[]): Promise<void>;  // 術語提取批次加入
  searchTerms(query: string): GlossaryTerm[];
  getTermsByCategory(category: string): GlossaryTerm[];
  exportCsv(): string;
}
```

## 你負責的檔案

```
src/
├── components/
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── StatsCards.tsx
│   │   ├── RecentArticles.tsx
│   │   └── MonthlyChart.tsx
│   ├── articles/
│   │   ├── ArticlesPage.tsx
│   │   ├── ArticleList.tsx
│   │   └── ArticleFilters.tsx
│   └── glossary/
│       ├── GlossaryPage.tsx
│       ├── TermList.tsx
│       ├── TermEditor.tsx
│       └── GlossaryStats.tsx
├── services/
│   ├── github.ts
│   ├── contentParser.ts
│   └── translationLogger.ts
├── stores/
│   ├── articlesStore.ts
│   └── glossaryStore.ts
└── utils/
    └── readmeGenerator.ts
```

## 不要碰的檔案

- `src/services/ai/*`（Agent 2）
- `src/components/translator/*`（Agent 3）
- `src/components/layout/*`、`src/components/settings/*`（Agent 1）
- `src/stores/settingsStore.ts`、`src/stores/aiFunctionsStore.ts`（Agent 1，可 import）
- `src/stores/translatorStore.ts`（Agent 3，可 import）

## 完成標記

1. GitHub Service 能正常讀寫檔案、列出目錄
2. README 自動生成格式正確
3. Dashboard 頁面顯示統計卡片、月度圖表、最近文章
4. Articles 頁面能列出文章、篩選、點擊進入編輯
5. Glossary 頁面能列出術語、搜尋、新增/編輯/刪除
6. 術語表匯出 CSV 功能正常
7. 網頁擷取能透過 CORS proxy 取得內容
8. 翻譯日誌記錄和讀取功能正常
