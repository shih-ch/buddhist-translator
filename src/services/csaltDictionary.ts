/**
 * C-SALT (Cologne South Asian Languages and Texts) Dictionary Service
 *
 * Queries free REST APIs for:
 * - MW (Monier-Williams Sanskrit-English Dictionary)
 * - BHS (Buddhist Hybrid Sanskrit Dictionary — Edgerton)
 *
 * API requires SLP1 encoding for headword queries.
 */

// ---------------------------------------------------------------------------
// Script detection
// ---------------------------------------------------------------------------

export type InputScript = 'devanagari' | 'tibetan' | 'iast' | 'latin'

export function detectScript(text: string): InputScript {
  // Devanagari: U+0900–U+097F
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari'
  // Tibetan: U+0F00–U+0FFF
  if (/[\u0F00-\u0FFF]/.test(text)) return 'tibetan'
  // IAST has diacritics: ā ī ū ṛ ṝ ṃ ḥ ṭ ḍ ṇ ś ṣ ṅ ñ ḷ ḹ
  if (/[āīūṛṝṃḥṭḍṇśṣṅñḷḹĀĪŪṚṜṂḤṬḌṆŚṢṄÑḶḸ]/.test(text)) return 'iast'
  return 'latin'
}

export const SCRIPT_LABELS: Record<InputScript, string> = {
  devanagari: '天城體',
  tibetan: '藏文',
  iast: 'IAST',
  latin: '拉丁',
}

// ---------------------------------------------------------------------------
// IAST → SLP1 conversion
// ---------------------------------------------------------------------------

const IAST_TO_SLP1_MAP: [RegExp, string][] = [
  // Multi-char consonant clusters (must come before single-char mappings)
  [/kh/g, 'K'],
  [/gh/g, 'G'],
  [/ch/g, 'C'],
  [/jh/g, 'J'],
  [/ṭh/g, 'W'],
  [/ḍh/g, 'Q'],
  [/th/g, 'T'],
  [/dh/g, 'D'],
  [/ph/g, 'P'],
  [/bh/g, 'B'],
  [/Kh/g, 'K'],
  [/Gh/g, 'G'],
  [/Ch/g, 'C'],
  [/Jh/g, 'J'],
  [/Ṭh/g, 'W'],
  [/Ḍh/g, 'Q'],
  [/Th/g, 'T'],
  [/Dh/g, 'D'],
  [/Ph/g, 'P'],
  [/Bh/g, 'B'],
  // Long vowels
  [/ā/g, 'A'],
  [/Ā/g, 'A'],
  [/ī/g, 'I'],
  [/Ī/g, 'I'],
  [/ū/g, 'U'],
  [/Ū/g, 'U'],
  // Vocalic r/l
  [/ṝ/g, 'F'],
  [/Ṝ/g, 'F'],
  [/ṛ/g, 'f'],
  [/Ṛ/g, 'f'],
  [/ḹ/g, 'X'],
  [/Ḹ/g, 'X'],
  [/ḷ/g, 'x'],
  [/Ḷ/g, 'x'],
  // Anusvara, visarga, candrabindu
  [/ṃ/g, 'M'],
  [/Ṃ/g, 'M'],
  [/ḥ/g, 'H'],
  [/Ḥ/g, 'H'],
  [/m̐/g, '~'],
  // Retroflex consonants
  [/ṭ/g, 'w'],
  [/Ṭ/g, 'w'],
  [/ḍ/g, 'q'],
  [/Ḍ/g, 'q'],
  [/ṇ/g, 'R'],
  [/Ṇ/g, 'R'],
  // Sibilants
  [/ś/g, 'S'],
  [/Ś/g, 'S'],
  [/ṣ/g, 'z'],
  [/Ṣ/g, 'z'],
  // Nasals
  [/ṅ/g, 'N'],
  [/Ṅ/g, 'N'],
  [/ñ/g, 'Y'],
  [/Ñ/g, 'Y'],
]

export function iastToSlp1(iast: string): string {
  let result = iast
  for (const [pattern, replacement] of IAST_TO_SLP1_MAP) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ---------------------------------------------------------------------------
// Devanagari → SLP1 conversion
// ---------------------------------------------------------------------------

// Virama (halant) suppresses the inherent 'a'
const VIRAMA = '\u094D'

const DEVA_VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'A', 'इ': 'i', 'ई': 'I', 'उ': 'u', 'ऊ': 'U',
  'ऋ': 'f', 'ॠ': 'F', 'ऌ': 'x', 'ॡ': 'X',
  'ए': 'e', 'ऐ': 'E', 'ओ': 'o', 'औ': 'O',
}

const DEVA_MATRAS: Record<string, string> = {
  'ा': 'A', 'ि': 'i', 'ी': 'I', 'ु': 'u', 'ू': 'U',
  'ृ': 'f', 'ॄ': 'F', 'ॢ': 'x', 'ॣ': 'X',
  'े': 'e', 'ै': 'E', 'ो': 'o', 'ौ': 'O',
}

