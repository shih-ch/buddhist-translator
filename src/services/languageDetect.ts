/**
 * Simple rule-based language detection.
 * No external dependencies needed.
 */

type DetectedLanguage = 'ru' | 'en' | 'bo' | 'zh' | 'other';

const CYRILLIC_RE = /[\u0400-\u04FF]/g;
const TIBETAN_RE = /[\u0F00-\u0FFF]/g;
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
const LATIN_RE = /[a-zA-Z]/g;

export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) return 'other';

  const sample = text.slice(0, 2000);
  const total = sample.replace(/\s/g, '').length;
  if (total === 0) return 'other';

  const cyrillicCount = (sample.match(CYRILLIC_RE) || []).length;
  const tibetanCount = (sample.match(TIBETAN_RE) || []).length;
  const cjkCount = (sample.match(CJK_RE) || []).length;
  const latinCount = (sample.match(LATIN_RE) || []).length;

  const cyrillicRatio = cyrillicCount / total;
  const tibetanRatio = tibetanCount / total;
  const cjkRatio = cjkCount / total;
  const latinRatio = latinCount / total;

  if (tibetanRatio > 0.1) return 'bo';
  if (cyrillicRatio > 0.3) return 'ru';
  if (cjkRatio > 0.3) return 'zh';
  if (latinRatio > 0.3) return 'en';

  return 'other';
}

const LANGUAGE_NAMES: Record<DetectedLanguage, string> = {
  ru: '俄文',
  en: '英文',
  bo: '藏文',
  zh: '中文',
  other: '其他',
};

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code as DetectedLanguage] ?? code;
}
