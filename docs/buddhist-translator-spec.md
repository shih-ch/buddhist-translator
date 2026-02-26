# Buddhist Translator — 技術規格文件

## 1. 專案概述

### 1.1 目標

建立一個純前端的佛學文章翻譯工作站（Webapp），整合多 AI 模型翻譯、術語表管理、對話式修正，並直接與 GitHub 整合讀寫，實現從原文輸入到成品發布的一站式流程。

### 1.2 使用者

單一使用者（開發者本人），個人使用。

### 1.3 專案架構

| 項目 | 說明 |
|------|------|
| Webapp Repo | `buddhist-translator` — React SPA 原始碼，部署至 GitHub Pages |
| 內容 Repo | `shih-ch/mantra` — 既有 repo，重新組織後存放翻譯文章、術語表、研究資料 |
| 部署方式 | GitHub Actions 自動 build → GitHub Pages |
| 後端 | 無。所有 API 呼叫由瀏覽器端直接發出 |

---

## 2. 內容 Repo 結構（mantra）

### 2.1 目標結構

```
mantra/
├── README.md                              # 自動生成的總索引
├── glossary.json                          # 術語表
├── config.json                            # AI 功能設定、prompt 範本、翻譯偏好
├── translation_logs.json                  # 翻譯修正日誌（用於 prompt 優化）
├── research/                              # 原有咒語研究資料（遷移自根目錄）
│   ├── hayagriva/
│   │   ├── Hayagriva_Sadhana.html
│   │   ├── Hayagriva_Sadhana_kanji.html
│   │   ├── 馬頭明王梵英中.md
│   │   ├── 馬頭明王陀羅尼完整對照表_加上慈心忿目.html
│   │   ├── 馬頭明王陀羅尼完整對照表_最終修訂版.html
│   │   └── 馬頭明王陀羅尼完整對照表_最終修訂版.md
│   ├── atavaku/
│   │   ├── 阿吒婆拘經三大咒語唐音梵音與台語發音深度比對.html
│   │   ├── 阿吒婆拘經三大咒語發音與深度考究專卷.html
│   │   ├── 阿吒婆拘經全文與咒語深度對照報告.html
│   │   └── 阿吒婆拘經咒語發音考究：依《梵語台語發音表》校訂完整版.html
│   ├── 緣起偈.md
│   └── images/
│       ├── 1715520842-3313598426-g.png
│       ├── 2686101_640daigensimyouou.jpg
│       └── 606363779_25783326344637091_8628755755522699725_n.jpg
└── translations/                          # 新翻譯文章
    └── 2026/
        └── 02/
            └── 2026-02-25-obstacles-in-practice.md
```

### 2.2 遷移計畫

首次使用 webapp 時，提供一鍵遷移功能（或提供遷移腳本）：

1. 透過 GitHub API 讀取 mantra repo 根目錄所有檔案
2. 按照 2.1 的結構，將檔案移動到對應子目錄
3. 更新 README.md
4. 以單一 commit 提交遷移結果

### 2.3 翻譯文章 Frontmatter 格式

```yaml
---
title: "關於修行中的障礙"
author: "Олег Ганченко"
source: "https://www.facebook.com/oleg.ganchenko/posts/xxxxx"
date: 2026-02-25
original_language: "ru"
translator_model: "gpt-4o"
translation_mode: "five-column"
tags:
  - 修行
  - 障礙
  - 大圓滿
---
```

### 2.4 翻譯文章 Body 格式

```markdown
# 關於修行中的障礙

翻譯正文內容...

---

<details>
<summary>原文 (Original)</summary>

原始俄文內容...

</details>
```

### 2.5 README.md 自動生成格式

```markdown
# 佛學文章翻譯與研究集

共 N 篇翻譯文章 ｜ M 份研究資料

## 翻譯文章

### 2026

#### 二月
- [關於修行中的障礙](./translations/2026/02/2026-02-25-obstacles-in-practice.md) — Олег Ганченко, 2026-02-25
- [禪修要點](./translations/2026/02/2026-02-20-meditation-essentials.md) — Олег Ганченко, 2026-02-20

#### 一月
- [菩提心的修持](./translations/2026/01/2026-01-15-bodhicitta-practice.md) — Олег Ганченко, 2026-01-15

## 研究資料

### 馬頭明王 (Hayagriva)
- [Hayagriva Sadhana](./research/hayagriva/Hayagriva_Sadhana.html)
- [馬頭明王梵英中](./research/hayagriva/馬頭明王梵英中.md)
- [馬頭明王陀羅尼完整對照表](./research/hayagriva/馬頭明王陀羅尼完整對照表_最終修訂版.md)

### 阿吒婆拘經
- [三大咒語唐音梵音與台語發音深度比對](./research/atavaku/阿吒婆拘經三大咒語唐音梵音與台語發音深度比對.html)
- [全文與咒語深度對照報告](./research/atavaku/阿吒婆拘經全文與咒語深度對照報告.html)

### 其他
- [緣起偈](./research/緣起偈.md)
```

---

## 3. Webapp 功能規格

### 3.1 頁面結構

```
App
├── Dashboard（首頁/面板）
├── Translator（翻譯工作區）
├── Articles（文章管理/瀏覽）
├── Glossary（術語表管理）
└── Settings（設定）
```

### 3.2 Dashboard（首頁面板）

**資料來源**：透過 GitHub API 讀取 mantra repo 的 `translations/` 目錄，解析各 .md 檔案的 frontmatter。

**顯示內容**：
- 翻譯文章總數
- 術語表詞條總數
- 按月份的文章數量統計圖（簡易 bar chart）
- 按作者的文章數量統計
- 最近 5 篇翻譯文章列表（標題、作者、日期），可點擊進入編輯
- 快捷操作按鈕：「新增翻譯」、「匯入成品」、「管理術語表」

### 3.3 Translator（翻譯工作區）

這是核心頁面，分為三個區域：

#### 3.3.1 左側：原文輸入區

**輸入方式切換 Tab**：

**Tab 1 — 貼上文章**：
- 大文字輸入框，直接貼上原文
- 自動偵測語言（俄文/英文/其他）
- 可手動填寫 metadata：作者、來源網址、日期（日期預設今天）

