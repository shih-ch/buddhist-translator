import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { trackedCallFunction } from '@/services/ai/trackedCall'
import type { AIMessage } from '@/services/ai/types'
import { lookupOnline, type CSaltResult } from '@/services/csaltDictionary'

export interface OnlineDictResult {
  source: 'MW' | 'BHS'
  headword: string
  definitions: string[]
}

export interface DictionaryResult {
  term: string
  etymology: string
  definition: string
  chinese: string
  related: string[]
  source?: 'AI' | 'MW' | 'BHS' | 'online+AI'
  onlineResults?: OnlineDictResult[]
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
    return { ...JSON.parse(text) as DictionaryResult, source: 'AI' as const }
  } catch {
    // If parsing fails, return a basic result
    return {
      term,
      etymology: '',
      definition: response.content,
      chinese: '',
      related: [],
      source: 'AI' as const,
    }
  }
}

/**
 * Query online dictionaries first (C-SALT MW + BHS), fall back to AI.
 */
export async function lookupOnlineFirst(term: string): Promise<DictionaryResult> {
  // 1. Try online dictionaries
  let onlineResults: CSaltResult[] = []
  try {
    onlineResults = await lookupOnline(term)
  } catch {
    // Network failure — fall through to AI
  }

  if (onlineResults.length > 0) {
    // Format online results into a DictionaryResult
    const onlineDefs: OnlineDictResult[] = onlineResults.map((r) => ({
      source: r.source,
      headword: r.headword,
      definitions: r.definitions,
    }))

    const primarySource = onlineResults[0].source
    const definitionText = onlineResults
      .map((r) => `[${r.source}] ${r.headword}: ${r.definitions.join('; ')}`)
      .join('\n\n')

    return {
      term,
      etymology: '',
      definition: definitionText,
      chinese: '',
      related: [],
      source: primarySource,
      onlineResults: onlineDefs,
    }
  }

  // 2. No online results — fall back to AI
  return lookupTerm(term)
}

/**
 * Query online dictionaries only (no AI fallback).
 */
export async function lookupOnlineOnly(term: string): Promise<DictionaryResult> {
  let onlineResults: CSaltResult[] = []
  try {
    onlineResults = await lookupOnline(term)
  } catch {
    // Network failure
  }

  if (onlineResults.length > 0) {
    const onlineDefs: OnlineDictResult[] = onlineResults.map((r) => ({
      source: r.source,
      headword: r.headword,
      definitions: r.definitions,
    }))

    const primarySource = onlineResults[0].source
    const definitionText = onlineResults
      .map((r) => `[${r.source}] ${r.headword}: ${r.definitions.join('; ')}`)
      .join('\n\n')

    return {
      term,
      etymology: '',
      definition: definitionText,
      chinese: '',
      related: [],
      source: primarySource,
      onlineResults: onlineDefs,
    }
  }

  return {
    term,
    etymology: '',
    definition: '線上辭典查無此術語。可嘗試切換至「線上優先」或「僅 AI」模式。',
    chinese: '',
    related: [],
  }
}
