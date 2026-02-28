import type { TranslationParams } from '../../types/settings';
import type { GlossaryTerm } from '../../types/glossary';
import type { AIMessage } from './types';
import { filterRelevantTerms } from '../glossaryFilter';

const PARAM_LABELS: Record<string, string> = {
  keepOriginalPerLine: '保留原文逐句',
  narrativePerLine: '敘述段逐句對照',
  fiveColumnMode: '多語五欄模式',
  tibetanTranslitMode: 'Tibetan 轉寫模式',
  mantraTranslit: '咒語/梵語轉寫',
  onlyVerseMantra: '只輸出偈頌/咒語段',
  proofreadMode: '勘誤模式',
};

const BOOLEAN_MAP: Record<string, [string, string]> = {
  keepOriginalPerLine: ['是', '否'],
  narrativePerLine: ['是', '否'],
  fiveColumnMode: ['開啟', '關閉'],
  onlyVerseMantra: ['是', '否'],
};

const TIBETAN_MODE_LABELS: Record<string, string> = {
  A1: 'A1（Wylie）',
  A2: 'A2（藏音羅馬音）',
};

const MANTRA_TRANSLIT_LABELS: Record<string, string> = {
  wylie: 'Wylie',
  IAST: 'IAST',
  keep_original: '保留原狀',
  if_possible: '能則提供',
};

const PROOFREAD_LABELS: Record<string, string> = {
  off: '關閉',
  annotate_only: '標註疑點但不擅改正文',
  allow_correction: '允許直接校正文',
};

/**
 * Format TranslationParams into the parameter block text injected into the user message.
 */
export function formatParamsBlock(params: TranslationParams): string {
  const lines: string[] = ['【本次參數】'];

  for (const [key, label] of Object.entries(PARAM_LABELS)) {
    const value = params[key as keyof TranslationParams];

    if (typeof value === 'boolean') {
      const [onLabel, offLabel] = BOOLEAN_MAP[key] ?? ['是', '否'];
      lines.push(`- ${label}：${value ? onLabel : offLabel}`);
    } else if (key === 'tibetanTranslitMode') {
      lines.push(`- ${label}：${TIBETAN_MODE_LABELS[value as string] ?? value}`);
    } else if (key === 'mantraTranslit') {
      lines.push(`- ${label}：${MANTRA_TRANSLIT_LABELS[value as string] ?? value}`);
    } else if (key === 'proofreadMode') {
      lines.push(`- ${label}：${PROOFREAD_LABELS[value as string] ?? value}`);
    }
  }

  // Five-column scope (only shown when five-column mode is on)
  if (params.fiveColumnMode) {
    lines.push(`- 五欄範圍：${params.fiveColumnScope || '全文'}`);
  }

  // Fixed rule
  lines.push('- 漢音規則：僅咒語/偈頌提供；一般敘述句填「—」');

  return lines.join('\n');
}

/**
 * Format glossary terms into a text block appended to the system prompt.
 */
export function formatGlossaryBlock(terms: GlossaryTerm[]): string {
  if (terms.length === 0) return '';

  const header = [
    '',
    '────────────────────────────────────────',
    '術語表（翻譯時必須遵守）',
    '────────────────────────────────────────',
  ];

  const rows = terms.map((t) => {
    let line = `- ${t.original} → ${t.translation}`;
    if (t.sanskrit) line += `（${t.sanskrit}）`;
    if (t.notes) line += ` // ${t.notes}`;
    return line;
  });

  return [...header, ...rows].join('\n');
}

/**
 * Build the full message array for the "translation" AI function.
 *
 * system = prompt template + glossary
 * user   = params block + original text
 * Then append any prior chat history (correction rounds).
 */
export function buildTranslationMessages(
  systemPrompt: string,
  originalText: string,
  params: TranslationParams,
  glossaryTerms: GlossaryTerm[],
  chatHistory: AIMessage[]
): AIMessage[] {
  const filteredTerms = filterRelevantTerms(glossaryTerms, originalText);
  const glossaryBlock = formatGlossaryBlock(filteredTerms);
  const fullSystem = systemPrompt + glossaryBlock;

  const paramsBlock = formatParamsBlock(params);
  const userContent = `${paramsBlock}\n\n【原文】\n${originalText}`;

  const messages: AIMessage[] = [
    { role: 'system', content: fullSystem },
    { role: 'user', content: userContent },
  ];

  // Append prior chat history (assistant replies + user corrections)
  for (const msg of chatHistory) {
    if (msg.role !== 'system') {
      messages.push(msg);
    }
  }

  return messages;
}

/**
 * Build messages for the "formatting" AI function.
 */
export function buildFormattingMessages(
  systemPrompt: string,
  translatedText: string,
  originalText?: string
): AIMessage[] {
  let userContent = translatedText;
  if (originalText) {
    userContent += `\n\n---\n\n【原文】\n${originalText}`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}

/**
 * Build messages for the "term_extraction" AI function.
 * The prompt template contains {original_text} and {translated_text} placeholders.
 */
export function buildTermExtractionMessages(
  systemPrompt: string,
  originalText: string,
  translatedText: string
): AIMessage[] {
  const filled = systemPrompt
    .replace('{original_text}', originalText)
    .replace('{translated_text}', translatedText);

  return [
    { role: 'system', content: filled },
    { role: 'user', content: `【原文】\n${originalText}\n\n【譯文】\n${translatedText}` },
  ];
}

/**
 * Build messages for the "url_cleanup" AI function.
 */
export function buildUrlCleanupMessages(
  systemPrompt: string,
  rawHtml: string
): AIMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: rawHtml },
  ];
}

/**
 * Build messages for the "glossary_fill" AI function.
 * The prompt template contains {terms} placeholder.
 */
export function buildGlossaryFillMessages(
  systemPrompt: string,
  terms: string[]
): AIMessage[] {
  const termsList = terms.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const filled = systemPrompt.replace('{terms}', termsList);
  return [
    { role: 'system', content: filled },
    { role: 'user', content: `請翻譯以上 ${terms.length} 個術語。` },
  ];
}
