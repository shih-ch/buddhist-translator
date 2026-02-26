import type { AIProviderAdapter, AIMessage, AIResponse, AIModel, StreamCallbacks } from './types';

const PERPLEXITY_MODELS: AIModel[] = [
  { id: 'sonar', name: 'Sonar', provider: 'perplexity', inputPrice: 1.0, outputPrice: 1.0 },
  { id: 'sonar-pro', name: 'Sonar Pro', provider: 'perplexity', inputPrice: 3.0, outputPrice: 15.0 },
];

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';

/**
 * Perplexity uses an OpenAI-compatible API format.
 */
function buildRequestBody(messages: AIMessage[], model: string, stream: boolean) {
  return {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream,
  };
}

async function callNonStreaming(
  messages: AIMessage[],
  model: string,
  apiKey: string
): Promise<AIResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(messages, model, false)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? '',
    model: data.model ?? model,
    provider: 'perplexity',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  };
}

async function callStreaming(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  stream: StreamCallbacks
): Promise<AIResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(messages, model, true)),
  });

  if (!res.ok) {
    const err = await res.text();
    const error = new Error(`Perplexity API error (${res.status}): ${err}`);
    stream.onError(error);
    throw error;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            stream.onChunk(delta);
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

  const response: AIResponse = {
    content: fullText,
    model,
    provider: 'perplexity',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
  stream.onDone(fullText, response.usage);
  return response;
}

export const perplexityAdapter: AIProviderAdapter = {
  id: 'perplexity',
  name: 'Perplexity',
  models: PERPLEXITY_MODELS,

  async call(messages, model, apiKey, stream) {
    if (stream) {
      return callStreaming(messages, model, apiKey, stream);
    }
    return callNonStreaming(messages, model, apiKey);
  },

  async testConnection(apiKey) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 8,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