const DEVA_CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'K', 'ग': 'g', 'घ': 'G', 'ङ': 'N',
  'च': 'c', 'छ': 'C', 'ज': 'j', 'झ': 'J', 'ञ': 'Y',
  'ट': 'w', 'ठ': 'W', 'ड': 'q', 'ढ': 'Q', 'ण': 'R',
  'त': 't', 'थ': 'T', 'द': 'd', 'ध': 'D', 'न': 'n',
  'प': 'p', 'फ': 'P', 'ब': 'b', 'भ': 'B', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'S', 'ष': 'z', 'स': 's', 'ह': 'h',
}

const DEVA_SPECIAL: Record<string, string> = {
  'ं': 'M',   // anusvara
  'ः': 'H',   // visarga
  'ँ': '~',   // candrabindu
  'ॐ': 'oM',  // om
}

export function devanagariToSlp1(deva: string): string {
  let result = ''
  let i = 0
  while (i < deva.length) {
    const ch = deva[i]

    // Independent vowels
    // Check two-char vowels first (e.g. औ = ओ + ◌ौ? No, they are single codepoints)
    if (DEVA_VOWELS[ch]) {
      result += DEVA_VOWELS[ch]
      i++
      continue
    }

    // Consonants
    if (DEVA_CONSONANTS[ch]) {
      result += DEVA_CONSONANTS[ch]
      i++
      // Check what follows: virama, matra, or inherent 'a'
      if (i < deva.length && deva[i] === VIRAMA) {
        // Virama: no vowel
        i++
      } else if (i < deva.length && DEVA_MATRAS[deva[i]]) {
        // Matra: specific vowel
        result += DEVA_MATRAS[deva[i]]
        i++
      } else {
        // Inherent 'a'
        result += 'a'
      }
      continue
    }

    // Special marks
    if (DEVA_SPECIAL[ch]) {
      result += DEVA_SPECIAL[ch]
      i++
      continue
    }

    // Matras appearing standalone (shouldn't normally happen)
    if (DEVA_MATRAS[ch]) {
      result += DEVA_MATRAS[ch]
      i++
      continue
    }

    // Pass through anything else (spaces, punctuation, numbers)
    result += ch
    i++
  }
  return result
}

// ---------------------------------------------------------------------------
// Tibetan → Wylie transliteration (basic)
// ---------------------------------------------------------------------------

const TIBETAN_CONSONANTS: Record<string, string> = {
  'ཀ': 'ka', 'ཁ': 'kha', 'ག': 'ga', 'གྷ': 'gha', 'ང': 'nga',
  'ཅ': 'ca', 'ཆ': 'cha', 'ཇ': 'ja', 'ཉ': 'nya', 'ཏ': 'ta',
  'ཐ': 'tha', 'ད': 'da', 'དྷ': 'dha', 'ན': 'na', 'པ': 'pa',
  'ཕ': 'pha', 'བ': 'ba', 'བྷ': 'bha', 'མ': 'ma', 'ཙ': 'tsa',
  'ཚ': 'tsha', 'ཛ': 'dza', 'ཝ': 'wa', 'ཞ': 'zha', 'ཟ': 'za',
  'འ': '\'a', 'ཡ': 'ya', 'ར': 'ra', 'ལ': 'la', 'ཤ': 'sha',
  'ས': 'sa', 'ཧ': 'ha', 'ཨ': 'a',
}

const TIBETAN_VOWELS: Record<string, string> = {
  '\u0F72': 'i',  // གི gi
  '\u0F74': 'u',  // གུ gu
  '\u0F7A': 'e',  // གེ ge
  '\u0F7C': 'o',  // གོ go
}

/**
 * Basic Tibetan → Wylie transliteration.
 * This is a simplified version for dictionary lookup purposes.
 */
export function tibetanToWylie(tibetan: string): string {
  let result = ''
  let i = 0
  while (i < tibetan.length) {
    const ch = tibetan[i]

    if (TIBETAN_CONSONANTS[ch]) {
      const wylie = TIBETAN_CONSONANTS[ch]
      // The consonant map includes inherent 'a'
      // Check if followed by a vowel sign — if so, replace the 'a'
      if (i + 1 < tibetan.length && TIBETAN_VOWELS[tibetan[i + 1]]) {
        result += wylie.slice(0, -1) + TIBETAN_VOWELS[tibetan[i + 1]]
        i += 2
      } else if (i + 1 < tibetan.length && tibetan[i + 1] === '\u0F94') {
        // Tsheg (syllable separator) — keep the 'a'
        result += wylie
        i++
      } else {
        result += wylie
        i++
      }
      continue
    }

    // Vowel signs without preceding consonant
    if (TIBETAN_VOWELS[ch]) {
      result += TIBETAN_VOWELS[ch]
      i++
      continue
    }

    // Tsheg → space
    if (ch === '\u0F0B') {
      result += ' '
      i++
      continue
    }

    // Pass through
    result += ch
    i++
  }
  return result.trim()
}

