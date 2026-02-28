# Buddhist Translator 佛學文獻翻譯助理

一個專為佛教文獻翻譯設計的 Web 應用，支援多語種原文（梵文、藏文、巴利文、俄文、英文）翻譯為繁體中文，整合多家 AI 模型、線上梵文辭典、術語表管理、GitHub 文章同步等功能。

---

## 目錄

- [功能總覽](#功能總覽)
- [安裝教學](#安裝教學)
- [初始設定](#初始設定)
- [功能詳細說明](#功能詳細說明)
  - [翻譯主頁](#1-翻譯主頁-translator)
  - [儀表板](#2-儀表板-dashboard)
  - [文章管理](#3-文章管理-articles)
  - [術語表](#4-術語表-glossary)
  - [設定](#5-設定-settings)
- [翻譯參數說明](#翻譯參數說明)
- [翻譯預設](#翻譯預設)
- [AI 功能配置](#ai-功能配置)
- [快捷鍵](#快捷鍵)
- [技術架構](#技術架構)
- [常見問題](#常見問題)

---

## 功能總覽

| 功能 | 說明 |
|------|------|
| **多 AI 模型翻譯** | 支援 OpenAI (GPT-5/4)、Anthropic (Claude)、Google Gemini、Perplexity |
| **多語種輸入** | 梵文 (IAST/天城體)、藏文、巴利文、俄文、英文，自動偵測語言 |
| **翻譯參數** | 逐行對照、五欄模式、校對模式、中繼翻譯等 11 種預設 |
| **線上梵文辭典** | 整合 C-SALT API (Monier-Williams + Buddhist Hybrid Sanskrit) |
| **AI 辭典查詢** | 佛學術語詞源、定義、中文翻譯查詢 |
| **術語表管理** | 建立、編輯、匯出佛學術語表，支援分類與語言篩選 |
| **翻譯記憶 (TM)** | 自動記錄並建議相似翻譯，減少重複工作 |
| **術語自動標註** | 翻譯預覽中自動標示術語表詞彙，hover 顯示定義 |
| **術語一致性檢查** | 自動檢查翻譯中術語是否一致 |
| **CBETA 大正藏** | 輸入經號（如 T0001）直接從大正藏擷取經文翻譯 |
| **GitHub 整合** | 文章同步、術語表同步、翻譯記錄 |
| **批次翻譯** | 多篇文章排隊自動翻譯 |
| **多格式匯出** | Markdown、HTML、PDF、DOCX |
| **雙欄對照** | 原文與譯文同步捲動對照閱讀 |
| **多版本管理** | 儲存、載入、比較多個翻譯版本 |
| **OCR 輸入** | 圖片文字辨識（支援中俄英藏梵） |
| **費用追蹤** | 即時追蹤 API 呼叫費用，圖表分析 |
| **深色模式** | 支援明暗主題切換 |

---

## 安裝教學

### 系統需求

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0（或 yarn / pnpm）
- **Git**（選擇性，用於版本管理）
- 現代瀏覽器（Chrome、Firefox、Edge、Safari）

### 第一步：取得程式碼

```bash
# 從 GitHub 複製
git clone https://github.com/<your-username>/buddhist-translator.git
cd buddhist-translator
```

或直接下載 ZIP 解壓縮。

### 第二步：安裝依賴

```bash
npm install
```

這會安裝所有必要套件，包含：
- React 19 + React Router 7
- Tailwind CSS 4 + shadcn/ui
- Zustand (狀態管理)
- tesseract.js (OCR)
- docx + html2pdf.js (匯出)
- react-markdown + remark-gfm + rehype-raw (Markdown 渲染)

### 第三步：啟動開發伺服器

```bash
npm run dev
```

啟動後打開瀏覽器訪問：

```
http://localhost:5178/buddhist-translator/
```

### 第四步：建置生產版本

```bash
npm run build
```

輸出至 `dist/` 目錄，可部署到任何靜態網頁託管（GitHub Pages、Netlify 等）。

### 預覽生產版本

```bash
npm run preview
```

### 部署到 GitHub Pages

1. 在 `vite.config.ts` 中 `base` 已設定為 `/buddhist-translator/`
2. 建置後將 `dist/` 目錄內容推送至 `gh-pages` 分支：

```bash
npm run build
# 使用 gh-pages 或手動部署
npx gh-pages -d dist
```

---

## 初始設定

首次使用需要在「設定」頁面配置 API Key：

### API Key 設定

進入 **設定** 頁面，填入你需要的 AI 服務 API Key：

| 服務 | 用途 | 取得方式 |
|------|------|----------|
| **OpenAI** | GPT-5/4 系列翻譯 | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | Claude 系列翻譯 | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Google Gemini** | Gemini 系列翻譯 | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **Perplexity** | Sonar 系列翻譯 | [perplexity.ai](https://www.perplexity.ai/settings/api) |

> 至少需要一個 API Key 才能使用翻譯功能。線上辭典查詢不需要 API Key。

### GitHub 設定（選擇性）

如果要使用文章同步和儲存功能：

1. 建立 [GitHub Personal Access Token](https://github.com/settings/tokens)（需要 `repo` 權限）
2. 在設定頁填入：
   - **GitHub Token**: 你的 Personal Access Token
   - **Repository**: 格式為 `owner/repo`（例如 `myuser/buddhist-articles`）
   - **Branch**: 預設 `main`

---

## 功能詳細說明

### 1. 翻譯主頁 (/translator)

翻譯主頁為三欄式佈局：

```
┌─────────────┬──────────────────┬─────────────────┐
│  原文輸入區  │  翻譯參數 + 對話  │  預覽 + 匯出區  │
│             │                  │                 │
│  貼上/URL/  │  模型選擇        │  Markdown 預覽   │
│  大正藏/    │  參數預設        │  術語標註       │
│  匯入/OCR   │  AI 對話         │  版本管理       │
│             │  辭典面板        │  匯出按鈕       │
└─────────────┴──────────────────┴─────────────────┘
```

#### 輸入方式

- **貼上**：直接貼上原文，自動偵測語言，自動清除常見分隔線 (`+++`, `---`, `===`)
- **URL**：輸入網址自動擷取文章內容，AI 清理格式
- **大正藏 (CBETA)**：輸入經號（如 T0001、X0001）查詢經文資訊、選擇卷數、擷取經文，自動填入標題、作者等 metadata
- **匯入**：從 GitHub 載入已儲存的文章繼續編輯
- **OCR**：上傳圖片，使用 tesseract.js 辨識文字（支援中、英、俄、藏、梵文）

#### 翻譯流程

1. 在左欄輸入或貼上原文
2. 中欄選擇 AI 模型和翻譯預設
3. 填寫文章資訊（標題、作者、來源等）
4. 按「翻譯」按鈕開始
5. AI 以串流方式產出翻譯，可在對話中即時修正
6. 右欄預覽結果，可切換「預覽」和「原始碼」模式
7. 匯出為 .md / .html / .pdf / .docx 或儲存到 GitHub

#### 辭典面板

在翻譯對話區有「辭典」分頁：

- **查詢模式**：
  - 「線上優先」— 先查 C-SALT 線上辭典，無結果再用 AI
  - 「僅線上辭典」— 只查 Monier-Williams 和 BHS
  - 「僅 AI」— 只用 AI 查詢詞源和定義

- **多文字輸入支援**：
  - IAST 羅馬轉寫（如 `dharma`, `bodhicitta`）
  - 天城體（如 `धर्म`）
  - 藏文（如 `ཆོས`）
  - 自動偵測輸入文字系統，即時顯示轉寫預覽

- **AI 補充**：線上辭典查到結果後，可點「AI 補充」取得詞源和中文翻譯

#### 翻譯記憶 (TM)

- 自動記錄每次翻譯的原文與譯文
- 下次翻譯類似內容時自動建議
- 最多儲存 200 筆記錄

#### 術語提取

- 翻譯完成後可一鍵提取佛學專有術語
- 自動加入術語表，標記來源文章

#### 雙欄對照

- 點擊「對照」按鈕進入雙欄模式
- 左側原文、右側譯文，同步捲動
- 以段落對齊方式呈現

#### 術語自動標註

- 翻譯預覽中自動將術語表已有詞彙以黃色底色標註
- Hover 時顯示 Tooltip：原文 → 翻譯、梵文、分類、備註
- 可在預覽面板右上角切換開啟/關閉

#### 術語一致性檢查

- 檢查翻譯中是否所有術語都使用了術語表中的統一譯法
- 標示不一致之處，方便修正

#### 多版本翻譯管理

- 點擊「Bookmark」按鈕快速儲存當前翻譯為命名版本
- 點擊「History」按鈕開啟版本管理面板
- 版本列表顯示：名稱、模型、時間、字數
- 可載入特定版本、與其他版本 diff 比較、刪除版本
- 版本持久化儲存在 localStorage

#### 批次翻譯

- 加入多篇文章到佇列
- 自動依序翻譯
- 顯示每篇進度和狀態

#### 匯出格式

| 格式 | 說明 |
|------|------|
| **.md** | Markdown 原始檔，含 YAML frontmatter |
| **.html** | 完整 HTML 頁面，含樣式 |
| **.pdf** | PDF 文件 (html2pdf.js) |
| **.docx** | Word 文件 (docx) |
| **GitHub** | 直接儲存到 GitHub 倉庫 |
| **剪貼簿** | 複製 Markdown 原始內容 |

---

### 2. 儀表板 (/dashboard)

首頁儀表板顯示使用統計：

- **費用概覽**：總費用、總 Token 數、總呼叫次數
- **月度圖表**：每月 API 花費趨勢（recharts 折線圖）
- **近期文章**：最近翻譯的文章列表
- **費用明細**：按服務商、模型分別統計

---

### 3. 文章管理 (/articles)

管理已儲存在 GitHub 的翻譯文章：

- **文章列表**：顯示所有已存文章的標題、作者、日期、語言
- **篩選**：按語言、作者、日期篩選
- **載入編輯**：選擇文章後載入到翻譯頁繼續編輯
- **同步**：與 GitHub 倉庫同步最新文章

---

### 4. 術語表 (/glossary)

佛學術語集中管理：

- **新增/編輯術語**：
  - 原文 (original)
  - 中文翻譯 (translation)
  - 梵文對照 (sanskrit)
  - 原文語言（梵文/巴利文/藏文/中文/英文/其他）
  - 分類（概念/人物/地名/修行法門/典籍/本尊/咒語）
  - 備註 (notes)
  - 來源文章 (source_article)

- **批次操作**：
  - 勾選多個術語，批次刪除
  - 全選/取消全選

- **篩選與搜尋**：
  - 按分類篩選
  - 按語言篩選
  - 關鍵字搜尋

- **匯入/匯出 CSV**：
  - 匯出所有術語為 CSV 檔案（含所有欄位）
  - 匯入 CSV 檔案批次加入術語，支援 BOM、引號欄位
  - 自動跳過重複術語（按原文比對）
  - 支援彈性欄名（英文或中文欄名皆可）

- **GitHub 同步**：術語表可同步到 GitHub 倉庫

- **統計**：顯示各分類、各語言的術語數量

---

### 5. 設定 (/settings)

#### API Key 管理

- 填入四家 AI 服務的 API Key
- 每個 Key 可單獨測試連線
- Key 儲存在瀏覽器 localStorage 中

#### GitHub 設定

- Token、Repository、Branch 設定
- 測試連線功能

#### AI 功能配置

可自訂五個 AI 功能的服務商、模型、提示詞：

| 功能 | 預設模型 | 說明 |
|------|----------|------|
| **翻譯** | GPT-5.1 | 主要翻譯功能 |
| **格式整理** | GPT-4.1-mini | 翻譯後的格式清理 |
| **術語提取** | GPT-4.1-mini | 從翻譯中提取術語 |
| **網頁摘取** | GPT-4.1-mini | 清理 URL 擷取的內容 |
| **辭典查詢** | GPT-4.1-mini | AI 佛學術語查詢 |

每個功能可獨立設定：
- 選擇服務商（OpenAI / Anthropic / Google / Perplexity）
- 選擇模型
- 自訂提示詞（Prompt）
- 重設為預設提示詞
- 檢視提示詞修改歷史

#### 翻譯預設管理

可新增、編輯、刪除翻譯預設，每個預設包含一組翻譯參數。

#### 校正快捷鍵

自訂常用的修正指令，翻譯時一鍵套用（例如：「統一用『菩提心』」）。

#### 提示詞歷史

記錄每次提示詞的修改，可回溯到之前的版本。

#### 提示詞優化器

用 AI 分析並優化現有提示詞，提升翻譯品質。

#### 資料匯出/匯入

- 匯出所有設定為 JSON 檔案
- 從 JSON 檔案匯入設定
- 用於備份或在不同裝置間同步

---

## 翻譯參數說明

| 參數 | 說明 |
|------|------|
| **保留原文逐行對照** | 翻譯時保留原文，逐行對照顯示 |
| **敘述段也逐行** | 非偈頌的散文段落也做逐行對照 |
| **五欄模式** | 以五欄表格呈現：原文/音譯/直譯/意譯/注解 |
| **五欄範圍** | 全文 / 僅偈頌與咒語 |
| **藏文轉寫模式** | A1 (Wylie) / A2 (THL 簡化) |
| **咒語轉寫** | IAST / 保留原文 / 盡可能轉寫 |
| **僅偈頌咒語** | 只翻譯偈頌和咒語部分 |
| **校對模式** | 關閉 / 僅標註疑點 / 允許修正 |
| **中繼語言** | 無 / 英文 / 俄文（先翻為中繼語言再翻為中文） |

---

## 翻譯預設

內建預設：

| 預設 | 適用場景 |
|------|----------|
| 📄 **一般文章** | 一般佛學文章、開示、論述 |
| 📊 **五欄全文** | 需要完整五欄對照的文本 |
| 📿 **儀軌/偈頌** | 修法儀軌、祈願文、讚頌 |
| 🔍 **校對模式** | 校對已有翻譯，標註問題 |

可在設定頁面自行新增更多預設。

---

## AI 功能配置

### 支援的 AI 模型

**OpenAI：**
- GPT-5.2 / GPT-5.1 / GPT-5
- GPT-4o / GPT-4.1 / GPT-4.1-mini / GPT-4.1-nano
- o3 / o4-mini

**Anthropic：**
- Claude Opus 4.6 / 4.5
- Claude Sonnet 4.6 / 4.5
- Claude Haiku 4.5

**Google Gemini：**
- Gemini 3.1 Pro / 3.0 Pro
- Gemini 2.5 Pro / Flash

**Perplexity：**
- Sonar Pro / Sonar
- Sonar Deep Research

每個模型都有即時費用追蹤（依輸入/輸出 token 數計價）。

---

## 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Ctrl + Enter` | 送出翻譯 / 送出對話 |

---

## 技術架構

### 技術棧

| 類別 | 技術 |
|------|------|
| **框架** | React 19 + TypeScript 5.9 |
| **建置** | Vite 7 |
| **狀態管理** | Zustand 5 (12 stores) |
| **路由** | React Router 7 |
| **UI 元件** | shadcn/ui + Radix UI |
| **樣式** | Tailwind CSS 4 |
| **圖表** | Recharts |
| **Markdown** | react-markdown + remark-gfm + rehype-raw |
| **OCR** | tesseract.js 7 |
| **匯出** | docx (Word) + html2pdf.js (PDF) |
| **主題** | next-themes (深色模式) |
| **通知** | Sonner (Toast) |

### 專案結構

```
src/
├── App.tsx                    # 路由設定
├── main.tsx                   # 進入點
├── index.css                  # Tailwind 主題配置
│
├── pages/                     # 5 個頁面
│   ├── DashboardPage.tsx      # 儀表板
│   ├── TranslatorPage.tsx     # 翻譯主頁
│   ├── ArticlesPage.tsx       # 文章管理
│   ├── GlossaryPage.tsx       # 術語表
│   └── SettingsPage.tsx       # 設定
│
├── components/
│   ├── layout/                # 佈局 (Header, Sidebar, Layout)
│   ├── translator/            # 翻譯元件 (22+)
│   │   ├── SourceInput.tsx    # 輸入區（貼上/URL/大正藏/匯入/OCR）
│   │   ├── PasteInput.tsx     # 貼上輸入（含自動清理）
│   │   ├── UrlInput.tsx       # URL 擷取
│   │   ├── CBETAInput.tsx     # CBETA 大正藏經文擷取
│   │   ├── ImportInput.tsx    # GitHub 匯入
│   │   ├── OCRInput.tsx       # 圖片 OCR
│   │   ├── ChatPanel.tsx      # AI 對話面板
│   │   ├── DictionaryPanel.tsx # 辭典面板
│   │   ├── PreviewPanel.tsx   # 預覽與匯出
│   │   ├── MarkdownPreview.tsx # Markdown 渲染（含術語標註）
│   │   ├── MarkdownEditor.tsx # 原始碼編輯
│   │   ├── ParallelView.tsx   # 雙欄對照
│   │   ├── BatchPanel.tsx     # 批次翻譯
│   │   ├── TMSuggestions.tsx  # 翻譯記憶建議
│   │   ├── TermExtractor.tsx  # 術語提取
│   │   ├── ConsistencyReport.tsx # 術語一致性
│   │   ├── VersionCompare.tsx # 版本比較
│   │   ├── VersionManager.tsx # 多版本管理
│   │   ├── TranslationParams.tsx # 翻譯參數面板
│   │   ├── ParamPresets.tsx   # 預設選擇器
│   │   ├── MetadataForm.tsx   # 文章資訊表單
│   │   ├── ModelSelector.tsx  # 模型選擇器
│   │   └── ShortcutPicker.tsx # 快捷修正
│   ├── glossary/              # 術語表元件 (4)
│   ├── articles/              # 文章元件 (3)
│   ├── dashboard/             # 儀表板元件 (5)
│   ├── settings/              # 設定元件 (8+)
│   └── ui/                    # shadcn 基礎元件 (20+)
│
├── stores/                    # Zustand 狀態管理 (12)
│   ├── translatorStore.ts     # 翻譯狀態
│   ├── glossaryStore.ts       # 術語表
│   ├── settingsStore.ts       # 設定
│   ├── aiFunctionsStore.ts    # AI 功能配置
│   ├── batchStore.ts          # 批次處理
│   ├── costTrackingStore.ts   # 費用追蹤
│   ├── translationMemoryStore.ts # 翻譯記憶
│   ├── correctionShortcutsStore.ts # 校正快捷鍵
│   ├── promptHistoryStore.ts  # 提示詞歷史
│   ├── articlesStore.ts       # 文章管理
│   ├── aiModels.ts            # AI 模型定義與計價
│   └── defaultPrompts.ts      # 預設提示詞
│
├── services/
│   ├── ai/                    # AI 服務
│   │   ├── openai.ts          # OpenAI 適配器
│   │   ├── anthropic.ts       # Anthropic 適配器
│   │   ├── gemini.ts          # Google Gemini 適配器
│   │   ├── perplexity.ts      # Perplexity 適配器
│   │   ├── router.ts          # AI 路由（統一介面）
│   │   ├── promptBuilder.ts   # 提示詞組裝
│   │   └── trackedCall.ts     # 費用追蹤包裝
│   ├── cbetaApi.ts            # CBETA 大正藏 API
│   ├── csaltDictionary.ts     # C-SALT 梵文辭典 API
│   ├── dictionaryLookup.ts    # 辭典查詢服務
│   ├── github.ts              # GitHub REST API
│   ├── exportFormats.ts       # PDF / DOCX 匯出
│   ├── languageDetect.ts      # 語言自動偵測
│   ├── terminologyChecker.ts  # 術語一致性檢查
│   ├── markdownUtils.ts       # Markdown 工具
│   ├── contentParser.ts       # 內容解析
│   ├── fuzzyMatcher.ts        # 模糊搜尋
│   ├── glossaryFilter.ts      # 術語篩選
│   ├── promptOptimizer.ts     # 提示詞優化
│   └── translationLogger.ts   # 翻譯記錄
│
├── types/                     # TypeScript 型別
│   ├── settings.ts            # 設定型別
│   ├── article.ts             # 文章型別
│   ├── glossary.ts            # 術語型別
│   ├── chat.ts                # 對話型別
│   └── promptHistory.ts       # 提示詞歷史型別
│
└── utils/                     # 工具函式
    ├── tokenCounter.ts        # Token 估算
    ├── costEstimator.ts       # 費用計算
    └── simpleDiff.ts          # 文字差異比較
```

### 外部 API

| API | 用途 | 需要 Key |
|-----|------|---------|
| **OpenAI** | GPT 翻譯 | 是 |
| **Anthropic** | Claude 翻譯 | 是 |
| **Google Gemini** | Gemini 翻譯 | 是 |
| **Perplexity** | Sonar 翻譯 | 是 |
| **C-SALT** (api.c-salt.uni-koeln.de) | 梵文辭典 (MW + BHS) | 否（免費） |
| **CBETA** (cbdata.dila.edu.tw) | 大正藏經文擷取 | 否（免費） |
| **GitHub REST API** | 文章/術語同步 | 是 (PAT) |

### 資料儲存

所有使用者資料儲存在瀏覽器 `localStorage` 中：

| Key | 內容 |
|-----|------|
| `bt-settings` | API Key、GitHub 設定 |
| `bt-ai-functions` | AI 功能配置 |
| `bt-translation-presets` | 翻譯預設 |
| `bt-glossary` | 術語表 |
| `bt-translation-memory` | 翻譯記憶 |
| `bt-cost-tracking` | 費用記錄 |
| `bt-correction-shortcuts` | 校正快捷鍵 |
| `bt-prompt-history` | 提示詞歷史 |
| `bt-saved-versions` | 翻譯版本存檔 |

---

## 常見問題

### Q: 不想用 AI，可以只用線上辭典嗎？

可以。在辭典面板中切換查詢模式為「僅線上辭典」，即可只查 C-SALT 的 Monier-Williams 和 Buddhist Hybrid Sanskrit 辭典，完全不呼叫 AI API。

### Q: 支援哪些文字系統輸入辭典查詢？

- **IAST** 羅馬轉寫（如 `dharma`, `prajñā`, `bodhicitta`）
- **天城體**（如 `धर्म`, `प्रज्ञा`）
- **藏文**（如 `ཆོས`, `བྱང་ཆུབ་སེམས`）

系統會自動偵測輸入文字並轉換為 SLP1 編碼查詢 C-SALT API。

### Q: 中繼翻譯是什麼？

對於某些語言（如俄文），直接翻譯為中文品質可能不佳。「中繼翻譯」先翻為英文，再從英文翻為中文，可提升翻譯品質。

### Q: 資料會上傳到哪裡？

- 翻譯文本會傳送到你選擇的 AI 服務商（OpenAI/Anthropic/Google/Perplexity）
- 如果設定了 GitHub，文章和術語會同步到你的 GitHub 倉庫
- 辭典查詢會呼叫 C-SALT 公開 API
- 其他所有資料（設定、歷史、費用）僅儲存在本機瀏覽器中

### Q: 如何備份我的設定？

進入 **設定 → 資料匯出/匯入**，點擊「匯出」即可下載包含所有設定的 JSON 檔案。在新裝置上「匯入」即可還原。

### Q: 在 Linux 上輸入框出現一堆 `+++`？

這是 Linux 輸入法 (IME) 的已知問題，非本應用程式的 bug。目前已加入 `autoComplete="off"` 作為緩解措施。如果持續發生，建議檢查系統輸入法設定。

### Q: 五欄模式的五欄是哪五欄？

| 欄位 | 說明 |
|------|------|
| 原文 | 原始語言文本 |
| 音譯 | 原文的中文音譯 |
| 直譯 | 逐字翻譯 |
| 意譯 | 通順的中文翻譯 |
| 注解 | 術語說明、背景補充 |

---

## 授權

Private project.
