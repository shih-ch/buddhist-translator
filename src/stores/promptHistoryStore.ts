import { create } from 'zustand';
import type { AIFunctionId } from '@/types/settings';
import type { PromptHistoryEntry } from '@/types/promptHistory';

const STORAGE_KEY = 'bt-prompt-history';
const MAX_ENTRIES_PER_FUNCTION = 50;

function loadEntries(): PromptHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: PromptHistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

interface PromptHistoryState {
  entries: PromptHistoryEntry[];

  addEntry: (functionId: AIFunctionId, prompt: string, source: PromptHistoryEntry['source'], label?: string) => void;
  getEntries: (functionId: AIFunctionId) => PromptHistoryEntry[];
  getEntry: (id: string) => PromptHistoryEntry | undefined;
  clearEntries: (functionId: AIFunctionId) => void;
}

export const usePromptHistoryStore = create<PromptHistoryState>((set, get) => ({
  entries: loadEntries(),

  addEntry: (functionId, prompt, source, label) => {
    const entry: PromptHistoryEntry = {
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      functionId,
      prompt,
      timestamp: Date.now(),
      source,
      label,
    };

    set((state) => {
      // Get existing entries for this function
      const forFunction = state.entries.filter((e) => e.functionId === functionId);

      // Skip if prompt is identical to the most recent entry for this function
      if (forFunction.length > 0 && forFunction[0].prompt === prompt) {
        return state;
      }

      // Add new entry at the front, cap per function
      const otherEntries = state.entries.filter((e) => e.functionId !== functionId);
      const updatedForFunction = [entry, ...forFunction].slice(0, MAX_ENTRIES_PER_FUNCTION);
      const entries = [...updatedForFunction, ...otherEntries];

      saveEntries(entries);
      return { entries };
    });
  },

  getEntries: (functionId) => {
    return get().entries
      .filter((e) => e.functionId === functionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  getEntry: (id) => {
    return get().entries.find((e) => e.id === id);
  },

  clearEntries: (functionId) => {
    set((state) => {
      const entries = state.entries.filter((e) => e.functionId !== functionId);
      saveEntries(entries);
      return { entries };
    });
  },
}));