**Tab 2 — 給網址**：
- URL 輸入框
- 點擊「擷取」後，透過 proxy/CORS 方案抓取網頁內容（見 4.4）
- 自動解析：標題 → title、網址 → source、發布日期 → date
- 擷取的純文字顯示在下方預覽區，使用者可編輯修正
- metadata 欄位自動填入，使用者可覆蓋

**Tab 3 — 匯入成品**：
- 用於貼上已在 ChatGPT 或其他地方翻譯完成的文章
- 文字輸入框：貼上已翻譯的中文內容
- 另一個輸入框：貼上原文（選填）
- 手動填寫 metadata（作者、來源、日期）
- 點擊「整理格式」：
  1. 呼叫 AI API（使用「格式整理」功能的指定 provider/model），自動產生標題（若未填）、建議 tags、段落結構整理
  2. 組裝成標準 frontmatter + body + 原文摺疊的完整 md
  3. 同時觸發術語提取流程
- 如果貼上的內容本身已有 frontmatter（`---` 開頭），webapp 自動解析並填入 metadata 欄位
- 整理完成後直接進入右側預覽區，確認後可存到 GitHub

**Metadata 欄位**（三種輸入方式共用）：
- 標題（title）：可手動輸入或由 AI 翻譯後自動建議
- 作者（author）：手動輸入
- 來源（source）：URL
- 日期（date）：date picker，預設今天
- 原文語言（original_language）：自動偵測 + 手動覆蓋

#### 3.3.2 中間上方：翻譯參數面板

在 Tab 1（貼上文章）和 Tab 2（給網址）模式下，翻譯按鈕上方顯示可摺疊的「翻譯參數」面板。這些參數會動態注入到翻譯 system prompt 的「本次參數」區塊中。

**參數控制項**：

| 參數 | UI 元件 | 選項 | 預設值 |
|------|---------|------|--------|
| 保留原文逐句 | Toggle | 是/否 | 是 |
| 敘述段逐句對照 | Toggle | 是/否 | 否 |
| 多語五欄模式 | Toggle | 開啟/關閉 | 關閉 |
| 五欄範圍 | Text（五欄開啟時顯示） | 自由文字，如「全文」「僅偈頌」 | 全文 |
| Tibetan 轉寫模式 | Dropdown | A1（Wylie）/ A2（藏音羅馬音） | A1 |
| 咒語/梵語轉寫 | Dropdown | IAST / 保留原狀 / 能則提供 | IAST |
| 只輸出偈頌/咒語段 | Toggle | 是/否 | 否 |
| 漢音規則 | 固定顯示 | 僅咒語/偈頌提供；敘述句填「—」 | （不可改） |
| 勘誤模式 | Dropdown | 關閉 / 標註不改正文 / 允許直接校正文 | 標註不改 |

**參數組合預設（Quick Presets）**：

面板頂部提供幾個快速預設按鈕，一鍵套用常用的參數組合：

| 預設名稱 | 說明 |
|----------|------|
| 📄 一般文章 | 五欄關閉、保留原文、不逐句對照 |
| 📊 五欄全文 | 五欄開啟、全文範圍、IAST |
| 📿 儀軌/偈頌 | 五欄開啟、只輸出偈頌咒語段、漢音啟用 |
| 🔍 校對模式 | 保留原文逐句、勘誤模式：標註不改 |

使用者也可在 Settings 中自訂預設組合。

#### 3.3.3 中間下方：翻譯對話區

- 頂部：模型選擇器（dropdown）— 這裡的模型選擇會覆蓋「翻譯」功能的預設模型（僅限本次對話）
  - OpenAI GPT-4o（預設）
  - OpenAI GPT-4o-mini
  - Anthropic Claude Sonnet
  - Anthropic Claude Haiku
  - Google Gemini Pro
  - Google Gemini Flash
  - Perplexity sonar / sonar-pro
- 模型選擇器旁：顯示本次對話累計 token 數與估算費用

**翻譯流程**：

1. 使用者在左側填入原文、設定參數後，點擊「翻譯」
2. 系統組裝 prompt（見 3.3.7）並呼叫所選 AI API
3. 翻譯結果顯示在對話區
4. 使用者可在對話輸入框中輸入修正指令，例如：
   - 「這段語氣太生硬，改口語一點」
   - 「般若應該翻成 Prajñā 不要翻成智慧」
   - 「第三段漏譯了」
   - 「重新組織段落結構」
5. 系統帶著完整對話歷史再次呼叫 API
6. 可隨時切換模型，切換後對話歷史保留，但下次呼叫使用新模型
7. 最多支援不限輪數的修正

**對話區特殊操作**：
- 每則 AI 回覆旁有「採用此版本」按鈕 → 將該版本填入右側預覽區
- 可收起/展開歷史對話，只看最新結果

#### 3.3.4 右側：預覽與匯出區

- Markdown 即時預覽（rendered）
- 原始 Markdown 原始碼切換
- 預覽區包含完整內容：frontmatter（以表格形式顯示）+ 正文 + 原文摺疊區塊
- 可直接在原始碼模式下手動編輯
- 底部操作按鈕：
  - 「儲存到 GitHub」：commit 到 mantra repo
  - 「下載 .md」：下載到本機
  - 「下載 .html」：轉換成帶樣式的 HTML 後下載
  - 「複製 Markdown」：複製到剪貼簿

#### 3.3.5 翻譯完成後的術語提取

在使用者點擊「採用此版本」時，自動觸發：

1. 呼叫 AI API（使用「術語提取」功能指定的 provider/model），prompt 由「術語提取」功能的 prompt 範本提供
2. 比對現有 glossary.json，過濾已存在的術語
3. 彈出確認對話框，列出新發現的術語
4. 使用者可逐條勾選：✅ 加入 / ❌ 丟棄 / ✏️ 修改
5. 確認的術語合併寫入 glossary.json（commit 到 GitHub）

#### 3.3.6 翻譯修正日誌記錄

每次使用者在對話中做修正時，webapp 自動記錄修正行為到 `translation_logs.json`：

