import type { AIFunctionId, AIProviderId } from '@/types/settings'

/**
 * The recommended model for each AI function, and why.
 *
 * Two things drive the picks, not raw price:
 *  - Only 翻譯 moves the bill. Everything else together is under 10% of a
 *    article's cost, so the auxiliary functions are chosen for "won't make a
 *    mess I have to redo", not for the lowest sticker price.
 *  - No Gemini, per the user's preference. OCR additionally *cannot* use a
 *    non-Anthropic model: services/ocr.ts posts the Anthropic message shape to
 *    the Anthropic endpoint regardless of the configured provider.
 *
 * Prices in the comments are per 1M tokens, current as of 2026-09.
 */
export const RECOMMENDED_MODELS: Record<AIFunctionId, { provider: AIProviderId; model: string }> = {
  // 品質優先：長文、多語種、五欄對照的嚴格格式，錯了要手動修。
  translation: { provider: 'anthropic', model: 'claude-opus-5' }, // $5/$25

  // 吃模型腦內的梵藏佛學知識，小模型會很有自信地編造詞源。用量極小。
  dictionary_lookup: { provider: 'anthropic', model: 'claude-opus-5' }, // $5/$25

  // 咒語逐段對齊很挑精度。Sonnet 5 降價後同時比 GPT-5.6 Terra 便宜。
  extract_mantra: { provider: 'anthropic', model: 'claude-sonnet-5' }, // $2/$10
  format_mantra: { provider: 'anthropic', model: 'claude-sonnet-5' }, // $2/$10

  // 高解析視覺（2576px）對藏文與天城體的辨識率影響很大；必須是 Anthropic。
  ocr_image: { provider: 'anthropic', model: 'claude-sonnet-5' }, // $2/$10

  // 要吐合法 JSON，比純排版吃指令遵循；輸出量小，貴一點無所謂。
  term_extraction: { provider: 'openai', model: 'gpt-5.6-luna' }, // $0.20/$1.20

  // 機械重排，整篇進整篇出 → 輸出價是成本主體。
  formatting: { provider: 'openai', model: 'gpt-5.6-luna' },
  source_formatting: { provider: 'openai', model: 'gpt-5.6-luna' },
  translation_formatting: { provider: 'openai', model: 'gpt-5.6-luna' },

  // 原始 HTML 又髒又長，需要一點理解力，不用最陽春的。
  url_cleanup: { provider: 'openai', model: 'gpt-5.6-luna' },

  // 批次跑幾千筆、每筆輸出兩三個字，全清單最低單價。
  glossary_fill: { provider: 'openai', model: 'gpt-5-nano' }, // $0.05/$0.40
}
