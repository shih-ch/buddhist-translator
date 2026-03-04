import type { AIProviderAdapter, AIMessage, AIResponse, AIModel, StreamCallbacks } from './types';

const GEMINI_MODELS: AIModel[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', inputPrice: 0.1, outputPrice: 0.4 },
  { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'google', inputPrice: 1.25, outputPrice: 10.0 },
];

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini uses `role: "model"` instead of `role: "assistant"`,
 * and system instructions go in a separate `system_instruction` field.
 */
function buildGeminiBody(messages: AIMessage[]) {
  let systemText = '';
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const body: Record<string, unknown> = { contents };
  if (systemText) {
    body.system_instruction = { parts: [{ text: systemText }] };
  }

  return body;
}

async function callNonStreaming(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<AIResponse> {
  const url = `${BASE_URL}/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildGeminiBody(messages)),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const meta = data.usageMetadata;

  return {
    content: text,
    model,
    provider: 'google',
    usage: {
      prompt_tokens: meta?.promptTokenCount ?? 0,
      completion_tokens: meta?.candidatesTokenCount ?? 0,
      total_tokens: meta?.totalTokenCount ?? 0,
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
  const url = `${BASE_URL}/${model}:streamGenerateContent?alt=sse`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildGeminiBody(messages)),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    const error = new Error(`Gemini API error (${res.status}): ${err}`);
    stream.onError(error);
    throw error;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;

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
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            stream.onChunk(text);
          }

          const meta = json.usageMetadata;
          if (meta) {
            promptTokens = meta.promptTokenCount ?? promptTokens;
            completionTokens = meta.candidatesTokenCount ?? completionTokens;
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  } catch (err) {
    stream.onError(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }

  const usage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };

  const response: AIResponse = { content: fullText, model, provider: 'google', usage };
  stream.onDone(fullText, usage);
  return response;
}

export const geminiAdapter: AIProviderAdapter = {
  id: 'google',
  name: 'Google Gemini',
  models: GEMINI_MODELS,

  async call(messages, model, apiKey, stream, signal) {
    if (stream) {
      return callStreaming(messages, model, apiKey, stream, signal);
    }
    return callNonStreaming(messages, model, apiKey, signal);
  },

  async testConnection(apiKey) {
    try {
      const res = await fetch(BASE_URL, {
        headers: { 'x-goog-api-key': apiKey },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