```json
[
  {
    "date": "2026-02-25",
    "article": "2026-02-25-obstacles-in-practice.md",
    "function": "translation",
    "provider": "openai",
    "model": "gpt-4o",
    "params": { "five_column": false, "proofread": true },
    "rounds": 3,
    "corrections": [
      { "type": "terminology", "instruction": "般若應該翻成 Prajñā 不要翻成智慧" },
      { "type": "style", "instruction": "語氣太生硬，改口語一點" },
      { "type": "missing", "instruction": "第三段漏譯了" }
    ]
  }
]
```

此日誌用於後續的 prompt 動態優化（見 3.6.4）。

#### 3.3.7 System Prompt 組裝邏輯

每次呼叫翻譯 API 時，system prompt 由以下幾部分動態組裝：

**組裝結構**：
```
[翻譯功能的完整 prompt 範本（見附錄 A）]

────────────────────────────────────────
術語表（翻譯時必須遵守）
────────────────────────────────────────
{從 glossary.json 載入相關術語，格式化為列表}
```

**User message 組裝**：
```
【本次參數】
- 保留原文逐句：{從參數面板取值}
- 敘述段逐句對照：{從參數面板取值}
- 多語五欄模式：{從參數面板取值}
- Tibetan 轉寫模式：{從參數面板取值}
- 咒語/梵語轉寫：{從參數面板取值}
- 只輸出偈頌/咒語段：{從參數面板取值}
- 漢音規則：僅咒語/偈頌提供；一般敘述句填「—」
- 勘誤模式：{從參數面板取值}

【原文】
{使用者貼入的原文}
```

**術語表裁剪**：如果 glossary.json 超過 200 條，先呼叫 API 判斷文章主題，只帶入相關分類的術語。

### 3.4 Articles（文章管理）

**文章列表頁**：
- 透過 GitHub API 列出 `translations/` 下所有 .md 檔案
- 顯示：標題、作者、日期、原文語言
- 排序：預設按日期倒序
- 篩選：按作者、按年月、關鍵字搜尋（搜尋 title）
- 點擊文章 → 進入翻譯工作區的「編輯模式」

**編輯模式**：
- 從 GitHub 拉取 .md 檔案內容
- 解析 frontmatter → 填入 metadata 欄位
- 解析正文 → 填入預覽區
- 解析 `<details>` 中的原文 → 填入左側原文區
- 使用者可繼續開啟對話修正
- 儲存時更新同一個檔案（覆蓋 commit）

**另外也列出 `research/` 目錄下的研究資料**：
- 純瀏覽，點擊開啟 GitHub 上的原始檔案頁面

### 3.5 Glossary（術語表管理）

**資料結構**（glossary.json）：

```json
{
  "version": 1,
  "updated_at": "2026-02-25T10:30:00Z",
  "terms": [
    {
      "id": "uuid-1",
      "original": "бодхичитта",
      "translation": "菩提心",
      "sanskrit": "bodhicitta",
      "category": "concept",
      "notes": "",
      "added_at": "2026-02-25T10:30:00Z",
      "source_article": "2026-02-25-obstacles-in-practice.md"
    }
  ]
}
```

**介面功能**：
- 術語列表，可排序（按原文、中文、分類、日期）
- 搜尋/篩選（按分類、按關鍵字）
- 新增、編輯、刪除術語
- 匯出為 CSV
- 統計：各分類的術語數量
- 修改後自動 commit 到 GitHub

### 3.6 Settings（設定）

#### 3.6.1 API Keys 管理

- OpenAI API Key
- Anthropic API Key
- Google AI (Gemini) API Key
- Perplexity API Key
- 每個 key 旁有「測試連線」按鈕
- 儲存在 localStorage，頁面上以 `••••••••` 遮蔽顯示

#### 3.6.2 GitHub 設定

- GitHub Personal Access Token (fine-grained)
- Repository：預設 `shih-ch/mantra`，可修改
- 預設 branch：`main`
- 測試連線按鈕

#### 3.6.3 AI 功能管理

Webapp 中共有 4 個 AI 功能，每個功能各自獨立設定 **API Provider**、**Model**、**Prompt**。Settings 頁面以卡片列表顯示，每張卡片包含：

- **功能名稱**（不可改）
- **API Provider**：Dropdown（OpenAI / Anthropic / Google / Perplexity）— 選擇後 Model 選項動態更新
- **Model**：Dropdown（根據所選 provider 動態列出可用模型）
- **Prompt 範本**：多行文字編輯器，可自由編輯
- **「恢復預設 Prompt」** 按鈕
- **「根據使用紀錄優化 Prompt」** 按鈕（見 3.6.4）

**四個 AI 功能及預設值**：

| 功能 ID | 名稱 | 預設 Provider | 預設 Model | 預設 Prompt |
|---------|------|---------------|------------|-------------|
| translation | 翻譯 | OpenAI | gpt-4o | 見附錄 A |
| formatting | 格式整理 | OpenAI | gpt-4o-mini | 見附錄 B |
| term_extraction | 術語提取 | OpenAI | gpt-4o-mini | 見附錄 C |
| url_cleanup | 網頁摘取整理 | OpenAI | gpt-4o-mini | 見附錄 D |

#### 3.6.4 Prompt 動態優化

在每個 AI 功能卡片上，提供「**根據使用紀錄優化 Prompt**」按鈕。點擊後：

1. 讀取 `translation_logs.json` 中與該功能相關的修正記錄
2. 將修正記錄 + 當前 prompt 送給 AI 分析
3. 以 diff 方式顯示建議修改（新增部分用綠色、刪除部分用紅色）
4. 使用者確認後套用，更新 config.json 並 commit 到 GitHub

#### 3.6.5 翻譯參數預設組合管理

使用者可在此自訂參數預設組合（Quick Presets），每組包含：
- 預設名稱
- 圖示（emoji）
- 各參數值

預設組合存入 config.json。

---

## 4. 技術架構

### 4.1 技術選型

