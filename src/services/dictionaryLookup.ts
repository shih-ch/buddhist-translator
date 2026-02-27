import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { trackedCallFunction } from '@/services/ai/trackedCall'
import type { AIMessage } from '@/services/ai/types'

export interface DictionaryResult {
  term: string
  etymology: string
  definition: string
  chinese: string
  related: string[]
}

/**
 * Look up a Buddhist term using AI.
 * Uses the dedicated 'dictionary_lookup' function config (own provider/model).
 */
export async function lookupTerm(term: string): Promise<DictionaryResult> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('dictionary_lookup')
  const apiKeys = useSettingsStore.getState().apiKeys

  const messages: AIMessage[] = [
    { role: 'system', content: fnConfig.prompt },
    { role: 'user', content: `請查詢術語：${term}` },
  ]

  const response = await trackedCallFunction(
    fnConfig,
    apiKeys,
    messages,
    {
      overrideProvider: fnConfig.provider,
      overrideModel: fnConfig.model,
    },
    'dictionary_lookup'
  )

  // Parse JSON from response
  let text = response.content.trim()
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) text = codeBlock[1].trim()

  try {
    return JSON.parse(text) as DictionaryResult
  } catch {
    // If parsing fails, return a basic result
    return {
      term,
      etymology: '',
      definition: response.content,
      chinese: '',
      related: [],
    }
  }
}
