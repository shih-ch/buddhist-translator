import { create } from 'zustand'

export interface TMEntry {
  id: string
  source: string
  target: string
  sourceLang: string
  date: string
  articlePath: string
}

const STORAGE_KEY = 'bt-translation-memory'
const MAX_ENTRIES = 200

function load(): TMEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(entries: TMEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

interface TranslationMemoryState {
  entries: TMEntry[]
  addEntry: (source: string, target: string, sourceLang: string, articlePath: string) => void
  removeEntry: (id: string) => void
  clear: () => void
}

export const useTranslationMemoryStore = create<TranslationMemoryState>((set, get) => ({
  entries: load(),

  addEntry: (source, target, sourceLang, articlePath) => {
    // Don't add duplicates (same source text)
    const existing = get().entries
    if (existing.some((e) => e.source === source)) return

    const entry: TMEntry = {
      id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: source.slice(0, 2000), // cap source length
      target: target.slice(0, 5000), // cap target length
      sourceLang,
      date: new Date().toISOString(),
      articlePath,
    }
    let updated = [entry, ...existing]
    if (updated.length > MAX_ENTRIES) {
      updated = updated.slice(0, MAX_ENTRIES)
    }
    save(updated)
    set({ entries: updated })
  },

  removeEntry: (id) => {
    const updated = get().entries.filter((e) => e.id !== id)
    save(updated)
    set({ entries: updated })
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ entries: [] })
  },
}))
