import { useSettingsStore } from '@/stores/settingsStore'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useCostTrackingStore } from '@/stores/costTrackingStore'
import { AI_PROVIDERS } from '@/stores/aiModels'

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'

const LANG_HINTS: Record<string, string> = {
  rus: '俄文 (Russian)',
  eng: '英文 (English)',
  bod: '藏文 (Tibetan, Uchen 或藏文書體)',
  san: '梵文 (Sanskrit, 可能為 Devanāgarī 或悉曇)',
  chi_tra: '繁體中文 (Traditional Chinese)',
}

async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`無法讀取圖片：${res.status}`)
  const blob = await res.blob()
  const mediaType = blob.type || 'image/png'
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ base64, mediaType })
    }
    reader.onerror = () => reject(new Error('圖片讀取失敗'))
    reader.readAsDataURL(blob)
  })
}

export async function ocrWithClaude(imageUrl: string, langCode: string): Promise<string> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('ocr_image')
  const apiKey = useSettingsStore.getState().apiKeys[fnConfig.provider]
  if (!apiKey) {
    throw new Error(`需要設定 ${fnConfig.provider} API Key`)
  }

  const { base64, mediaType } = await imageUrlToBase64(imageUrl)
  const langHint = LANG_HINTS[langCode] ?? langCode
  const userText = `${fnConfig.prompt}\n\n預期語言：${langHint}`

  const body = {
    model: fnConfig.model,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
  }

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  const text =
    (data.content as Array<{ text?: string }> | undefined)
      ?.map((b) => b.text ?? '')
      .join('')
      .trim() ?? ''

  // Track cost
  const inputTokens = data.usage?.input_tokens ?? 0
  const outputTokens = data.usage?.output_tokens ?? 0
  const provider = AI_PROVIDERS[fnConfig.provider]
  const modelInfo = provider?.models.find((m) => m.id === fnConfig.model)
  const inputPrice = modelInfo?.inputPrice ?? 1
  const outputPrice = modelInfo?.outputPrice ?? 5
  const cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000

  useCostTrackingStore.getState().addEntry({
    provider: fnConfig.provider,
    model: fnConfig.model,
    functionType: 'ocr_image',
    inputTokens,
    outputTokens,
    cost,
  })

  return text
}
