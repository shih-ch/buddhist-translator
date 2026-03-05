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
- [資料儲存與備份](#資料儲存)
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
| **術語表管理** | 建立、編輯、匯出佛學術語表，支援分類與語言篩選、AI 批次補齊翻譯 |
| **翻譯記憶 (TM)** | 自動記錄並建議相似翻譯，減少重複工作 |
| **術語自動標註** | 翻譯預覽中自動標示梵文/藏文/Wylie 術語，hover 顯示定義 |
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

> **跨平台支援**：本工具為 Web 應用程式，可在 **Windows、macOS、Linux** 上使用。只要有 Node.js 和現代瀏覽器即可運行。線上版本 ([GitHub Pages](https://shih-ch.github.io/buddhist-translator/)) 不需安裝任何東西，直接用瀏覽器開啟即可。

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

線上版本：**https://shih-ch.github.io/buddhist-translator/**

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

| 服務 | 用途 | 申請 API Key |
|------|------|----------|
| **OpenAI** | GPT-5/4 系列翻譯 | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic** | Claude 系列翻譯 | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Google Gemini** | Gemini 系列翻譯 | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Perplexity** | Sonar 系列翻譯 | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |

<details>
<summary>📋 各家 API 申請步驟</summary>

#### OpenAI

1. 前往 [platform.openai.com](https://platform.openai.com/) 註冊帳號
2. 進入 [API Keys](https://platform.openai.com/api-keys) 頁面
3. 點擊「Create new secret key」建立金鑰
4. 需要先 [加值](https://platform.openai.com/settings/organization/billing/overview) 才能使用（最低 $5 USD）

#### Anthropic

1. 前往 [console.anthropic.com](https://console.anthropic.com/) 註冊帳號
2. 進入 [API Keys](https://console.anthropic.com/settings/keys) 頁面
3. 點擊「Create Key」建立金鑰
4. 需要先 [加值](https://console.anthropic.com/settings/billing) 才能使用（最低 $5 USD）

#### Google Gemini

1. 前往 [Google AI Studio](https://aistudio.google.com/) 使用 Google 帳號登入
2. 點擊 [Get API Key](https://aistudio.google.com/apikey)
3. 選擇或建立 Google Cloud 專案，即可取得金鑰
4. **免費方案**：Gemini Flash 系列有免費額度（15 RPM），適合測試

#### Perplexity

1. 前往 [perplexity.ai](https://www.perplexity.ai/) 註冊帳號
2. 進入 [API Settings](https://www.perplexity.ai/settings/api) 頁面
3. 產生 API Key
4. 需要先加值才能使用

</details>

> 至少需要一個 API Key 才能使用翻譯功能。線上辭典查詢不需要 API Key。
>
> 💡 **推薦新手**：Google Gemini 有免費額度，適合先試用。翻譯品質建議使用 GPT-5.1 或 Claude Sonnet 4.6。

### GitHub 設定（選擇性）

如果要使用文章同步和術語表儲存功能，需要設定 GitHub Token。

<details>
<summary>📋 GitHub Token 申請教學</summary>

#### 方法一：Fine-grained Token（推薦）

1. 前往 [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
2. 點擊「Generate new token」
3. 設定名稱（如 `buddhist-translator`）和到期日
4. **Repository access** → 選「Only select repositories」→ 選擇你要存放翻譯的倉庫
5. **Permissions** → Repository permissions → **Contents**: Read and write
6. 點擊「Generate token」並複製

#### 方法二：Classic Token

1. 前往 [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. 設定名稱和到期日
3. 勾選 **repo** 權限（完整倉庫存取）
4. 點擊「Generate token」並複製

> 詳細教學請參考 [GitHub 官方文件：建立個人存取權杖](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

</details>

在設定頁填入：

- **GitHub Token**: 你的 Personal Access Token
- **Repository**: 格式為 `owner/repo`（例如 `myuser/buddhist-articles`）
- **Branch**: 預設 `main`

> 如果倉庫不存在，系統會自動建立。

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

- 翻譯預覽中自動將梵文 (IAST/Sanskrit)、藏文、Wylie 術語以黃色底色標註
- 僅標註 sanskrit、tibetan、wylie 三個欄位的反查（不標註英文原文和中文翻譯）
- 排除「人名」和「地名」分類，避免誤標
- Hover 時顯示 Tooltip：原文 → 翻譯、梵文、藏文、Wylie、分類、定義、備註
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

佛學術語集中管理，術語表存為 GitHub 倉庫根目錄的 `glossary.json`。

- **術語欄位**：
  - 原文 (original)、中文翻譯 (translation)
  - 梵文/IAST (sanskrit)、藏文 (tibetan)、威利轉寫 (wylie)
  - 原文語言（梵文/巴利文/藏文/中文/英文/其他）
  - 分類（概念/人物/地名/修行法門/典籍/本尊/咒語）
  - 定義 (definition)、連結 (link)、備註 (notes)、來源文章 (source_article)

- **匯入方式**：
  - **CSV 匯入**：匯入 CSV 檔案批次加入術語，自動跳過重複，支援彈性欄名
  - **84000 匯入**：從 [84000](https://84000.co/) 的 bo/wy JSON 檔案匯入藏文術語（約 32K 筆），第二次匯入自動合併 tibetan/wylie 欄位
  - **術語提取**：翻譯完成後可 AI 一鍵從文章中提取佛學術語

- **AI 批次補齊翻譯**：
  - 工具列「AI 補齊 (N)」按鈕，N 為缺少中文翻譯的術語數量
  - 分批 50 筆送 AI 翻譯，有進度條、可中途取消
  - AI 翻譯的術語備註自動加上 `[AI翻譯]` 標記
  - 可在設定頁調整使用的 AI 模型（預設 Gemini Flash）
  - 「AI 翻譯」篩選按鈕可快速查看所有 AI 產生的翻譯（藍色字體）

- **單筆 AI 補齊**：編輯術語時，翻譯欄旁的 ✨ 按鈕可單筆 AI 翻譯

- **批次操作**：勾選多個術語批次刪除

- **篩選與搜尋**：按分類、語言、AI 翻譯標籤篩選；關鍵字搜尋（含備註欄位）

- **匯出 CSV**：匯出所有術語為 CSV 檔案（含所有欄位）

- **GitHub 同步**：術語表自動同步到 GitHub 倉庫的 `glossary.json`（支援 >1MB 大檔案）

- **術語標註**：翻譯預覽中自動標示梵文 (IAST)、藏文、Wylie 術語，hover 顯示完整資訊

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

可自訂六個 AI 功能的服務商、模型、提示詞：

| 功能 | 預設模型 | 說明 |
|------|----------|------|
| **翻譯** | GPT-5.1 | 主要翻譯功能 |
| **格式整理** | GPT-4.1-mini | 翻譯後的格式清理 |
| **術語提取** | GPT-4.1-mini | 從翻譯中提取術語 |
| **網頁摘取** | GPT-4.1-mini | 清理 URL 擷取的內容 |
| **辭典查詢** | GPT-4.1-mini | AI 佛學術語查詢 |
| **術語翻譯補齊** | Gemini 2.0 Flash | 批次/單筆 AI 補齊術語表中文翻譯 |

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

### 支援的 AI 模型與價格

所有價格為 **美元 / 每百萬 tokens**，即時費用追蹤內建於應用中。

#### OpenAI（[申請 API Key](https://platform.openai.com/api-keys)）

| 模型 | 輸入 | 輸出 | 適用功能 |
|------|-----:|-----:|----------|
| GPT-5.2 | $1.75 | $14 | 翻譯：最新旗艦，長篇經論翻譯品質最佳 |
| GPT-5.2 Pro | $21 | $168 | 翻譯：複雜論典、五欄模式，需深度推理時使用 |
| GPT-5.1 | $1.25 | $10 | ⭐ 翻譯推薦：品質/價格最佳平衡，日常翻譯首選 |
| GPT-5 | $1.25 | $10 | 翻譯：上代旗艦，品質穩定 |
| GPT-4.1 | $2 | $8 | 翻譯：穩定可靠，適合一般文章 |
| GPT-4o | $2.50 | $10 | 翻譯：支援圖片輸入，可搭配 OCR 使用 |
| o3 | $2 | $8 | 翻譯：推理模型，適合複雜義理分析、校對模式 |
| o4-mini | $1.10 | $4.40 | 術語提取、辭典查詢：輕量推理，適合需要邏輯的輔助任務 |
| o3-mini | $1.10 | $4.40 | 術語提取、辭典查詢：輕量推理，適合需要邏輯的輔助任務 |
| GPT-5 Mini | $0.25 | $2 | 格式整理、術語提取、網頁摘取：高性價比輔助模型 |
| GPT-4.1 Mini | $0.40 | $1.60 | ⭐ 格式整理預設：適合排版、術語提取、網頁清理等輔助任務 |
| GPT-4o Mini | $0.15 | $0.60 | 格式整理、網頁摘取：最低成本，簡單任務適用 |
| GPT-5 Nano | $0.05 | $0.40 | 術語翻譯補齊：超低成本，適合大量批次處理 |
| GPT-4.1 Nano | $0.10 | $0.40 | 術語翻譯補齊：超低成本，適合大量批次處理 |

#### Anthropic（[申請 API Key](https://console.anthropic.com/settings/keys)）

| 模型 | 輸入 | 輸出 | 適用功能 |
|------|-----:|-----:|----------|
| Claude Opus 4.6 | $5 | $25 | 翻譯：最強語言理解，複雜論典、偈頌翻譯品質極佳 |
| Claude Sonnet 4.6 | $3 | $15 | ⭐ 翻譯推薦：速度/品質均衡，長篇翻譯穩定流暢 |
| Claude Opus 4.5 | $5 | $25 | 翻譯：上代旗艦，仍可用 |
| Claude Sonnet 4.5 | $3 | $15 | 翻譯：上代均衡款，仍可用 |
| Claude Haiku 4.5 | $1 | $5 | 格式整理、術語提取、辭典查詢：快速且便宜，輔助任務首選 |

#### Google Gemini（[申請 API Key](https://aistudio.google.com/apikey)）

| 模型 | 輸入 | 輸出 | 適用功能 |
|------|-----:|-----:|----------|
| Gemini 3.1 Pro | $2 | $12 | 翻譯：最強推理（Preview），複雜經論適用 |
| Gemini 3 Flash | $0.50 | $3 | 翻譯、格式整理：新世代快速（Preview），一般文章翻譯高性價比 |
| Gemini 3.1 Flash-Lite | $0.25 | $1.50 | 🆕 格式整理、術語提取、網頁摘取：最新超值（Preview） |
| Gemini 2.5 Pro | $1.25 | $10 | 翻譯：穩定旗艦，長篇翻譯可靠 |
| Gemini 2.5 Flash | $0.30 | $2.50 | ⭐ 翻譯/輔助兼用：性價比首選，免費額度可試用 |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | 術語翻譯補齊：超低成本，適合大量批次處理 |
| Gemini 2.0 Flash | $0.10 | $0.40 | ⭐ 術語翻譯補齊預設：低成本批次處理，32K 筆術語補齊實測穩定 |

> 💡 Gemini Flash 系列有**免費額度**（15 RPM），新手可免費試用翻譯功能。

#### Perplexity（[申請 API Key](https://www.perplexity.ai/settings/api)）

| 模型 | 輸入 | 輸出 | 適用功能 |
|------|-----:|-----:|----------|
| Sonar Deep Research | $2 | $8 | 辭典查詢：深度研究模式，查找佛學術語背景、經典出處 |
| Sonar Reasoning Pro | $2 | $8 | 辭典查詢、翻譯：推理+搜尋，適合需要引用文獻的翻譯 |
| Sonar Pro | $3 | $15 | 翻譯：整合網路搜尋，適合需要查證的翻譯任務 |
| Sonar | $1 | $1 | 辭典查詢：輕量搜尋，快速查找術語定義 |

> Perplexity 模型整合即時網路搜尋，特別適合查找佛學背景資料、經典出處。另有每請求搜尋費用。

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

使用者資料儲存在瀏覽器 `localStorage`，部分資料同步至 GitHub。

#### localStorage（本機）

| Key | 內容 | 同步至 GitHub |
|-----|------|:---:|
| `bt-apikeys` | AI API 金鑰（OpenAI、Anthropic、Google、Perplexity） | |
| `bt-github-token` | GitHub Personal Access Token | |
| `bt-github-repo` | GitHub 倉庫名稱 | |
| `bt-github-branch` | GitHub 分支名稱 | |
| `bt-preferences` | 使用者偏好（最後使用的 preset） | |
| `bt-ai-functions` | AI 功能配置（provider/model/prompt） | ✓ `config.json` |
| `bt-translation-presets` | 翻譯預設組合 | ✓ `config.json` |
| `bt-glossary-cache` | 術語表快取 | ✓ `glossary.json` |
| `bt-cost-tracking` | AI 用量/費用追蹤紀錄 | |
| `bt-prompt-history` | Prompt 修改歷史 | |
| `bt-correction-shortcuts` | 校對快捷鍵設定 | |
| `bt-translation-memory` | 翻譯記憶（歷史翻譯對照） | |
| `bt-saved-versions` | 翻譯版本紀錄 | |

> **注意**：API 金鑰和 GitHub Token 以明文存放於 localStorage。

#### GitHub 倉庫檔案結構

```
<repo>/
├── README.md                    # 自動產生的文章索引
├── glossary.json                # 術語表（>1MB 使用 Git Blob API 讀取）
├── config.json                  # AI 功能設定 + 翻譯預設
├── translation_logs.json        # 翻譯紀錄
├── translations/                # 翻譯文章（Markdown + YAML frontmatter）
│   ├── 2026-02-28-article.md
│   └── ...
└── research/                    # 研究資料
    └── ...
```

#### 備份與還原

所有 `bt-` 開頭的 localStorage 資料可透過設定頁一鍵備份：

1. **設定** → **設定匯出/匯入** → **匯出設定**
2. 下載 `bt-settings-YYYY-MM-DD.json`（包含所有本機資料）
3. 在新裝置/瀏覽器 → **匯入設定** → 選擇 JSON 檔案 → 自動還原

| 資料類型 | 清除瀏覽器後如何復原 |
|---------|-------------------|
| API 金鑰、GitHub Token | 需從匯出的 JSON 匯入，或重新手動填寫 |
| AI 功能設定、翻譯預設 | 自動從 GitHub `config.json` 同步 |
| 術語表 | 自動從 GitHub `glossary.json` 同步 |
| 翻譯文章 | 自動從 GitHub 倉庫載入 |
| 費用追蹤、翻譯記憶、版本紀錄 | **只存本地**，需從匯出的 JSON 匯入 |
| Prompt 歷史、校對快捷鍵 | **只存本地**，需從匯出的 JSON 匯入 |

> 建議定期匯出設定備份，特別是費用追蹤和翻譯記憶等僅存本地的資料。

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

進入 **設定 → 設定匯出/匯入**，點擊「匯出設定」即可下載 `bt-settings-YYYY-MM-DD.json`，包含所有 localStorage 資料（API 金鑰、設定、費用追蹤、翻譯記憶等）。在新裝置上「匯入設定」即可還原。

> 術語表和翻譯文章有 GitHub 同步，清除瀏覽器資料後會自動從 GitHub 拉回。但費用追蹤、翻譯記憶、版本紀錄等只存本地，一定要靠匯出備份。

### Q: 術語表存在哪裡？

術語表存為 GitHub 倉庫根目錄的 `glossary.json`，同時快取在瀏覽器 localStorage (`bt-glossary-cache`)。檔案超過 1MB 時自動使用 Git Blob API 讀取。本地快取滿了會自動去除 definition 欄位以節省空間。

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