// ---------------------------------------------------------------------------
// Unified: any input → SLP1
// ---------------------------------------------------------------------------

export interface ConversionResult {
  slp1: string
  detectedScript: InputScript
}

/**
 * Auto-detect input script and convert to SLP1 for C-SALT query.
 * - Devanagari → SLP1 directly
 * - IAST → SLP1
 * - Tibetan → Wylie → IAST approximation (best-effort)
 * - Plain Latin → try as-is + capitalize first letter (common SLP1 pattern)
 */
export function toSlp1(input: string): ConversionResult {
  const script = detectScript(input)
  switch (script) {
    case 'devanagari':
      return { slp1: devanagariToSlp1(input), detectedScript: script }
    case 'iast':
      return { slp1: iastToSlp1(input), detectedScript: script }
    case 'tibetan':
      // Tibetan → Wylie; C-SALT is Sanskrit-focused so results may be limited
      return { slp1: tibetanToWylie(input), detectedScript: script }
    case 'latin':
    default:
      // Plain latin: try IAST conversion (handles 'dh'→'D' etc.)
      return { slp1: iastToSlp1(input), detectedScript: script }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CSaltEntry {
  id: string
  headword_slp1: string
  xml: string
}

export interface CSaltResult {
  term: string
  source: 'MW' | 'BHS'
  headword: string
  definitions: string[]
}

// ---------------------------------------------------------------------------
// XML parsing
// ---------------------------------------------------------------------------

/**
 * Extract readable definitions from C-SALT TEI XML.
 *
 * The XML uses TEI namespace (xmlns="http://www.tei-c.org/ns/1.0"),
 * so we strip the namespace for simpler querying with querySelectorAll.
 */
export function parseXmlDefinitions(xml: string): string[] {
  if (!xml) return []

  // Strip XML namespace so querySelectorAll works with plain tag names
  const cleanXml = xml.replace(/\s*xmlns="[^"]*"/g, '')
  const parser = new DOMParser()
  const doc = parser.parseFromString(cleanXml, 'text/xml')

  // Check for parse errors
  if (doc.querySelector('parsererror')) {
    // Fallback: regex extraction
    return extractDefinitionsRegex(xml)
  }

  const definitions: string[] = []

  // Extract <sense> elements (TEI standard for dictionary entries)
  const senses = doc.querySelectorAll('sense')
  if (senses.length > 0) {
    senses.forEach((sense) => {
      // Remove <note> elements (contain page refs / IDs, not definitions)
      sense.querySelectorAll('note').forEach((n) => n.remove())
      const text = sense.textContent?.replace(/\s+/g, ' ').trim()
      if (text) definitions.push(text)
    })
    if (definitions.length > 0) return definitions
  }

  // Fallback: full text content
  const fullText = doc.documentElement?.textContent?.replace(/\s+/g, ' ').trim()
  if (fullText) {
    definitions.push(fullText)
  }

  return definitions
}

/** Regex fallback for when DOMParser fails */
function extractDefinitionsRegex(xml: string): string[] {
  const senseMatches = xml.match(/<sense[^>]*>([\s\S]*?)<\/sense>/g)
  if (!senseMatches) return []

  return senseMatches
    .map((m) => m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// API queries
// ---------------------------------------------------------------------------

const CSALT_BASE = 'https://api.c-salt.uni-koeln.de/dicts'

export async function queryCSalt(
  dict: 'mw' | 'bhs',
  term: string,
): Promise<CSaltResult[]> {
  const sourceName = dict === 'mw' ? 'MW' : 'BHS'
  const { slp1: slp1Term } = toSlp1(term)

  // Build query variants: try SLP1 first, then raw term if different
  const queries: string[] = [slp1Term]
  if (slp1Term !== term) queries.push(term)

  for (const q of queries) {
    try {
      const url = `${CSALT_BASE}/${dict}/restful/entries?` +
        new URLSearchParams({
          query: q,
          field: 'headword_slp1',
          query_type: 'prefix',
          size: '10',
        }).toString()

      const res = await fetch(url)
      if (!res.ok) continue

      const json = await res.json()
      // API returns { data: { entries: [...] } }
      const entries: CSaltEntry[] = json?.data?.entries || json?.entries || []

      if (!Array.isArray(entries) || entries.length === 0) continue

      return entries.map((entry) => ({
        term,
        source: sourceName as 'MW' | 'BHS',
        headword: entry.headword_slp1 || q,
        definitions: parseXmlDefinitions(entry.xml || ''),
      })).filter((r) => r.definitions.length > 0)
    } catch {
      // Network error — try next query variant
      continue
    }
  }

  return []
}

/**
 * Query both MW and BHS dictionaries in parallel, merge results.
 */
export async function lookupOnline(term: string): Promise<CSaltResult[]> {
  const [mwResults, bhsResults] = await Promise.all([
    queryCSalt('mw', term),
    queryCSalt('bhs', term),
  ])

  return [...bhsResults, ...mwResults]
}
