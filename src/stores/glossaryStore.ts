import { create } from 'zustand'
import type { Glossary, GlossaryTerm } from '@/types/glossary'
import { githubService } from '@/services/github'
import { toast } from 'sonner'

const CACHE_KEY = 'bt-glossary-cache'

function saveToCache(glossary: Glossary) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(glossary))
  } catch {
    // localStorage full — try saving without definition field to reduce size
    try {
      const slim = {
        ...glossary,
        terms: glossary.terms.map(({ definition, ...rest }) => ({ ...rest, definition: definition ? '...' : '' })),
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(slim))
    } catch {
      console.warn('Glossary too large for localStorage cache')
    }
  }
}

function loadFromCache(): Glossary | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

interface GlossaryState {
  glossary: Glossary | null
  isLoading: boolean

  fetchGlossary: () => Promise<void>
  addTerm: (term: GlossaryTerm) => Promise<void>
  updateTerm: (id: string, updates: Partial<GlossaryTerm>) => Promise<void>
  deleteTerm: (id: string) => Promise<void>
  deleteTermsBatch: (ids: string[]) => Promise<void>
  addTermsBatch: (terms: GlossaryTerm[]) => Promise<void>
  updateTermsBatch: (updates: { id: string; updates: Partial<GlossaryTerm> }[], skipSync?: boolean) => Promise<void>
  syncToGithub: () => Promise<void>
  searchTerms: (query: string) => GlossaryTerm[]
  getTermsByCategory: (category: string) => GlossaryTerm[]
  exportCsv: () => string
}

async function persistToGithub(updated: Glossary) {
  saveToCache(updated)
  try {
    await githubService.saveGlossary(updated)
  } catch (err) {
    console.error('Failed to save glossary to GitHub:', err)
    toast.error(`術語表同步失敗：${err instanceof Error ? err.message : 'Unknown error'}（本地已保存）`)
  }
}

export const useGlossaryStore = create<GlossaryState>((set, get) => ({
  glossary: loadFromCache(),
  isLoading: false,

  fetchGlossary: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const remote = await githubService.loadGlossary()
      const cached = get().glossary
      const localNewer = cached?.updated_at && remote.updated_at
        ? cached.updated_at > remote.updated_at
        : false
      if (cached && cached.terms.length > 0 && (cached.terms.length > remote.terms.length || localNewer)) {
        // Local is newer or has more terms — keep local and push to GitHub
        await githubService.saveGlossary(cached).catch(() => {})
        set({ glossary: cached })
      } else if (remote.terms.length > 0) {
        set({ glossary: remote })
        saveToCache(remote)
      } else if (cached && cached.terms.length > 0) {
        // Remote is empty but local has data — keep local
        set({ glossary: cached })
      } else {
        set({ glossary: remote })
        saveToCache(remote)
      }
    } catch (err) {
      console.error('Failed to fetch glossary:', err)
      // Keep in-memory state if available, otherwise fall back to localStorage
      const inMemory = get().glossary
      if (inMemory && inMemory.terms.length > 0) {
        // Already have data in memory — don't overwrite
      } else {
        const cached = loadFromCache()
        if (cached) {
          set({ glossary: cached })
        }
      }
    } finally {
      set({ isLoading: false })
    }
  },

  addTerm: async (term) => {
    const glossary = get().glossary ?? { version: 1, updated_at: '', terms: [] }
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: [...glossary.terms, term],
    }
    set({ glossary: updated })
    await persistToGithub(updated)
  },

  updateTerm: async (id, updates) => {
    const glossary = get().glossary
    if (!glossary) return
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: glossary.terms.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }
    set({ glossary: updated })
    await persistToGithub(updated)
  },

  deleteTerm: async (id) => {
    const glossary = get().glossary
    if (!glossary) return
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: glossary.terms.filter((t) => t.id !== id),
    }
    set({ glossary: updated })
    await persistToGithub(updated)
  },

  deleteTermsBatch: async (ids) => {
    const glossary = get().glossary
    if (!glossary) return
    const idSet = new Set(ids)
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: glossary.terms.filter((t) => !idSet.has(t.id)),
    }
    set({ glossary: updated })
    await persistToGithub(updated)
  },

  addTermsBatch: async (terms) => {
    const glossary = get().glossary ?? { version: 1, updated_at: '', terms: [] }
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: [...glossary.terms, ...terms],
    }
    set({ glossary: updated })
    await persistToGithub(updated)
  },

  updateTermsBatch: async (updates, skipSync) => {
    const glossary = get().glossary
    if (!glossary || updates.length === 0) return
    const updateMap = new Map(updates.map((u) => [u.id, u.updates]))
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: glossary.terms.map((t) => {
        const patch = updateMap.get(t.id)
        return patch ? { ...t, ...patch } : t
      }),
    }
    set({ glossary: updated })
    if (skipSync) {
      saveToCache(updated)
    } else {
      await persistToGithub(updated)
    }
  },

  syncToGithub: async () => {
    const glossary = get().glossary
    if (!glossary) return
    await persistToGithub(glossary)
  },

  searchTerms: (query) => {
    const glossary = get().glossary
    if (!glossary || !query) return glossary?.terms ?? []
    const q = query.toLowerCase()
    return glossary.terms.filter(
      (t) =>
        t.original.toLowerCase().includes(q) ||
        t.translation.toLowerCase().includes(q) ||
        t.sanskrit.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
    )
  },

  getTermsByCategory: (category) => {
    const glossary = get().glossary
    if (!glossary) return []
    return glossary.terms.filter((t) => t.category === category)
  },

  exportCsv: () => {
    const glossary = get().glossary
    if (!glossary) return ''
    const header = 'original,translation,sanskrit,language,category,notes,source_article,tibetan,wylie,definition,link'
    const rows = glossary.terms.map((t) =>
      [t.original, t.translation, t.sanskrit, t.language || '', t.category, t.notes, t.source_article || '', t.tibetan || '', t.wylie || '', t.definition || '', t.link || '']
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(',')
    )
    return [header, ...rows].join('\n')
  },
}))
