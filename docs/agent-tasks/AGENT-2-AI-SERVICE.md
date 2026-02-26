# Agent 2：AI Service 層

## 優先級：🟡 中（等 Agent 1 步驟 1~4 完成後開始）

## 前置條件

- Agent 1 已完成專案初始化（步驟 1~3）
- Agent 1 已建立 `src/types/` 下的型別定義檔案（步驟 4）

## 職責

實作所有 AI API 的呼叫層，包含 4 個 provider 的 adapter、AI 路由器、streaming 解析、prompt 組裝邏輯、token 計數與費用估算。

## 參考規格

請先完整閱讀 `buddhist-translator-spec.md`，你主要負責的章節：
- 4.3 AI 功能路由系統（4.3.1 ~ 4.3.4）
- 3.3.7 System Prompt 組裝邏輯
- 3.3.2 翻譯參數面板（理解參數如何注入 prompt）
- 附錄 A/B/C/D（四個功能的預設 prompt）

## 任務清單

### 步驟 1：AI 型別補充

在 Agent 1 建立的型別基礎上，建立 `src/services/ai/types.ts`：

```typescript
import { AIProviderId, AIFunctionId, TranslationParams } from '../../types/settings';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProviderId;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderId;
  inputPrice: number;    // USD per 1M tokens
  outputPrice: number;   // USD per 1M tokens
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (fullText: string, usage?: AIResponse['usage']) => void;
  onError: (error: Error) => void;
}

export interface AIProviderAdapter {
  id: AIProviderId;
  name: string;
  models: AIModel[];
  call(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    stream?: StreamCallbacks
  ): Promise<AIResponse>;
  testConnection(apiKey: string): Promise<boolean>;
}
```

### 步驟 2：四個 Provider Adapter

每個 adapter 實作 `AIProviderAdapter` 介面。

**`src/services/ai/openai.ts`**：
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Auth: `Authorization: Bearer {apiKey}`
- Models:
  - `gpt-4o`（GPT-4o, input: $2.50/1M, output: $10.00/1M）
  - `gpt-4o-mini`（GPT-4o Mini, input: $0.15/1M, output: $0.60/1M）
- Streaming: `stream: true`，解析 SSE `data:` 行
  - 每行格式：`data: {"choices":[{"delta":{"content":"..."}}]}`
  - 結束標記：`data: [DONE]`
- `testConnection`: 呼叫 `GET /v1/models` 確認 key 有效

**`src/services/ai/anthropic.ts`**：
- Endpoint: `https://api.anthropic.com/v1/messages`
- Auth headers:
  - `x-api-key: {apiKey}`
  - `anthropic-version: 2023-06-01`
  - `anthropic-dangerous-direct-browser-access: true`（⚠️ 瀏覽器端必需）
  - `content-type: application/json`
- Request body 格式不同於 OpenAI：
  ```json
  {
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 8192,
    "system": "system prompt here",
    "messages": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```
  注意：Anthropic 的 system prompt 不在 messages 中，而是頂層 `system` 欄位。
- Models:
  - `claude-sonnet-4-5-20250929`（Claude Sonnet 4.5, input: $3.00/1M, output: $15.00/1M）
  - `claude-haiku-4-5-20251001`（Claude Haiku 4.5, input: $0.80/1M, output: $4.00/1M）
- Streaming: `stream: true`，解析 SSE event types：
  - `event: content_block_delta` → `data.delta.text`
  - `event: message_stop` → 結束
  - `event: message_delta` → 可能包含 usage
- `testConnection`: 發送一個極短的 message 確認 key 有效

**`src/services/ai/gemini.ts`**：
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Streaming endpoint: `streamGenerateContent?key={apiKey}&alt=sse`
- Auth: URL param `key={apiKey}`
- Request body 格式：
  ```json
  {
    "system_instruction": { "parts": [{ "text": "system prompt" }] },
    "contents": [
      { "role": "user", "parts": [{ "text": "..." }] },
      { "role": "model", "parts": [{ "text": "..." }] }
    ]
  }
  ```
  注意：Gemini 用 `role: "model"` 而非 `role: "assistant"`。
- Models:
  - `gemini-2.0-flash`（Gemini 2.0 Flash, input: $0.10/1M, output: $0.40/1M）
  - `gemini-2.0-pro`（Gemini 2.0 Pro, input: $1.25/1M, output: $10.00/1M）
- Streaming: 解析 JSON chunks，每個 chunk 的 `candidates[0].content.parts[0].text`
- `testConnection`: 呼叫 `GET /v1beta/models?key={apiKey}`

**`src/services/ai/perplexity.ts`**：
- Endpoint: `https://api.perplexity.ai/chat/completions`
- Auth: `Authorization: Bearer {apiKey}`
- 格式同 OpenAI（OpenAI-compatible API）
- Models:
  - `sonar`（Sonar, input: $1.00/1M, output: $1.00/1M）
  - `sonar-pro`（Sonar Pro, input: $3.00/1M, output: $15.00/1M）
- Streaming: 同 OpenAI
- `testConnection`: 發送一個極短的 chat completion

### 步驟 3：AI Router

**`src/services/ai/router.ts`**：

