import { create } from 'zustand';

export type BatchItemStatus = 'pending' | 'translating' | 'done' | 'error';

export interface BatchItem {
  id: string;
  text: string;
  status: BatchItemStatus;
  result?: string;
  error?: string;
}

interface BatchState {
  items: BatchItem[];
  isRunning: boolean;

  setItems: (texts: string[]) => void;
  updateItem: (id: string, updates: Partial<BatchItem>) => void;
  getNextPending: () => BatchItem | undefined;
  setRunning: (running: boolean) => void;
  clear: () => void;
  removeItem: (id: string) => void;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  items: [],
  isRunning: false,

  setItems: (texts) => {
    const items: BatchItem[] = texts.map((text, i) => ({
      id: `batch-${Date.now()}-${i}`,
      text: text.trim(),
      status: 'pending',
    }));
    set({ items });
  },

  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  getNextPending: () => {
    return get().items.find((item) => item.status === 'pending');
  },

  setRunning: (running) => set({ isRunning: running }),

  clear: () => set({ items: [], isRunning: false }),

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },
}));