| 層面 | 選擇 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 生態成熟、型別安全 |
| 建構工具 | Vite | 速度快、設定簡單 |
| UI 框架 | Tailwind CSS + shadcn/ui | 快速開發、元件品質高 |
| Markdown 渲染 | react-markdown + remark-gfm + remark-frontmatter | 支援 GFM 和 frontmatter |
| Markdown 編輯 | CodeMirror 6 (with markdown extension) | 輕量、可嵌入 |
| 狀態管理 | Zustand | 輕量、簡單 |
| 路由 | React Router v6 (HashRouter) | GitHub Pages 相容 |
| HTTP Client | 原生 fetch | 不需額外依賴 |
| 圖表 | Recharts | React 原生、輕量 |
| 本地儲存 | localStorage | API keys、使用者設定快取 |

### 4.2 專案結構

```
buddhist-translator/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions 部署
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx                      # 進入點
│   ├── App.tsx                       # 路由設定
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # 側邊導覽
│   │   │   ├── Header.tsx
│   │   │   └── Layout.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   ├── RecentArticles.tsx
│   │   │   └── MonthlyChart.tsx
│   │   ├── translator/
│   │   │   ├── TranslatorPage.tsx    # 三欄主頁面
│   │   │   ├── SourceInput.tsx       # 左側原文輸入
│   │   │   ├── PasteInput.tsx        # 貼上文章 tab
│   │   │   ├── UrlInput.tsx          # 給網址 tab
│   │   │   ├── ImportInput.tsx       # 匯入成品 tab
│   │   │   ├── MetadataForm.tsx      # Metadata 欄位
│   │   │   ├── TranslationParams.tsx # 翻譯參數面板
│   │   │   ├── ParamPresets.tsx      # 參數快速預設
│   │   │   ├── ChatPanel.tsx         # 對話區
│   │   │   ├── ModelSelector.tsx     # 模型選擇器
│   │   │   ├── ChatMessage.tsx       # 單則對話訊息
│   │   │   ├── PreviewPanel.tsx      # 右側預覽
│   │   │   ├── MarkdownPreview.tsx
│   │   │   ├── MarkdownEditor.tsx
│   │   │   └── TermExtractor.tsx     # 術語提取確認對話框
│   │   ├── articles/
│   │   │   ├── ArticlesPage.tsx
│   │   │   ├── ArticleList.tsx
│   │   │   └── ArticleFilters.tsx
│   │   ├── glossary/
│   │   │   ├── GlossaryPage.tsx
│   │   │   ├── TermList.tsx
│   │   │   ├── TermEditor.tsx
│   │   │   └── GlossaryStats.tsx
│   │   └── settings/
│   │       ├── SettingsPage.tsx
│   │       ├── ApiKeySettings.tsx
│   │       ├── GitHubSettings.tsx
│   │       ├── AIFunctionCard.tsx    # 單一 AI 功能設定卡片
│   │       ├── AIFunctionList.tsx    # AI 功能列表
│   │       ├── PromptOptimizer.tsx   # Prompt 優化 diff 檢視
│   │       └── ParamPresetEditor.tsx # 參數預設組合編輯
│   ├── services/
│   │   ├── ai/
│   │   │   ├── types.ts              # 共用型別
│   │   │   ├── openai.ts             # OpenAI API 呼叫
│   │   │   ├── anthropic.ts          # Anthropic API 呼叫
│   │   │   ├── gemini.ts             # Google Gemini API 呼叫
│   │   │   ├── perplexity.ts         # Perplexity API 呼叫
│   │   │   ├── router.ts             # 根據功能設定路由到正確的 provider
│   │   │   └── promptBuilder.ts      # System prompt 組裝邏輯（含參數注入）
│   │   ├── github.ts                 # GitHub API 封裝
│   │   ├── contentParser.ts          # 網頁內容擷取與解析
│   │   ├── markdownUtils.ts          # Frontmatter 解析、MD 組裝
│   │   ├── translationLogger.ts      # 翻譯修正日誌記錄
│   │   └── languageDetect.ts         # 語言偵測
│   ├── stores/
│   │   ├── settingsStore.ts          # API keys、偏好設定
│   │   ├── aiFunctionsStore.ts       # AI 功能設定（provider/model/prompt per function）
│   │   ├── translatorStore.ts        # 翻譯工作區狀態（含參數）
│   │   ├── articlesStore.ts          # 文章列表快取
│   │   └── glossaryStore.ts          # 術語表狀態
│   ├── types/
│   │   ├── article.ts
│   │   ├── glossary.ts
│   │   ├── chat.ts
│   │   ├── aiFunction.ts             # AI 功能設定型別
│   │   ├── translationParams.ts      # 翻譯參數型別
│   │   └── settings.ts
│   └── utils/
│       ├── tokenCounter.ts           # Token 估算
│       ├── costEstimator.ts          # 費用估算
│       └── readmeGenerator.ts        # README.md 生成
├── index.html
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 4.3 AI 功能路由系統

#### 4.3.1 核心型別

```typescript
// AI 功能 ID
type AIFunctionId = 'translation' | 'formatting' | 'term_extraction' | 'url_cleanup';

// 單一 AI 功能設定
interface AIFunctionConfig {
  id: AIFunctionId;
  name: string;               // 顯示名稱（如「翻譯」）
  description: string;        // 功能說明
  provider: AIProviderId;     // 'openai' | 'anthropic' | 'google' | 'perplexity'
  model: string;              // 模型 ID
  prompt: string;             // 當前 prompt
  defaultPrompt: string;      // 預設 prompt（恢復用，寫死在程式碼中不可編輯）
}

// AI Provider 定義
type AIProviderId = 'openai' | 'anthropic' | 'google' | 'perplexity';

interface AIProvider {
  id: AIProviderId;
  name: string;                // 顯示名稱
  models: AIModel[];
  call(messages: AIMessage[], model: string, apiKey: string, stream?: boolean): Promise<AIResponse>;
}

