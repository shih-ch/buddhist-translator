import { toast } from 'sonner';
import type { TranslatorState } from '../translatorStore';

const DRAFT_KEY = 'bt-translator-draft';
/** Write at most this often while state keeps changing (e.g. during streaming). */
const SAVE_INTERVAL_MS = 800;

/**
 * The parts of the translator worth getting back after a reload, a crash or a
 * dev-server hot update. Transient flags (isLoading, abortController,
 * replacementRange) are left out, and savedVersions is persisted on its own.
 * editingArticle is kept: without its path/sha, a restored edit would be saved
 * as a brand-new article instead of updating the original.
 */
const DRAFT_FIELDS = [
  'inputMode',
  'originalText',
  'importedText',
  'metadata',
  'translationParams',
  'activePreset',
  'messages',
  'currentModel',
  'totalTokens',
  'totalCost',
  'previewContent',
  'previewMode',
  'articleImages',
  'editingArticle',
] as const satisfies readonly (keyof TranslatorState)[];

export type TranslatorDraft = Pick<TranslatorState, (typeof DRAFT_FIELDS)[number]>;

interface StoredDraft {
  v: 1;
  savedAt: number;
  draft: Partial<TranslatorDraft>;
}

function pick(state: TranslatorState): TranslatorDraft {
  const draft = {} as Record<string, unknown>;
  for (const key of DRAFT_FIELDS) draft[key] = state[key];
  return draft as TranslatorDraft;
}

function isEmpty(d: Partial<TranslatorDraft>): boolean {
  return !d.originalText && !d.messages?.length && !d.previewContent;
}

export function loadDraft(): { draft: Partial<TranslatorDraft>; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDraft;
    if (stored?.v !== 1 || !stored.draft || isEmpty(stored.draft)) return null;
    return { draft: stored.draft, savedAt: stored.savedAt };
  } catch {
    return null;
  }
}

let pending: TranslatorDraft | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let warnedQuota = false;

function write(draft: Partial<TranslatorDraft>): boolean {
  try {
    const stored: StoredDraft = { v: 1, savedAt: Date.now(), draft };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/**
 * Throttled rather than debounced: streaming updates the store many times a
 * second for minutes on end, and a debounce would never fire until it stopped —
 * exactly the window in which a reload loses the most work.
 */
export function scheduleDraftSave(state: TranslatorState): void {
  pending = pick(state);
  if (timer === undefined) timer = setTimeout(flushDraft, SAVE_INTERVAL_MS);
}

export function flushDraft(): void {
  clearTimeout(timer);
  timer = undefined;
  const draft = pending;
  pending = null;
  if (!draft) return;

  if (isEmpty(draft)) {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage unavailable — nothing to clear.
    }
    return;
  }
  if (write(draft)) return;
  // Over quota (the glossary cache shares the ~5MB). The conversation history
  // is the bulkiest part and the least needed to pick up again; keep the
  // source text and the current translation.
  if (write({ ...draft, messages: [] })) return;
  if (!warnedQuota) {
    warnedQuota = true;
    toast.warning('瀏覽器儲存空間不足，翻譯草稿無法自動保存。建議先按「儲存版本」。');
  }
}
