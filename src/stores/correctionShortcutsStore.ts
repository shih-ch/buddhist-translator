import { create } from 'zustand'

export interface CorrectionShortcut {
  id: string
  label: string
  text: string
  usageCount: number
  createdAt: string
}

const STORAGE_KEY = 'bt-correction-shortcuts'

function load(): CorrectionShortcut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(shortcuts: CorrectionShortcut[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
}

interface CorrectionShortcutsState {
  shortcuts: CorrectionShortcut[]
  addShortcut: (label: string, text: string) => void
  updateShortcut: (id: string, updates: Partial<Pick<CorrectionShortcut, 'label' | 'text'>>) => void
  deleteShortcut: (id: string) => void
  incrementUsage: (id: string) => void
}

export const useCorrectionShortcutsStore = create<CorrectionShortcutsState>((set, get) => ({
  shortcuts: load(),

  addShortcut: (label, text) => {
    const shortcut: CorrectionShortcut = {
      id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      text,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    }
    const updated = [...get().shortcuts, shortcut]
    save(updated)
    set({ shortcuts: updated })
  },

  updateShortcut: (id, updates) => {
    const updated = get().shortcuts.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    )
    save(updated)
    set({ shortcuts: updated })
  },

  deleteShortcut: (id) => {
    const updated = get().shortcuts.filter((s) => s.id !== id)
    save(updated)
    set({ shortcuts: updated })
  },

  incrementUsage: (id) => {
    const updated = get().shortcuts.map((s) =>
      s.id === id ? { ...s, usageCount: s.usageCount + 1 } : s
    )
    save(updated)
    set({ shortcuts: updated })
  },
}))