interface AIModel {
  id: string;
  name: string;
  inputPrice: number;          // USD per 1M tokens
  outputPrice: number;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 翻譯參數
interface TranslationParams {
  keepOriginalPerLine: boolean;
  narrativePerLine: boolean;
  fiveColumnMode: boolean;
  fiveColumnScope: string;
  tibetanTranslitMode: 'A1' | 'A2';
  mantraTranslit: 'IAST' | 'keep_original' | 'if_possible';
  onlyVerseMantra: boolean;
  proofreadMode: 'off' | 'annotate_only' | 'allow_correction';
}
```

#### 4.3.2 AI 路由器

```typescript
// services/ai/router.ts
class AIRouter {
  /**
   * 根據功能 ID 取得對應的 provider、model、apiKey，然後執行呼叫。
   * 翻譯功能可透過 overrideProvider / overrideModel 在對話區臨時覆蓋。
   */
  async callFunction(
    functionId: AIFunctionId,
    messages: AIMessage[],
    options?: {
      streamCallback?: (chunk: string) => void;
      overrideProvider?: AIProviderId;
      overrideModel?: string;
    }
  ): Promise<AIResponse>;

  /** 取得指定 provider 的可用模型列表 */
  getModelsForProvider(providerId: AIProviderId): AIModel[];
}
```

#### 4.3.3 各 API Endpoint

**OpenAI**：
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Models: `gpt-4o`, `gpt-4o-mini`
- Auth: `Authorization: Bearer {key}`

**Anthropic**：
- Endpoint: `https://api.anthropic.com/v1/messages`
- Models: `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`
- Auth: `x-api-key: {key}`
- 注意：需額外 header `anthropic-dangerous-direct-browser-access: true`

**Google Gemini**：
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Models: `gemini-2.0-flash`, `gemini-2.0-pro`（依最新可用模型調整）
- Auth: URL param `key={key}`

**Perplexity**：
- Endpoint: `https://api.perplexity.ai/chat/completions`
- Models: `sonar`, `sonar-pro`
- Auth: `Authorization: Bearer {key}`

#### 4.3.4 串流（Streaming）支援

所有 API 呼叫使用 streaming 模式（SSE），讓翻譯結果逐字顯示：
- OpenAI / Perplexity：`stream: true`，解析 SSE `data:` 行
- Anthropic：`stream: true`，解析 SSE event types
- Gemini：`streamGenerateContent`，解析 JSON chunks

### 4.4 網頁內容擷取（URL 輸入）

因為瀏覽器端有 CORS 限制，直接 fetch 外部網頁會失敗。方案：

**方案：使用公開 CORS Proxy**

使用者在設定頁可選擇：
1. `https://api.allorigins.win/get?url=`（免費、無需 key）
2. 自訂 proxy URL（使用者可架設自己的 CORS proxy）

擷取流程：
1. 透過 CORS proxy 取得 HTML
2. 使用 DOMParser 做初步解析
3. 呼叫「網頁摘取整理」AI 功能（使用其指定的 provider/model/prompt），清理雜訊並提取 metadata
4. 將乾淨文字填入原文輸入區，metadata 自動填入

### 4.5 GitHub API 整合

#### 4.5.1 認證

使用 Fine-grained Personal Access Token，只需 `shih-ch/mantra` repo 的以下權限：
- Contents: Read and Write
- Metadata: Read

#### 4.5.2 核心操作

**讀取檔案**：
```
GET /repos/{owner}/{repo}/contents/{path}
Accept: application/vnd.github.v3+json
```

**列出目錄**：
```
GET /repos/{owner}/{repo}/contents/{path}
```

**建立/更新檔案**：
```
PUT /repos/{owner}/{repo}/contents/{path}
Body: {
  message: "Add translation: {title}",
  content: base64encode(fileContent),
  sha: existingSha  // 更新時需提供
}
```

**刪除檔案**：
```
DELETE /repos/{owner}/{repo}/contents/{path}
Body: { message: "...", sha: "..." }
```

#### 4.5.3 GitHub 操作封裝

```typescript
class GitHubService {
  // 基本操作
  async getFile(path: string): Promise<{ content: string; sha: string }>;
  async listDirectory(path: string): Promise<FileEntry[]>;
  async createOrUpdateFile(path: string, content: string, message: string, sha?: string): Promise<void>;
  async deleteFile(path: string, sha: string, message: string): Promise<void>;

  // 業務操作
  async saveTranslation(article: Article): Promise<void>;
  async loadTranslation(path: string): Promise<Article>;
  async listTranslations(): Promise<ArticleSummary[]>;
  async saveGlossary(glossary: Glossary): Promise<void>;
  async loadGlossary(): Promise<Glossary>;
  async saveConfig(config: AppConfig): Promise<void>;
  async loadConfig(): Promise<AppConfig>;
  async saveTranslationLogs(logs: TranslationLog[]): Promise<void>;
  async loadTranslationLogs(): Promise<TranslationLog[]>;
  async updateReadme(articles: ArticleSummary[]): Promise<void>;

  // 遷移
  async migrateRepoStructure(): Promise<void>;
}
```

#### 4.5.4 README 自動更新

觸發時機：每次 `saveTranslation` 成功後。

流程：
1. 列出 `translations/` 下所有 .md 檔案
2. 讀取每個檔案的 frontmatter（只需前 20 行，不用讀全文）
3. 列出 `research/` 下所有檔案
4. 依模板生成 README.md 內容（見 2.5）
5. Commit 更新 README.md

注意：為避免 API rate limit，文章列表應在 articlesStore 中快取，只有新增/修改文章時才重新拉取。

### 4.6 config.json 結構

存放在 GitHub repo 中，跨裝置同步：

```json
{
  "version": 2,
  "ai_functions": {
    "translation": {
      "provider": "openai",
      "model": "gpt-4o",
      "prompt": "（完整翻譯 prompt，見附錄 A）"
    },
    "formatting": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "prompt": "（格式整理 prompt，見附錄 B）"
    },
    "term_extraction": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "prompt": "（術語提取 prompt，見附錄 C）"
    },
    "url_cleanup": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "prompt": "（網頁摘取 prompt，見附錄 D）"
    }
  },
  "translation_presets": [
    {
      "name": "一般文章",
      "icon": "📄",
      "params": {
        "keepOriginalPerLine": true,
        "narrativePerLine": false,
        "fiveColumnMode": false,
        "fiveColumnScope": "全文",
        "tibetanTranslitMode": "A1",
        "mantraTranslit": "IAST",
        "onlyVerseMantra": false,
        "proofreadMode": "annotate_only"
      }
    },
    {
      "name": "五欄全文",
      "icon": "📊",
      "params": {
        "keepOriginalPerLine": true,
        "narrativePerLine": true,
        "fiveColumnMode": true,
        "fiveColumnScope": "全文",
        "tibetanTranslitMode": "A1",
        "mantraTranslit": "IAST",
        "onlyVerseMantra": false,
        "proofreadMode": "annotate_only"
      }
    },
    {
      "name": "儀軌/偈頌",
      "icon": "📿",
      "params": {
        "keepOriginalPerLine": true,
        "narrativePerLine": false,
        "fiveColumnMode": true,
        "fiveColumnScope": "僅偈頌與咒語",
        "tibetanTranslitMode": "A1",
        "mantraTranslit": "IAST",
        "onlyVerseMantra": true,
        "proofreadMode": "off"
      }
    },
    {
      "name": "校對模式",
      "icon": "🔍",
      "params": {
        "keepOriginalPerLine": true,
        "narrativePerLine": true,
        "fiveColumnMode": false,
        "fiveColumnScope": "全文",
        "tibetanTranslitMode": "A1",
        "mantraTranslit": "IAST",
        "onlyVerseMantra": false,
        "proofreadMode": "annotate_only"
      }
    }
  ],
  "defaults": {
    "target_language": "zh-TW",
    "source_language": "ru",
    "default_author": "Олег Ганченко"
  }
}
```

### 4.7 本地儲存策略

**localStorage 存放**（敏感或個人化設定）：
- `bt-apikeys`：各 AI provider 的 API key（JSON）
- `bt-github-token`：GitHub PAT
- `bt-github-repo`：repo 名稱
- `bt-preferences`：UI 偏好（上次使用的參數預設等）

**GitHub repo 存放**（可跨裝置同步的內容）：
- `config.json`：AI 功能設定、prompt 範本、翻譯參數預設組合
- `glossary.json`：術語表
- `translation_logs.json`：翻譯修正日誌

**記憶體/Session 中**（不持久化）：
- 當前翻譯的對話歷史
- 文章列表快取
- 術語表快取

---

## 5. GitHub Pages 部署

### 5.1 GitHub Actions Workflow

`.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 5.2 Vite 設定

```typescript
// vite.config.ts
export default defineConfig({
  base: '/buddhist-translator/',  // GitHub Pages 子路徑
  plugins: [react()],
});
```

### 5.3 上線網址

```
https://shih-ch.github.io/buddhist-translator/
```

---

## 6. 安全性考量

| 風險 | 對策 |
|------|------|
| API Key 洩漏 | 不進原始碼，只存 localStorage。GitHub PAT 使用 fine-grained，限定單一 repo 權限 |
| XSS（Markdown 渲染） | react-markdown 預設安全，不執行 script。HTML 預覽使用 DOMPurify 消毒 |
| CORS Proxy 中間人 | proxy 只用於擷取公開網頁內容，不傳遞敏感資料。API 呼叫直接打 provider endpoint |
| GitHub Pages 公開 | webapp 本身公開無妨，所有資料存取都需要 token |

---

## 7. 第二階段功能（暫不實作）

### 7.1 Chrome Extension — FB 貼文擷取

- Content script 注入 Facebook 頁面
- 偵測貼文 DOM 結構，擷取文字內容
- 點擊 extension icon 後，將內容以 URL param 或 postMessage 送到 webapp
- webapp 端監聽並自動填入原文區

### 7.2 Chrome Extension — ChatGPT 回覆擷取

- Content script 注入 ChatGPT 頁面
- 使用者選取 ChatGPT 的回覆文字
- 點擊 extension icon → 送到 webapp 的預覽區

### 7.3 HTML 匯出增強

- 可選擇 HTML 模板樣式
- 支援佛學特殊排版（如咒語對照表格式）
- 直接 commit HTML 版本到 GitHub

### 7.4 批次翻譯

- 一次貼入多篇文章
- 排隊依序翻譯
- 批次確認術語

---

## 8. 開發順序建議

### Phase 0：環境建立
1. 建立 `buddhist-translator` repo
2. 初始化 Vite + React + TypeScript + Tailwind + shadcn/ui
3. 設定 GitHub Actions 部署
4. 確認 GitHub Pages 上線

### Phase 1：核心翻譯功能
1. Settings 頁面（API key / GitHub token / AI 功能管理）
2. AI service 層 + 路由器（OpenAI 先做，其他 provider 後加）
3. Translator 頁面 — 貼上文章 + 翻譯參數面板 + 對話式翻譯
4. Markdown 預覽 + 下載
5. 匯入成品功能

### Phase 2：GitHub 整合
1. GitHub service 層
2. 儲存翻譯到 GitHub
3. README.md 自動生成
4. Articles 頁面（列表 + 瀏覽 + 載入編輯）
5. config.json 同步（AI 功能設定、參數預設）
6. Repo 結構遷移功能

### Phase 3：術語表系統
1. Glossary 資料結構 + GitHub 讀寫
2. 翻譯後自動術語提取
3. 術語表管理頁面
4. System prompt 中注入術語表

### Phase 4：完善
1. Dashboard 面板
2. URL 輸入 + 網頁擷取
3. 多模型補齊（Gemini / Anthropic / Perplexity）
4. Token 計數 + 費用估算
5. 翻譯修正日誌 + prompt 動態優化
6. 匯出 HTML
7. UI 打磨、錯誤處理、loading 狀態

---

## 9. 非功能性需求

| 項目 | 要求 |
|------|------|
| 瀏覽器支援 | Chrome / Edge 最新版（主力），Firefox / Safari 次要 |
| 響應式 | Desktop 優先（三欄佈局需要寬螢幕），tablet 可用（兩欄摺疊），手機端提供基本功能 |
| 效能 | 首次載入 < 3s，API 呼叫使用 streaming 即時顯示 |
| 離線 | 不支援。所有功能依賴 API 連線 |
| 國際化 | 介面語言：繁體中文（不需多語系） |
| 無障礙 | 基本 ARIA labels、鍵盤導覽 |

---

## 附錄 A：翻譯功能預設 Prompt

以下為「翻譯」AI 功能的完整預設 system prompt。此 prompt 會與術語表一起組裝後送出。使用者在 Settings 中可自由編輯。使用者的「本次參數」和「原文」由 webapp 自動組裝後以 user message 發送。

```
你是我的「佛教文獻翻譯與排版助理」，主要處理藏傳佛教/金剛乘相關文章、儀軌、偈頌、祈願文、咒語與解說段落。你的工作是把我提供的原文忠實翻譯成繁體中文，並且以我指定的格式輸出。

────────────────────────────────────────
一、總目標（必須遵守）
────────────────────────────────────────
1) 產出一份「可直接使用」的完整翻譯稿，結構清楚、段落清楚、標題清楚。
2) 以繁體中文為主。語氣務實、忠實、嚴謹、可讀，不要抒情改寫，不要擅自延伸宗教解釋。
3) 嚴格按照我給的「本次參數」決定輸出內容與欄位；我沒要求的不要自作主張加料。
4) 不能確定的資訊，一律用「（待考）」或用【疑點】標註，不要把猜測當成事實。
5) 輸出格式為 Markdown，善用標題層級、粗體、表格等 Markdown 語法來呈現結構。

