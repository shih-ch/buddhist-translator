import { create } from 'zustand'
import type { Glossary, GlossaryTerm } from '@/types/glossary'
import { githubService } from '@/services/github'

interface GlossaryState {
  glossary: Glossary | null
  isLoading: boolean

  fetchGlossary: () => Promise<void>
  addTerm: (term: GlossaryTerm) => Promise<void>
  updateTerm: (id: string, updates: Partial<GlossaryTerm>) => Promise<void>
  deleteTerm: (id: string) => Promise<void>
  addTermsBatch: (terms: GlossaryTerm[]) => Promise<void>
  searchTerms: (query: string) => GlossaryTerm[]
  getTermsByCategory: (category: string) => GlossaryTerm[]
  exportCsv: () => string
}

export const useGlossaryStore = create<GlossaryState>((set, get) => ({
  glossary: null,
  isLoading: false,

  fetchGlossary: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const glossary = await githubService.loadGlossary()
      set({ glossary })
    } catch (err) {
      console.error('Failed to fetch glossary:', err)
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
    await githubService.saveGlossary(updated)
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
    await githubService.saveGlossary(updated)
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
    await githubService.saveGlossary(updated)
  },

  addTermsBatch: async (terms) => {
    const glossary = get().glossary ?? { version: 1, updated_at: '', terms: [] }
    const updated: Glossary = {
      ...glossary,
      updated_at: new Date().toISOString(),
      terms: [...glossary.terms, ...terms],
    }
    set({ glossary: updated })
    await githubService.saveGlossary(updated)
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
    const header = 'original,translation,sanskrit,category,notes'
    const rows = glossary.terms.map((t) =>
      [t.original, t.translation, t.sanskrit, t.category, t.notes]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(',')
    )
    return [header, ...rows].join('\n')
  },
}))
