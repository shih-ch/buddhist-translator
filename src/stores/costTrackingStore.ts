import { create } from 'zustand';
import type { AIProviderId } from '@/types/settings';

const STORAGE_KEY = 'bt-cost-tracking';
const MAX_ENTRIES = 500;

export interface CostEntry {
  id: string;
  timestamp: number;
  provider: AIProviderId;
  model: string;
  functionType: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostSummaryData {
  totalCost: number;
  totalTokens: number;
  byProvider: Record<string, { cost: number; tokens: number; calls: number }>;
  byModel: Record<string, { cost: number; tokens: number; calls: number }>;
  last30Days: number;
  totalCalls: number;
}

function loadEntries(): CostEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: CostEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

interface CostTrackingState {
  entries: CostEntry[];

  addEntry: (entry: Omit<CostEntry, 'id' | 'timestamp'>) => void;
  getSummary: () => CostSummaryData;
  clearEntries: () => void;
}

export const useCostTrackingStore = create<CostTrackingState>((set, get) => ({
  entries: loadEntries(),

  addEntry: (data) => {
    const entry: CostEntry = {
      ...data,
      id: `cost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    set((state) => {
      const entries = [entry, ...state.entries].slice(0, MAX_ENTRIES);
      saveEntries(entries);
      return { entries };
    });
  },

  getSummary: () => {
    const entries = get().entries;
    const byProvider: CostSummaryData['byProvider'] = {};
    const byModel: CostSummaryData['byModel'] = {};
    let totalCost = 0;
    let totalTokens = 0;
    let last30Days = 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const e of entries) {
      totalCost += e.cost;
      totalTokens += e.inputTokens + e.outputTokens;

      if (e.timestamp > thirtyDaysAgo) {
        last30Days += e.cost;
      }

      if (!byProvider[e.provider]) byProvider[e.provider] = { cost: 0, tokens: 0, calls: 0 };
      byProvider[e.provider].cost += e.cost;
      byProvider[e.provider].tokens += e.inputTokens + e.outputTokens;
      byProvider[e.provider].calls++;

      if (!byModel[e.model]) byModel[e.model] = { cost: 0, tokens: 0, calls: 0 };
      byModel[e.model].cost += e.cost;
      byModel[e.model].tokens += e.inputTokens + e.outputTokens;
      byModel[e.model].calls++;
    }

    return { totalCost, totalTokens, byProvider, byModel, last30Days, totalCalls: entries.length };
  },

  clearEntries: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ entries: [] });
  },
}));