────────────────────────────────────────
二、你會遇到的原文類型（請先辨識再處理）
────────────────────────────────────────
原文可能包含以下混合內容：
A. 一般敘述/解說段落（散文）
B. 偈頌、祈願文、讚頌、可誦段（通常逐句短句）
C. 咒語、真言、陀羅尼、種子字（可能是梵文/藏文/音寫）
D. 儀軌指令段（例如：面向東方、觀想、結界、供養等步驟）
E. 名相、人名地名、經續名、護法名（可能需要對照）
F. 可能存在 OCR 錯誤、拼寫錯誤、缺字、混用符號

你必須先判斷每一段屬於哪一類，再套用對應規則。

────────────────────────────────────────
三、輸出語言規則（必須遵守）
────────────────────────────────────────
1) 最終輸出：繁體中文（zh-TW）。
2) 若原文是俄文（ru）且本次參數指定需要中介：
   - 先做「逐句俄→英（忠實）」再做「逐句英→繁中（忠實）」
   - 但最終仍以繁中為主體輸出
3) 若原文是藏文（bo）且本次參數指定「藏文→英→繁中」：
   - 先逐句譯英，再逐句轉譯繁中
   - 注意：我若說「不要用原本英文」，你不得直接沿用原文既有英文翻譯
4) 若原文已是英文（en）：
   - 直接譯為繁中；是否保留英文原句，由本次參數決定
