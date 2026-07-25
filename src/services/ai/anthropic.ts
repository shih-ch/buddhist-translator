import type { AIProviderAdapter, AIMessage, AIResponse, AIModel, StreamCallbacks } from './types';

const ANTHROPIC_MODELS: AIModel[] = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', inputPrice: 3.0, outputPrice: 15.0 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', inputPrice: 0.8, outputPrice: 4.0 },
];

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

// max_tokens caps thinking + response text together, and Claude Opus 5 thinks by
// default — 8192 left long translations truncated mid-text. Streaming can afford
// a lot more headroom; the non-streaming AI functions stay lower so the request
// finishes inside the HTTP timeout. Both are within every current model's ceiling
// (Haiku 4.5 is the lowest at 64K).
const MAX_TOKENS_STREAM = 32000;
const MAX_TOKENS_NON_STREAM = 16000;

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/**
 * A safety-classifier decline comes back as a *successful* HTTP 200 with
 * `stop_reason: "refusal"` and empty (or partial) content — not an error status.
 * Without this the caller would just render a blank translation with no
 * explanation. Claude Fable 5 runs these classifiers most aggressively.
 */
function refusalError(stopDetails: { category?: string } | null | undefined): Error {
  const category = stopDetails?.category;
  return new Error(
    `模型安全機制拒絕了這次請求${category ? `（類別：${category}）` : ''}，請改用其他模型重試。`
  );
}

/**
 * Anthropic uses a separate top-level `system` field rather than a system message in `messages`.
 * Extract system prompt and convert messages accordingly.
 */
function splitSystemAndMessages(messages: AIMessage[]): {
  system: string | undefined;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  let system: string | undefined;
  const filtered: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = (system ? system + '\n\n' : '') + msg.content;
    } else {
      filtered.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  return { system, messages: filtered };
}

async function callNonStreaming(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<AIResponse> {
  const { system, messages: apiMessages } = splitSystemAndMessages(messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS_NON_STREAM,
    messages: apiMessages,
  };
  if (system) body.system = system;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    throw refusalError(data.stop_details);
  }
  const content = data.content?.map((b: { text: string }) => b.text).join('') ?? '';

  return {
    content,
    model: data.model ?? model,
    provider: 'anthropic',
    usage: {
      prompt_tokens: data.usage?.input_tokens ?? 0,
      completion_tokens: data.usage?.output_tokens ?? 0,
      total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    },
  };
}

async function callStreaming(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  stream: StreamCallbacks,
  signal?: AbortSignal
): Promise<AIResponse> {
  const { system, messages: apiMessages } = splitSystemAndMessages(messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS_STREAM,
    messages: apiMessages,
    stream: true,
  };
  if (system) body.system = system;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    const error = new Error(`Anthropic API error (${res.status}): ${err}`);
    stream.onError(error);
    throw error;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;
  // Set from message_delta; thrown after the read loop — throwing inside it would
  // be swallowed by the malformed-JSON catch below.
  let refused = false;
  let refusalDetails: { category?: string } | null | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        try {
          const json = JSON.parse(payload);

          if (json.type === 'content_block_delta' && json.delta?.text) {
            fullText += json.delta.text;
            stream.onChunk(json.delta.text);
          }

          if (json.type === 'message_start' && json.message?.usage) {
            inputTokens = json.message.usage.input_tokens ?? 0;
          }

          if (json.type === 'message_delta' && json.usage) {
            outputTokens = json.usage.output_tokens ?? 0;
          }

          if (json.type === 'message_delta' && json.delta?.stop_reason === 'refusal') {
            refused = true;
            refusalDetails = json.delta.stop_details ?? json.stop_details;
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    stream.onError(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }

  if (refused) {
    const error = refusalError(refusalDetails);
    stream.onError(error);
    throw error;
  }

  const usage = {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };

  const response: AIResponse = { content: fullText, model, provider: 'anthropic', usage };
  stream.onDone(fullText, usage);
  return response;
}

export const anthropicAdapter: AIProviderAdapter = {
  id: 'anthropic',
  name: 'Anthropic',
  models: ANTHROPIC_MODELS,

  async call(messages, model, apiKey, stream, signal) {
    if (stream) {
      return callStreaming(messages, model, apiKey, stream, signal);
    }
    return callNonStreaming(messages, model, apiKey, signal);
  },

  async testConnection(apiKey) {
    try {
      const { system, messages } = splitSystemAndMessages([
        { role: 'system', content: 'Reply with OK.' },
        { role: 'user', content: 'Test' },
      ]);

      const body: Record<string, unknown> = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16,
        messages,
      };
      if (system) body.system = system;

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