```typescript
import { AIProviderId, AIFunctionId } from '../../types/settings';
import { AIMessage, AIResponse, StreamCallbacks, AIModel } from './types';

class AIRouter {
  private providers: Map<AIProviderId, AIProviderAdapter>;

  constructor() {
    // 註冊所有 provider adapter
  }

  /**
   * 根據 AI 功能 ID 呼叫對應的 provider/model。
   * 從 aiFunctionsStore 讀取該功能的設定（provider, model）。
   * 從 settingsStore 讀取對應的 API key。
   *
   * overrideProvider / overrideModel 用於翻譯對話區臨時切換模型。
   */
  async callFunction(
    functionId: AIFunctionId,
    messages: AIMessage[],
    options?: {
      stream?: StreamCallbacks;
      overrideProvider?: AIProviderId;
      overrideModel?: string;
    }
  ): Promise<AIResponse>;

  /** 取得指定 provider 的可用模型列表 */
  getModelsForProvider(providerId: AIProviderId): AIModel[];

  /** 取得所有 provider 的所有模型（用於全局模型選擇器） */
  getAllModels(): AIModel[];

  /** 測試指定 provider 的 API key */
  async testConnection(providerId: AIProviderId): Promise<boolean>;
}

export const aiRouter = new AIRouter();
```

### 步驟 4：Prompt Builder

**`src/services/ai/promptBuilder.ts`**：

這是組裝 system prompt 的核心邏輯。

```typescript
import { TranslationParams } from '../../types/settings';
import { GlossaryTerm } from '../../types/glossary';

/**
 * 為「翻譯」功能組裝完整的 system + user messages。
 *
 * System message = 翻譯功能的 prompt 範本 + 術語表
 * User message = 本次參數 + 原文
 */
export function buildTranslationMessages(
  systemPrompt: string,       // 從 aiFunctionsStore 取得
  originalText: string,
  params: TranslationParams,
  glossaryTerms: GlossaryTerm[],
  chatHistory: AIMessage[]     // 之前的對話歷史（修正輪次）
): AIMessage[];

/**
 * 為「格式整理」功能組裝 messages。
 */
export function buildFormattingMessages(
  systemPrompt: string,
  translatedText: string,
  originalText?: string
): AIMessage[];

/**
 * 為「術語提取」功能組裝 messages。
 */
export function buildTermExtractionMessages(
  systemPrompt: string,
  originalText: string,
  translatedText: string
): AIMessage[];

/**
 * 為「網頁摘取」功能組裝 messages。
 */
export function buildUrlCleanupMessages(
  systemPrompt: string,
  rawHtml: string
): AIMessage[];

/**
 * 將 TranslationParams 格式化為「本次參數」文字區塊。
 */
export function formatParamsBlock(params: TranslationParams): string;

/**
 * 將術語表格式化為文字區塊，注入 system prompt 末尾。
 * 如果超過 200 條，只帶入相關分類（需外部先篩選）。
 */
export function formatGlossaryBlock(terms: GlossaryTerm[]): string;
```

**`formatParamsBlock` 輸出範例**：
```
【本次參數】
- 保留原文逐句：是
- 敘述段逐句對照：否
- 多語五欄模式：關閉
- Tibetan 轉寫模式：A1（Wylie）
- 咒語/梵語轉寫：IAST
- 只輸出偈頌/咒語段：否
- 漢音規則：僅咒語/偈頌提供；一般敘述句填「—」
- 勘誤模式：標註疑點但不擅改正文
```

### 步驟 5：預設 Prompt 常量

**`src/services/ai/defaultPrompts.ts`**：

將附錄 A/B/C/D 的四個預設 prompt 存為常量字串 export。
這些常量用於：
1. aiFunctionsStore 的初始值
2. Settings 頁面的「恢復預設」功能

```typescript
export const DEFAULT_TRANSLATION_PROMPT = `你是我的「佛教文獻翻譯與排版助理」...（完整內容見規格附錄 A）`;
export const DEFAULT_FORMATTING_PROMPT = `你是一個佛教文獻格式整理助理...（完整內容見規格附錄 B）`;
export const DEFAULT_TERM_EXTRACTION_PROMPT = `你是佛學術語專家...（完整內容見規格附錄 C）`;
export const DEFAULT_URL_CLEANUP_PROMPT = `以下是從網頁擷取的原始 HTML...（完整內容見規格附錄 D）`;
```

### 步驟 6：Token 計數與費用估算

**`src/utils/tokenCounter.ts`**：
- 簡易估算：英文約 4 chars/token，中文約 2 chars/token，俄文約 3 chars/token
- 不需要精確，用於顯示「約 xxx tokens」

**`src/utils/costEstimator.ts`**：
- 根據 AIModel 的 inputPrice/outputPrice + token 數計算費用
- 格式化為 `$0.0012` 或 `< $0.01`

## 你負責的檔案

```
src/
├── services/
│   └── ai/
│       ├── types.ts
│       ├── openai.ts
│       ├── anthropic.ts
│       ├── gemini.ts
│       ├── perplexity.ts
│       ├── router.ts
│       ├── promptBuilder.ts
│       └── defaultPrompts.ts
└── utils/
    ├── tokenCounter.ts
    └── costEstimator.ts
```

## 不要碰的檔案

- `src/components/*`（Agent 1, 3, 4）
- `src/services/github.ts`（Agent 4）
- `src/stores/settingsStore.ts`（Agent 1，但你可以 import 使用）

## 測試方式

在開發過程中，可以建一個臨時的測試頁面或 console 腳本來驗證：
1. 每個 provider 能正常呼叫（用真實 API key 測一個簡短 prompt）
2. Streaming 能正常逐字輸出
3. promptBuilder 組裝的 messages 格式正確
4. Router 能根據 functionId 正確路由到對應 provider

## 完成標記

1. 4 個 provider adapter 都能正常呼叫和 streaming
2. Router 能根據 aiFunctionsStore 的設定路由
3. promptBuilder 能正確組裝翻譯 / 格式整理 / 術語提取 / 網頁摘取的 messages
4. 預設 prompt 常量檔案完整（從規格附錄複製）
5. token 估算和費用計算功能正常