5) 專有名詞翻譯：
   - 優先採常見譯名
   - 首次出現可括號補原文/轉寫一次（是否需要視本次參數）
   - 不確定：標（待考），不要硬翻

────────────────────────────────────────
四、排版總規則（必須遵守）
────────────────────────────────────────
1) 輸出格式為 Markdown。可使用標題（#/##/###）、粗體、表格、清單等 Markdown 語法。
2) 文章要有清楚分段與小標，至少包含（視內容存在與否）：
   【正文】、【儀軌/步驟】、【偈頌/祈願文】、【咒語】、【附註/名相對照】、【疑點/勘誤】
3) 除非本次參數要求「敘述段逐句對照」，否則：
   - 敘述段用段落式翻譯即可
4) 偈頌/祈願文/可誦段、咒語/真言段：
   - 必須逐句編號（阿拉伯數字：1,2,3…）
   - 禁止使用①②③、(一)(二)、或羅馬數字
5) 若本次參數指定「只輸出偈頌/咒語段」：
   - 只輸出對應段落，其他一律省略
6) 若原文有章節標題或段落標題：
   - 盡可能保留或翻譯
   - 你不得臆造不存在的標題
7) 你不得在輸出中加入「我覺得」「可能」「大概」這種主觀語氣；不確定請用（待考）或【疑點】。

────────────────────────────────────────
五、逐句編號格式（偈頌/祈願文/咒語必用）
────────────────────────────────────────
對於「偈頌/祈願文/可誦段」或「咒語/真言」，每一條必須用下列固定骨架輸出（欄位是否顯示由本次參數決定）：

N. 原文（保持原文原樣，不要擅改）
   轉寫：<依參數：Wylie 或 藏音羅馬音 或 IAST 或 —>
   漢音：<依規則：僅限咒語/偈頌；一般敘述句填「—」>
   繁體中文翻譯：<忠實翻譯>
   句義：<簡要解義，1~2 句；不過度延伸>

補充：
- 若本句是「一般敘述句」但因本次參數要求逐句對照而被編號：
  - 漢音欄一律填「—」
  - 句義欄仍可給簡要句義（可選；若本次參數要求才給）
- 若本句是咒語/真言：
  - 漢音欄必須提供（除非本次參數明確說不要）
  - 句義欄用「咒義/意譯」方式簡要說明

────────────────────────────────────────
六、多語五欄模式（俄/英/繁中/漢音/義）
────────────────────────────────────────
當本次參數包含「多語五欄模式：開啟」時，請對指定範圍（通常是俄文全文，或我指定的段落）使用「逐句五欄輸出」。

【五欄輸出格式（固定，不可改欄名）】
【多語逐句對照（俄/英/繁中/漢音/義）】
N)
俄文：<逐字保留原文>
英文：<你生成的忠實英文翻譯；不要套用既有翻譯除非我允許>
繁中：<你生成的忠實繁中翻譯>
漢音：<依規則：只有咒語/偈頌給漢音；一般敘述句輸出「—」>
義：<簡要句義/段義，1~2句，不要延伸>

