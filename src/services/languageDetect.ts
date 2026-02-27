/**
 * Advanced rule-based language detection with n-gram scoring.
 * Supports Pali (pi), Sanskrit (sa), Tibetan (bo), Russian (ru), English (en), Chinese (zh).
 */

export type DetectedLanguage = 'ru' | 'en' | 'bo' | 'zh' | 'sa' | 'pi' | 'other';

export interface DetectionResult {
  language: DetectedLanguage
  confidence: number // 0–100
  scores: Partial<Record<DetectedLanguage, number>>
}

// ─── Character class regexes ───

const CYRILLIC_RE = /[\u0400-\u04FF]/g
const TIBETAN_RE = /[\u0F00-\u0FFF]/g
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/g
const LATIN_RE = /[a-zA-Z]/g
const DEVANAGARI_RE = /[\u0900-\u097F]/g
const IAST_DIACRITICS_RE = /[āīūṛṝḷḹṃḥśṣṭḍṇñṅĀĪŪṚṜḶḸṂḤŚṢṬḌṆÑṄ]/g

// ─── N-gram tables for Buddhist languages ───

// Common Pali bigrams (romanized)
const PALI_BIGRAMS = new Set([
  'dh', 'bh', 'kh', 'gh', 'th', 'ph', 'ch', 'jh',
  'tt', 'pp', 'kk', 'ss', 'mm', 'nn', 'gg', 'bb', 'dd',
  'āṇ', 'ṃ ', 'ññ',
])

// Common Pali trigrams
const PALI_TRIGRAMS = new Set([
  'dha', 'bha', 'tta', 'ssa', 'mma', 'nna', 'kka',
  'āna', ' āya', 'ati', 'ssa', ' āṇa', 'iṃ ',
])

// Common Sanskrit bigrams (romanized/IAST)
const SANSKRIT_BIGRAMS = new Set([
  'dh', 'bh', 'kh', 'gh', 'th', 'ph', 'ch', 'jh',
  'śa', 'ṣa', 'ṇa', 'ḥ ', 'kṣ', 'jñ',
])

// Common Sanskrit trigrams
const SANSKRIT_TRIGRAMS = new Set([
  'dha', 'bha', 'tra', 'pra', 'śra', 'gra', 'kṣa',
  'āna', 'aya', 'ati', 'ava', 'anu', 'abh',
])

// Common Sanskrit/Pali Buddhist keywords
const SANSKRIT_KEYWORDS = [
  'dharma', 'karma', 'sutra', 'sūtra', 'mantra', 'tantra', 'yoga',
  'buddha', 'bodhi', 'nirvāṇa', 'nirvana', 'saṃsāra', 'samsara',
  'prajñā', 'prajna', 'śūnya', 'shunyata', 'mahāyāna', 'vajra',
  'bodhisattva', 'tathāgata', 'avalokiteśvara', 'mañjuśrī',
  'dhāraṇī', 'dharani', 'samādhi', 'samadhi', 'pāramitā',
  'oṃ', 'hūṃ', 'hrīḥ', 'svāhā', 'namaḥ',
]

const PALI_KEYWORDS = [
  'dhamma', 'kamma', 'sutta', 'nibbāna', 'nibbana',
  'bhikkhu', 'bhikkhunī', 'saṅgha', 'sangha',
  'vipassanā', 'vipassana', 'satipaṭṭhāna',
  'anicca', 'dukkha', 'anattā', 'paṭicca',
  'theravāda', 'abhidhamma', 'vinaya', 'tipiṭaka',
]

function countBigrams(text: string, bigrams: Set<string>): number {
  let count = 0
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length - 1; i++) {
    if (bigrams.has(lower.slice(i, i + 2))) count++
  }
  return count
}

function countTrigrams(text: string, trigrams: Set<string>): number {
  let count = 0
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length - 2; i++) {
    if (trigrams.has(lower.slice(i, i + 3))) count++
  }
  return count
}

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const kw of keywords) {
    if (lower.includes(kw)) count++
  }
  return count
}

export function detectLanguageAdvanced(text: string): DetectionResult {
  const defaultResult: DetectionResult = { language: 'other', confidence: 0, scores: {} }
  if (!text || text.trim().length === 0) return defaultResult

  const sample = text.slice(0, 3000)
  const total = sample.replace(/\s/g, '').length
  if (total === 0) return defaultResult

  const scores: Record<string, number> = {}

  // Character ratio scoring
  const cyrillicCount = (sample.match(CYRILLIC_RE) || []).length
  const tibetanCount = (sample.match(TIBETAN_RE) || []).length
  const cjkCount = (sample.match(CJK_RE) || []).length
  const latinCount = (sample.match(LATIN_RE) || []).length
  const devanagariCount = (sample.match(DEVANAGARI_RE) || []).length
  const iastCount = (sample.match(IAST_DIACRITICS_RE) || []).length

  // Base scores from character ratios
  scores.ru = (cyrillicCount / total) * 100
  scores.bo = (tibetanCount / total) * 100
  scores.zh = (cjkCount / total) * 100

  // Devanagari strongly suggests Sanskrit
  if (devanagariCount > 0) {
    scores.sa = (devanagariCount / total) * 100
  }

  // Latin text: could be English, Sanskrit (IAST), or Pali
  if (latinCount / total > 0.2) {
    const baseLatinScore = (latinCount / total) * 60

    // IAST diacritics boost for Sanskrit/Pali
    const iastRatio = iastCount / Math.max(latinCount, 1)

    // N-gram scoring
    const sanBigrams = countBigrams(sample, SANSKRIT_BIGRAMS)
    const sanTrigrams = countTrigrams(sample, SANSKRIT_TRIGRAMS)
    const palBigrams = countBigrams(sample, PALI_BIGRAMS)
    const palTrigrams = countTrigrams(sample, PALI_TRIGRAMS)

    // Keyword scoring
    const sanKeywords = countKeywords(sample, SANSKRIT_KEYWORDS)
    const palKeywords = countKeywords(sample, PALI_KEYWORDS)

    const sanScore = iastRatio * 40 + sanBigrams * 2 + sanTrigrams * 3 + sanKeywords * 5
    const palScore = iastRatio * 30 + palBigrams * 2 + palTrigrams * 3 + palKeywords * 6

    scores.sa = (scores.sa ?? 0) + sanScore
    scores.pi = palScore
    scores.en = baseLatinScore - sanScore * 0.5 - palScore * 0.5
    if (scores.en < 0) scores.en = 0
  }

  // Find top score
  let bestLang: DetectedLanguage = 'other'
  let bestScore = 0
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestLang = lang as DetectedLanguage
    }
  }

  // Calculate confidence as ratio of best to total
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0
    ? Math.min(Math.round((bestScore / totalScore) * 100), 99)
    : 0

  // Minimum thresholds
  if (bestScore < 3) return defaultResult

  return {
    language: bestLang,
    confidence,
    scores: scores as Partial<Record<DetectedLanguage, number>>,
  }
}

// ─── Legacy API (kept for backwards compatibility) ───

export function detectLanguage(text: string): DetectedLanguage {
  return detectLanguageAdvanced(text).language
}

const LANGUAGE_NAMES: Record<DetectedLanguage, string> = {
  ru: '俄文',
  en: '英文',
  bo: '藏文',
  zh: '中文',
  sa: '梵文',
  pi: '巴利文',
  other: '其他',
}

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code as DetectedLanguage] ?? code
}