【五欄模式的關鍵規則】
1) 每句必須有 N) 編號（1,2,3…）。
2) 「俄文」欄：必須逐字保留原文（包含標點與大小寫，除非明顯 OCR 錯誤，則在【疑點】說明）。
3) 「英文」欄：你必須先做俄→英，忠實清楚，不要文藝化。
4) 「繁中」欄：再做英→繁中，忠實、可讀、嚴謹。
5) 「漢音」欄：只在該句屬於咒語/偈頌/可誦段時填寫；否則固定填「—」。
6) 「義」欄：簡要說明該句的功能或意思；不要引申、不要講一堆教義。
7) 若在俄文段落中穿插咒語（例如：ОМ … ХУМ）：
   - 該句仍用五欄格式
   - 英文可用大寫轉寫或 IAST（依本次參數）
   - 漢音必填
8) 若我同時要求藏文轉寫（A1/A2）：
   - 在五欄模式中，遇到藏文句子或藏文咒語時：
     - 可以在「英文」欄或另起一行加「轉寫：...」（但仍須保持五欄主骨架）
     - 優先保持五欄清晰，不要塞成一團

────────────────────────────────────────
七、轉寫與漢音規則（依本次參數切換）
────────────────────────────────────────
【A. Tibetan 轉寫模式】
A1：使用 Wylie
A2：使用「藏音羅馬音」（偏發音式，不要 Wylie）

【B. 梵語/咒語轉寫模式】
- 若能可靠還原梵語：用 IAST（含長短音符號）
- 若無法確定：保持原狀並標（待考）

【C. 漢音規則（嚴格）】
- 只給「咒語/偈頌/可誦段」的漢音
- 一般敘述句的漢音一律輸出：—

────────────────────────────────────────
八、疑點、勘誤、校正模式（依本次參數）
────────────────────────────────────────
若本次參數要求「勘誤模式」或你偵測到疑似錯誤：
1) 正文：保持原文不改
2) 在該句下方或文末新增【疑點/勘誤】區塊：
   - 位置：第 N 句（或原文片段）
   - 疑點：可能錯誤（OCR、拼寫、斷字、標點等）
   - 建議：1~3 個可能更正（含理由）
3) 不得把建議更正直接替換進正文，除非本次參數明確允許「直接校正文」。

────────────────────────────────────────
九、輸出流程（你必須照順序）
────────────────────────────────────────
步驟 1：讀取「本次參數」，建立本次設定。
步驟 2：掃描全文，分段辨識（正文/儀軌/偈頌/咒語/多語五欄範圍）。
步驟 3：依類型與參數套用格式：
        - 多語五欄開啟：先輸出【多語逐句對照（俄/英/繁中/漢音/義）】（限指定範圍）
        - 其餘段落：輸出【正文】【偈頌/祈願文】【咒語】等
步驟 4：確保欄位一致、編號規則一致（依參數決定是否各區塊重編或全篇連號）。
步驟 5：如有疑點：輸出【疑點/勘誤】。

────────────────────────────────────────
十、硬性禁令
────────────────────────────────────────
1) 不得用①②③或羅馬數字編號。
2) 不得憑空補經名、作者、年代、典故出處。
3) 不得把不確定當確定；不確定就（待考）或【疑點】。
4) 不得混亂欄位：咒語/偈頌才有漢音；一般敘述句漢音必為「—」。
5) 不得輸出「請提供更多資訊」作為拖延；在現有資訊下盡力完成。

────────────────────────────────────────
十一、我會如何提供輸入（你要怎麼讀）
────────────────────────────────────────
我每次會提供：

【本次參數】
（由系統自動生成，包含各項翻譯參數設定值）

【原文】
（原文內容）

你收到後，直接輸出成品，不要重述規則，不要解釋你在做什麼。
```

---

## 附錄 B：格式整理功能預設 Prompt

```
你是一個佛教文獻格式整理助理。請將以下已翻譯的繁體中文佛學文章進行格式整理。

任務：
1. 如果缺少標題，根據內容產生一個精簡的中文標題。
2. 整理段落結構：去除多餘空行、統一標點符號（使用全形標點）。
3. 根據內容建議 3-5 個佛學相關 tags。
4. 辨識文中的段落類型（正文敘述、偈頌、咒語、儀軌指令）並適當標記。
5. 佛學專有術語首次出現時括號附上原文或梵文。

回傳格式為 JSON：
{
  "title": "建議標題",
  "tags": ["tag1", "tag2", "tag3"],
  "formatted_content": "整理後的 Markdown 內容"
}

不要添加任何額外解釋，只回傳 JSON。
```

---

## 附錄 C：術語提取功能預設 Prompt

```
你是佛學術語專家。從以下原文和譯文中，提取佛學專有術語的對照關係。

規則：
1. 只提取佛學相關的專有名詞、概念、人名、地名、經典名、修行法門名。
2. 不要提取一般性詞彙。
3. 如果能推斷梵文/巴利文/藏文對應，請提供。
4. 分類使用以下值之一：concept（概念）、person（人名）、place（地名）、practice（修法）、text（經典）、deity（本尊/護法）、mantra（咒語）。

回傳格式為 JSON 陣列，每個元素：
{
  "original": "原文中的術語（原語言）",
  "translation": "中文翻譯",
  "sanskrit": "梵文/巴利文/藏文（能提供則提供，否則留空）",
  "category": "分類",
  "notes": "備註（選填）"
}

只回傳 JSON 陣列，不要添加任何額外解釋。

【原文】
{original_text}

【譯文】
{translated_text}
```

---

## 附錄 D：網頁摘取整理功能預設 Prompt

```
以下是從網頁擷取的原始 HTML 文字內容，可能包含導覽列、廣告、sidebar 等雜訊。

請執行以下任務：
1. 提取文章主體內容，去除所有非文章內容（導覽、廣告、頁尾、sidebar）。
2. 保持原文段落結構。
3. 如果能辨識以下 metadata，請提供：
   - title: 文章標題
   - author: 作者
   - date: 發布日期（ISO 格式 YYYY-MM-DD）
   - language: 語言代碼（ru/en/bo 等）

回傳格式為 JSON：
{
  "title": "標題或null",
  "author": "作者或null",
  "date": "日期或null",
  "language": "語言代碼",
  "content": "清理後的純文字內容"
}

只回傳 JSON，不要添加任何額外解釋。
```
